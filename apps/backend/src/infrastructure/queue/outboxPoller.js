import { emitDomainEvent, validateDomainEvent } from "../events/eventBus.js";
import { validateDomainEvent as assertDomainEventContract } from "../events/eventSchemas.js";
import { pool } from "../database/postgres-helpers.js";

let pollerTimeout = null;
let consecutiveFailures = 0;
const MAX_BACKOFF_MS = 60_000; // max 60 seconds between retries during outage

let isPolling = false;
// Stopped flag: stopOutboxPoller sets this so an in-flight poll never
// reschedules after shutdown (clearTimeout alone can't stop a running tick).
let stopped = false;

export const startOutboxPoller = (intervalMs = 5000) => {
  if (pollerTimeout) return;
  stopped = false;

  console.log(
    `\n📬 [Outbox Poller] Initializing Transactional Outbox Poller (base interval: ${intervalMs}ms)...`,
  );

  const poll = async () => {
    // Overlap guard: skip this tick if the previous poll is still running.
    // Reschedule before returning — the chain is setTimeout-driven, so an
    // early return without rescheduling would silently stop polling forever.
    if (stopped) return;
    if (isPolling) {
      if (!stopped) pollerTimeout = setTimeout(poll, intervalMs);
      return;
    }
    isPolling = true;
    let client = null;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      // Select up to 100 pending events using SELECT FOR UPDATE SKIP LOCKED for high-concurrency safety
      const res = await client.query(`
        SELECT id, event_type, payload, retry_count, event_version
        FROM outbox_events
        WHERE status = 'pending' AND retry_count < 5
        ORDER BY created_at ASC
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      `);

      // Successful DB contact — reset backoff
      consecutiveFailures = 0;

      if (res.rows.length === 0) {
        await client.query("COMMIT");
        return;
      }

      for (const row of res.rows) {
        try {
          console.log(
            `📬 [Outbox Poller] Dispatching event: ${row.event_type} (${row.id})`,
          );

          let payload;
          try {
            payload =
              typeof row.payload === "string"
                ? JSON.parse(row.payload)
                : (row.payload ?? {});
          } catch (parseErr) {
            throw new Error(`unparseable payload: ${parseErr.message}`);
          }
          if (row.event_version) {
            payload.eventVersion = row.event_version;
          }

          // Validate before fan-out: poison rows (empty type, queue-prefixed
          // legacy shape, non-object payload) fail fast to dead-letter
          // instead of fanning out malformed jobs to every queue.
          if (!validateDomainEvent(row.event_type, payload)) {
            throw new Error(
              `invalid domain event shape: type=${JSON.stringify(row.event_type)}`,
            );
          }

          // Strict contract: zod schema validation (throws on unknown event
          // types or schema violations → dead_letter, no fan-out).
          assertDomainEventContract(row.event_type, payload);

          // Publish event to local bus and external queues safely.
          // Idempotent jobId lets BullMQ dedup redeliveries of this row.
          await emitDomainEvent(row.event_type, payload, {
            jobId: `outbox-${row.id}`,
          });

          // Mark event as processed successfully
          await client.query(
            `
            UPDATE outbox_events 
            SET status = 'processed', processed_at = NOW() 
            WHERE id = $1
          `,
            [row.id],
          );

          console.log(
            `📬 [Outbox Poller] Event ${row.id} marked as processed.`,
          );
        } catch (eventError) {
          console.error(
            `❌ [Outbox Poller] Failed event processing for ${row.id}:`,
            eventError.message,
          );

          const nextRetryCount = (row.retry_count || 0) + 1;
          const status = nextRetryCount >= 5 ? "dead_letter" : "pending";

          // Mark event as failed and update metrics
          await client.query(
            `
            UPDATE outbox_events
            SET status = $1, retry_count = $2, failed_reason = $3
            WHERE id = $4
          `,
            [status, nextRetryCount, eventError.message, row.id],
          );
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      try {
        if (client) await client.query("ROLLBACK");
      } catch {
        /* ignore rollback errors */
      }
      consecutiveFailures++;
      // Exponential backoff: 5s, 10s, 20s, 40s, 60s (capped)
      const backoff = Math.min(
        intervalMs * Math.pow(2, consecutiveFailures - 1),
        MAX_BACKOFF_MS,
      );
      console.error(
        `❌ [Outbox Poller] Error polling outbox table (failure #${consecutiveFailures}, retrying in ${backoff / 1000}s):`,
        err.message,
      );
      // Schedule next attempt after backoff instead of fixed interval
      if (!stopped) pollerTimeout = setTimeout(poll, backoff);
      return;
    } finally {
      isPolling = false;
      if (client) {
        client.release();
      }
    }

    // Schedule next normal poll (never after stop)
    if (!stopped) pollerTimeout = setTimeout(poll, intervalMs);
  };

  // Kick off first poll
  if (!stopped) pollerTimeout = setTimeout(poll, intervalMs);
};

export const stopOutboxPoller = () => {
  stopped = true;
  if (pollerTimeout) {
    clearTimeout(pollerTimeout);
    pollerTimeout = null;
    consecutiveFailures = 0;
    isPolling = false;
    console.log("📬 [Outbox Poller] Outbox poller stopped.");
  }
};

let cleanerInterval = null;
let isCleaning = false;

export const startAttemptCleaner = (intervalMs = 60000) => {
  if (cleanerInterval) return;

  console.log(
    `🧹 [Attempt Cleaner] Initializing Auto-Recovery Attempt Session Cleaner (interval: ${intervalMs}ms)...`,
  );

  cleanerInterval = setInterval(async () => {
    // Overlap guard: a slow sweep must never stack with the next tick.
    if (isCleaning) return;
    isCleaning = true;
    let client = null;
    try {
      client = await pool.connect();

      // Auto-abandon inactive attempts where status is IN_PROGRESS and no activity has been recorded for 30 minutes
      // Uses subquery with FOR UPDATE SKIP LOCKED to prevent race conditions in multi-instance deployments.
      // Capped at 500 rows per sweep so a post-outage backlog can't hold a long write txn.
      const result = await client.query(`
        UPDATE attempts
        SET status = 'abandoned', is_completed = true, submitted_at = NOW(), updated_at = NOW()
        WHERE id IN (
          SELECT id
          FROM attempts
          WHERE (status = 'in_progress' OR status = 'IN_PROGRESS')
          AND COALESCE(last_heartbeat_at, last_activity_at, updated_at, created_at) < NOW() - INTERVAL '30 minutes'
          ORDER BY COALESCE(last_heartbeat_at, last_activity_at, updated_at, created_at) ASC
          LIMIT 500
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id
      `);

      if (result.rows.length > 0) {
        console.log(
          `🧹 [Attempt Cleaner] Auto-abandoned ${result.rows.length} inactive or orphaned test attempts:`,
          result.rows.map((r) => r.id),
        );
      }
    } catch (err) {
      console.error(
        "❌ [Attempt Cleaner] Error auto-cleaning stale attempts:",
        err.message,
      );
    } finally {
      isCleaning = false;
      if (client) {
        client.release();
      }
    }
  }, intervalMs);
};

export const stopAttemptCleaner = () => {
  if (cleanerInterval) {
    clearInterval(cleanerInterval);
    cleanerInterval = null;
    console.log("🧹 [Attempt Cleaner] Stale attempt session cleaner stopped.");
  }
};
