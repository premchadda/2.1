import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { testStateMachine } from "./testStateMachine.js";
import { runDatabaseMaintenance } from "./maintenance.js";
import logger from "../../infrastructure/logger/logger.js";

const TRANSITION_MAP = Object.freeze([
  { from: "scheduled", to: "live", field: "scheduledAt" },
  { from: "live", to: "expired", field: "expiredAt" },
]);

const CHECK_INTERVAL_MS = 60_000;
// M22: run DB maintenance (DLQ cleanup, etc.) once per day.
const MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;

let intervalHandle = null;
let maintenanceHandle = null;

import { getRedisClient } from "../../infrastructure/cache/redisClient.js";

const LOCK_KEY = "scheduler:lock";
// Subscription expiry sweeps must NEVER share the scheduler lock: a long
// subscription sweep would otherwise block test state transitions (and vice
// versa). Subscription callers use SUBSCRIPTION_LOCK_KEY independently.
export const SUBSCRIPTION_LOCK_KEY = "subscription:lock";
const LOCK_TTL_MS = 55_000; // Slightly less than CHECK_INTERVAL_MS

// Overlap guard: a slow sweep must never stack with the next tick, even on
// a single instance where the Redis lock is a no-op (redis null).
let isProcessing = false;

const processTransitions = async () => {
  if (isProcessing) return;
  isProcessing = true;
  const redis = getRedisClient();
  let lockAcquired = false;
  try {
    if (redis) {
      // Attempt to acquire distributed lock
      const locked = await redis.set(
        LOCK_KEY,
        "locked",
        "PX",
        LOCK_TTL_MS,
        "NX",
      );
      if (!locked) {
        isProcessing = false;
        return;
      } // Another instance holds the lock
      lockAcquired = true;
    }

    const now = new Date().toISOString();

    for (const t of TRANSITION_MAP) {
      try {
        const tests = await dbHelpers.find("tests", {
          status: t.from,
          isActive: true,
        });
        for (const test of tests) {
          let targetFieldValue =
            test[t.field] ||
            test[t.field.replace("At", "_at")] ||
            test.startTime ||
            test.start_time;
          if (t.to === "expired" && !targetFieldValue) {
            targetFieldValue =
              test.endTime ||
              test.end_time ||
              test.scheduledEnd ||
              test.scheduled_end ||
              test.dateEnd ||
              test.date_end;
          }
          if (!targetFieldValue || targetFieldValue > now) continue;

          // Authoritative transition check (mirrors test.service.js transitionState):
          // canTransition enforces the allowed edge, validateTransition enforces guards.
          if (!testStateMachine.canTransition(test.status, t.to)) {
            logger.warn(
              `[TestScheduler] Invalid transition for test ${test.id} from ${test.status} → ${t.to}`,
            );
            continue;
          }
          const guardError = testStateMachine.validateTransition(test, t.to);
          if (guardError) {
            logger.warn(
              `[TestScheduler] Guard blocked transition for test ${test.id} from ${test.status} → ${t.to}: ${guardError}`,
            );
            continue;
          }

          await dbHelpers.updateById("tests", test.id || test._id, {
            status: t.to,
            [`${t.to}At`]: now,
            is_live: t.to === "live",
            stateUpdatedBy: null,
          });
          logger.info(
            `[TestScheduler] Auto-transitioned test ${test.id} from ${t.from} → ${t.to} (is_live: ${t.to === "live"})`,
          );
        }
      } catch (err) {
        logger.error(
          `[TestScheduler] Error processing ${t.from}→${t.to}:`,
          err.message,
        );
      }
    }
  } finally {
    // Release the distributed lock so the next tick never waits out the
    // full TTL after a fast sweep; TTL remains as the crash-safety net.
    if (redis && lockAcquired) {
      try {
        await redis.del(LOCK_KEY);
      } catch {
        /* best-effort */
      }
    }
    isProcessing = false;
  }
};

export const startScheduler = () => {
  if (intervalHandle) return;
  processTransitions();
  intervalHandle = setInterval(processTransitions, CHECK_INTERVAL_MS);
  // M22: lightweight daily maintenance (idempotent; never throws).
  maintenanceHandle = setInterval(
    runDatabaseMaintenance,
    MAINTENANCE_INTERVAL_MS,
  );
  runDatabaseMaintenance();
  logger.info("[TestScheduler] Started (interval: 60s)");
};

export const stopScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (maintenanceHandle) {
    clearInterval(maintenanceHandle);
    maintenanceHandle = null;
  }
  logger.info("[TestScheduler] Stopped");
};

export const testScheduler = { startScheduler, stopScheduler };
