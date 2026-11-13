/**
 * DPDP Act 2023 Account Purge Worker
 *
 * Implements statutory personal data erasure under India's Digital Personal
 * Data Protection (DPDP) Act 2023:
 * - Section 8(7): Retention Limitation (personal data must be erased once purpose is served)
 * - Section 12(3): Right to Erasure upon withdrawal of consent
 *
 * Workflow:
 * 1. User requests deletion in DELETE /api/users/profile, which marks:
 *    deletion_requested = true, deletion_date = NOW() + 7 days (grace period)
 * 2. This worker queries users where:
 *    (deletion_requested = true OR deletion_requested = 'true')
 *    AND deletion_date IS NOT NULL
 *    AND deletion_date <= NOW()
 * 3. Securely purges personal data, clears active sessions/tokens, anonymizes
 *    audit logs (preserving non-PII operational integrity), and deletes the user record.
 */

import { pool } from "../infrastructure/database/postgres-helpers.js";
import { getRedisClient } from "../infrastructure/cache/redisClient.js";
import logger from "../infrastructure/logger/logger.js";

let purgeIntervalHandle = null;

/**
 * Execute secure purging for a single user account in an isolated transaction.
 */
export async function purgeSingleUser(client, user) {
  const userId = user.id;

  // 1. Invalidate & remove all active sessions
  await client.query("DELETE FROM user_sessions WHERE user_id = $1", [userId]);

  // 2. Anonymize audit logs (retain security event trail without personal data linkage)
  try {
    await client.query(
      `UPDATE audit_logs 
       SET user_id = NULL,
           admin_email = NULL,
           admin_name = NULL,
           details = CASE 
             WHEN details IS NOT NULL THEN details - 'email' - 'phone' - 'mobile' - 'name'
             ELSE NULL 
           END
       WHERE user_id = $1`,
      [userId],
    );
  } catch (auditErr) {
    logger.warn(`[DPDP Purge] Anonymizing audit logs warning for user ${userId}:`, auditErr.message);
  }

  // 3. Nullify audit/creator NO ACTION foreign keys that would block deletion
  const noActionTables = [
    { table: "study_groups", column: "user_id" },
    { table: "tests", column: "state_updated_by" },
    { table: "tests", column: "reviewed_by" },
    { table: "questions", column: "reviewed_by" },
    { table: "questions", column: "submitted_by" },
  ];

  for (const { table, column } of noActionTables) {
    try {
      await client.query(
        `UPDATE ${table} SET ${column} = NULL WHERE ${column} = $1`,
        [userId],
      );
    } catch {
      // Best effort in case table or column does not exist in schema
    }
  }

  // 4. Cascade delete dependent student records (bookmarks, recommendations, notifications, sessions)
  const userDependentTables = [
    "user_recommendations",
    "user_achievements",
    "bookmarks",
    "notifications",
    "device_tokens",
    "user_sessions",
  ];

  for (const table of userDependentTables) {
    try {
      const safeTable = table.replace(/[^a-zA-Z0-9_]/g, "");
      const deleteSql = 'DELETE FROM "' + safeTable + '" WHERE user_id = $1';
      await client.query(deleteSql, [userId]);
    } catch {
      // Table may not exist or already dropped
    }
  }

  // 5. Delete the user row permanently
  const deleteResult = await client.query(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [userId],
  );

  // 6. Record compliance audit record of statutory erasure
  try {
    await client.query(
      `INSERT INTO audit_logs (
        action, entity_type, entity_id, status, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        "DPDP_ACCOUNT_PURGED",
        "user",
        String(userId),
        "success",
        JSON.stringify({
          purgedAt: new Date().toISOString(),
          compliance: "DPDP Act 2023 Section 8(7) / 12(3)",
          originalDeletionRequestedDate: user.deletion_date || user.deletionDate,
        }),
      ],
    );
  } catch (logErr) {
    logger.warn(`[DPDP Purge] Could not write audit log for user ${userId}:`, logErr.message);
  }

  // 7. Clear Redis caches / keys if redis is ready
  const redis = getRedisClient();
  if (redis && redis.status === "ready") {
    try {
      const keys = await redis.keys(`*${userId}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Best-effort cache cleanup
    }
  }

  return deleteResult.rowCount > 0;
}

/**
 * Queries users where deletionRequested = true AND deletionDate <= NOW()
 * and executes secure data purging.
 *
 * @param {Object} options
 * @param {number} [options.batchSize=50] - Number of records to process per batch
 * @param {boolean} [options.dryRun=false] - If true, only reports records to be purged
 * @returns {Promise<{ success: boolean, totalFound: number, purgedCount: number, failedCount: number, errors: Array }>}
 */
