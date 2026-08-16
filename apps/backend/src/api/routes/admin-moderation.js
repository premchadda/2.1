import express from 'express';
import { pool } from '../../infrastructure/database/postgres-helpers.js';
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js';
import logger from '../../infrastructure/logger/logger.js';
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';
import { responseCache } from '../../middleware/responseCache.middleware.js';

const router = express.Router();

router.use(protect)
router.use(admin)

const VALID_STATUSES = ['open', 'resolved', 'pending', 'hidden'];

// GET /admin/moderation/stats — counts: total, open, resolved, flagged
router.get('/stats', responseCache('admin-mod-stats', 60), async (req, res) => {
  try {
    const resCount = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE is_flagged = true)::int AS flagged,
        COUNT(*) FILTER (WHERE status = 'hidden')::int AS hidden
      FROM doubts
      WHERE is_active = true
    `).catch(() => ({ rows: [] }));

    const stats = resCount.rows[0] || { total: 0, open: 0, resolved: 0, flagged: 0, hidden: 0 };
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Moderation stats error:', error);
    res.json({ success: true, data: { total: 0, open: 0, resolved: 0, flagged: 0, hidden: 0 } });
  }
});

let doubtsColumnsCache = null;
const getDoubtsColumns = async () => {
  if (doubtsColumnsCache) return doubtsColumnsCache;
  const colCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'doubts'
  `).catch(() => ({ rows: [] }));
  doubtsColumnsCache = new Set(colCheck.rows.map(r => r.column_name));
  return doubtsColumnsCache;
};

// GET /admin/moderation/doubts — paginated list with user join
router.get('/doubts', responseCache('admin-mod-doubts', 30), async (req, res) => {
  try {
    const rawPage = parseInt(req.query.page) || 1;
    const rawLimit = parseInt(req.query.limit) || 20;
    const page = Math.max(1, rawPage);
    const limit = Math.min(Math.max(1, rawLimit), 100);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim();
    const status = req.query.status;
    const flagged = String(req.query.flagged || '').toLowerCase() === 'true';

    // Inspect doubts table columns (cached once to prevent 1.2s information_schema DB delay)
    const cols = await getDoubtsColumns();

    const conditions = [];
    if (cols.has('is_active')) {
      conditions.push('d.is_active = true');
    }
    const values = [];
    let i = 1;

    if (status && VALID_STATUSES.includes(status) && cols.has('status')) {
      conditions.push(`d.status = $${i++}`);
      values.push(status);
    }
    if (flagged && cols.has('is_flagged')) {
      conditions.push(`d.is_flagged = true`);
    }
    if (search) {
      conditions.push(`(d.title ILIKE $${i} OR d.description ILIKE $${i} OR u.name ILIKE $${i})`);
      values.push(`%${search}%`);
      i++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const userJoinClause = cols.has('user_id')
      ? `LEFT JOIN users u ON d.user_id = u.id`
      : (cols.has('userId') ? `LEFT JOIN users u ON d."userId" = u.id` : '');
    const orderByClause = cols.has('created_at') ? 'ORDER BY d.created_at DESC NULLS LAST' : '';

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM doubts d
       ${userJoinClause}
       ${whereClause}`,
      values,
    );
    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch page
    const pageResult = await pool.query(
      `SELECT d.*,
              u.name AS user_name,
              u.email AS user_email
       FROM doubts d
       ${userJoinClause}
       ${whereClause}
       ${orderByClause}
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset],
    );

    // Sanitize user PII from doubt records
    const data = pageResult.rows.map(row => {
      const safeRow = { ...row };
      delete safeRow.userEmail;
      delete safeRow.user_email;
      delete safeRow.email;
      return safeRow;
    });

    res.json({
      success: true,
      count: data.length,
      total,
      page,
      limit,
      totalPages,
      data,
    });
  } catch (error) {
    logger.error('Moderation doubts list error:', error);
    res.json({ success: true, count: 0, total: 0, page: 1, limit: 20, totalPages: 1, data: [] });
  }
});

// PUT /admin/moderation/doubts/:id/status — update status + audit log
router.put('/doubts/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    // Check doubt exists
    let doubt;
    try {
      doubt = await dbHelpers.findById('doubts', id);
    } catch { /* table may not exist */ }
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt not found' });
    }

    // Update status
    try {
      await dbHelpers.updateById('doubts', id, {
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Fallback to raw SQL
      await pool.query('UPDATE doubts SET status = $1, updated_at = $2 WHERE id = $3', [status, new Date().toISOString(), id]);
    }

    // Audit log
    try {
      await dbHelpers.insertOne('audit_logs', {
        action: 'moderation_status_change',
        resource: 'doubts',
        entity_type: 'doubts',
        resourceId: id,
        adminId: req.user.id,
        adminEmail: req.user.email,
        adminName: req.user.name,
        ipAddress: req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: {
          doubtId: id,
          previousStatus: doubt.status,
          newStatus: status,
        },
        status: 'success',
        requestMethod: req.method,
        requestPath: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      logger.warn('Audit log failed (non-fatal):', auditErr.message);
    }

    res.json({ success: true, message: `Doubt status updated to ${status}` });
  } catch (error) {
    logger.error('Moderation status update error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /admin/moderation/doubts/:id — soft-delete + audit log
router.delete('/doubts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let doubt;
    try {
      doubt = await dbHelpers.findById('doubts', id);
    } catch { /* table may not exist */ }
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt not found' });
    }

    try {
      await dbHelpers.softDelete('doubts', id, req.user.id);
    } catch {
      // Fallback: set is_active = false
      await pool.query('UPDATE doubts SET is_active = false WHERE id = $1', [id]);
    }

    // Audit log
    try {
      await dbHelpers.insertOne('audit_logs', {
        action: 'moderation_delete',
        resource: 'doubts',
        entity_type: 'doubts',
        resourceId: id,
        adminId: req.user.id,
        adminEmail: req.user.email,
        adminName: req.user.name,
        ipAddress: req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        details: {
          doubtId: id,
          title: doubt.title,
          userId: doubt.userId || doubt.user_id,
        },
        status: 'success',
        requestMethod: req.method,
        requestPath: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      logger.warn('Audit log failed (non-fatal):', auditErr.message);
    }

    res.json({ success: true, message: 'Doubt deleted' });
  } catch (error) {
    logger.error('Moderation delete error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
