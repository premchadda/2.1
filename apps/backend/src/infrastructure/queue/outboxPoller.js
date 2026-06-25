import { emitDomainEvent } from '../events/eventBus.js';
import { pool } from '../database/postgres-helpers.js';

let pollerInterval = null;

export const startOutboxPoller = (intervalMs = 5000) => {
  if (pollerInterval) {
    return;
  }

  console.log(`\n📬 [Outbox Poller] Initializing Transactional Outbox Poller (interval: ${intervalMs}ms)...`);

  pollerInterval = setInterval(async () => {
    let client = null;
    try {
      client = await pool.connect();
      
      // Select up to 10 pending events using SELECT FOR UPDATE SKIP LOCKED for high-concurrency safety
      const res = await client.query(`
        SELECT id, event_type, payload, retry_count, event_version 
        FROM outbox_events 
        WHERE status = 'pending' AND retry_count < 5
        ORDER BY created_at ASC 
        LIMIT 10 
        FOR UPDATE SKIP LOCKED
      `);

      if (res.rows.length === 0) {
        return;
      }

      for (const row of res.rows) {
        try {
          console.log(`📬 [Outbox Poller] Dispatching event: ${row.event_type} (${row.id})`);
          
          const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
          if (row.event_version) {
            payload.eventVersion = row.event_version;
          }
          
          // Publish event to local bus and external queues safely
          await emitDomainEvent(row.event_type, payload);

          // Mark event as processed successfully
          await client.query(`
            UPDATE outbox_events 
            SET status = 'processed', processed_at = NOW() 
            WHERE id = $1
          `, [row.id]);
          
          console.log(`📬 [Outbox Poller] Event ${row.id} marked as processed.`);
        } catch (eventError) {
          console.error(`❌ [Outbox Poller] Failed event processing for ${row.id}:`, eventError.message);
          
          const nextRetryCount = (row.retry_count || 0) + 1;
          const status = nextRetryCount >= 5 ? 'dead_letter' : 'pending';

          // Mark event as failed and update metrics
          await client.query(`
            UPDATE outbox_events 
            SET status = $1, retry_count = $2, failed_reason = $3
            WHERE id = $4
          `, [status, nextRetryCount, eventError.message, row.id]);
        }
      }
    } catch (err) {
      console.error('❌ [Outbox Poller] Error polling outbox table:', err.message);
    } finally {
      if (client) {
        client.release();
      }
    }
  }, intervalMs);
};

export const stopOutboxPoller = () => {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log('📬 [Outbox Poller] Outbox poller stopped.');
  }
};

let cleanerInterval = null;

export const startAttemptCleaner = (intervalMs = 60000) => {
  if (cleanerInterval) return;

  console.log(`🧹 [Attempt Cleaner] Initializing Auto-Recovery Attempt Session Cleaner (interval: ${intervalMs}ms)...`);

  cleanerInterval = setInterval(async () => {
    let client = null;
    try {
      client = await pool.connect();
      
      // Auto-abandon inactive attempts where status is IN_PROGRESS and last_heartbeat_at is older than 5 minutes
      const result = await client.query(`
        UPDATE attempts 
        SET status = 'abandoned', is_completed = true, submitted_at = NOW(), updated_at = NOW() 
        WHERE (status = 'in_progress' OR status = 'IN_PROGRESS')
        AND last_heartbeat_at < NOW() - INTERVAL '5 minutes'
        RETURNING id
      `);

      if (result.rows.length > 0) {
        console.log(`🧹 [Attempt Cleaner] Auto-abandoned ${result.rows.length} inactive or orphaned test attempts:`, result.rows.map(r => r.id));
      }
    } catch (err) {
      console.error('❌ [Attempt Cleaner] Error auto-cleaning stale attempts:', err.message);
    } finally {
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
    console.log('🧹 [Attempt Cleaner] Stale attempt session cleaner stopped.');
  }
};