export async function purgeExpiredAccounts(options = {}) {
  const batchSize = Math.max(1, Math.min(500, Number(options.batchSize) || 50));
  const dryRun = Boolean(options.dryRun);

  logger.info(`[DPDP Purge] Starting account purge run (batchSize: ${batchSize}, dryRun: ${dryRun})...`);

  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    logger.error("[DPDP Purge] Failed to acquire database client:", connErr.message);
    return {
      success: false,
      totalFound: 0,
      purgedCount: 0,
      failedCount: 0,
      errors: [connErr.message],
    };
  }

  try {
    // Query users where deletion has been requested and grace period has elapsed
    const query = `
      SELECT id, email, phone, mobile, deletion_date, created_at
      FROM users
      WHERE (deletion_requested = true OR deletion_requested = 'true')
        AND deletion_date IS NOT NULL
        AND deletion_date <= NOW()
      ORDER BY deletion_date ASC
      LIMIT $1
    `;
    const { rows: expiredUsers } = await client.query(query, [batchSize]);

    logger.info(`[DPDP Purge] Found ${expiredUsers.length} user account(s) due for permanent erasure.`);

    if (dryRun) {
      return {
        success: true,
        totalFound: expiredUsers.length,
        purgedCount: 0,
        failedCount: 0,
        dryRunUsers: expiredUsers.map((u) => ({ id: u.id, deletionDate: u.deletion_date })),
        errors: [],
      };
    }

    let purgedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const user of expiredUsers) {
      try {
        await client.query("BEGIN");
        await purgeSingleUser(client, user);
        await client.query("COMMIT");
        purgedCount++;
        logger.info(`[DPDP Purge] Successfully purged user ID ${user.id} in compliance with DPDP Act 2023.`);
      } catch (userErr) {
        await client.query("ROLLBACK");
        failedCount++;
        errors.push({ userId: user.id, error: userErr.message });
        logger.error(`[DPDP Purge] Failed to purge user ID ${user.id}:`, userErr.message);
      }
    }

    logger.info(
      `[DPDP Purge] Account purge completed. Purged: ${purgedCount}, Failed: ${failedCount}.`,
    );

    return {
      success: true,
      totalFound: expiredUsers.length,
      purgedCount,
      failedCount,
      errors,
    };
  } catch (error) {
    logger.error("[DPDP Purge] Unhandled exception during account purge run:", error.message);
    return {
      success: false,
      totalFound: 0,
      purgedCount: 0,
      failedCount: 0,
      errors: [error.message],
    };
  } finally {
    client.release();
  }
}

/**
 * Start periodic DPDP account purge cron.
 * Defaults to once every 24 hours.
 */
export function startAccountPurgeCron(intervalMs = 24 * 60 * 60 * 1000) {
  if (purgeIntervalHandle) {
    clearInterval(purgeIntervalHandle);
  }

  // Run initial pass shortly after boot (e.g. after 30 seconds)
  setTimeout(() => {
    purgeExpiredAccounts().catch((e) =>
      logger.warn(`[DPDP Purge] Initial background pass failed: ${e.message}`),
    );
  }, 30 * 1000).unref();

  purgeIntervalHandle = setInterval(() => {
    purgeExpiredAccounts().catch((e) =>
      logger.warn(`[DPDP Purge] Scheduled run failed: ${e.message}`),
    );
  }, intervalMs);

  purgeIntervalHandle.unref();
  logger.info(`[DPDP Purge] Purge cron scheduled every ${Math.round(intervalMs / 1000 / 60)} minutes.`);
}

/**
 * Stop periodic DPDP account purge cron.
 */
export function stopAccountPurgeCron() {
  if (purgeIntervalHandle) {
    clearInterval(purgeIntervalHandle);
    purgeIntervalHandle = null;
    logger.info("[DPDP Purge] Purge cron stopped.");
  }
}

// Allow direct CLI invocation: `node src/workers/accountPurgeWorker.js`
if (
  process.argv[1] &&
  (process.argv[1].endsWith("accountPurgeWorker.js") ||
    process.argv[1].includes("accountPurgeWorker"))
) {
  logger.info("[DPDP Purge] Running direct CLI execution...");
  purgeExpiredAccounts()
    .then((result) => {
      logger.info("[DPDP Purge] CLI run result:", result);
      process.exit(0);
    })
    .catch((err) => {
      logger.error("[DPDP Purge] CLI run failed:", err);
      process.exit(1);
    });
}

export default {
  purgeExpiredAccounts,
  purgeSingleUser,
  startAccountPurgeCron,
  stopAccountPurgeCron,
};
