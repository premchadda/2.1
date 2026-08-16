/**
 * Audit Trail Manager
 * Provides consistent audit logging across all database operations
 */

import { Pool } from 'pg';

class AuditTrailManager {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Log an audit event
   * @param {Object} params
   * @param {number} params.userId - Integer user ID
   * @param {string} params.action - Action performed (CREATE, UPDATE, DELETE, etc.)
   * @param {string} params.resource - Resource type (e.g., 'users', 'tests')
   * @param {string|number} params.resourceId - Resource identifier
   * @param {Object} [params.oldValues] - Previous state (for updates/deletes)
   * @param {Object} [params.newValues] - New state (for creates/updates)
   * @param {string} [params.description] - Human-readable description
   * @param {string} [params.ipAddress] - Client IP address
   * @param {string} [params.userAgent] - User agent string
   * @param {string} [params.status] - 'success' or 'failure'
   * @returns {Promise<string>} Audit log ID (UUID)
   */
  async log({
    userId,
    action,
    resource,
    resourceId,
    oldValues = null,
    newValues = null,
    description = null,
    ipAddress = null,
    userAgent = null,
    status = 'success',
  }, client = null) {
    try {
      const query = `
        SELECT log_audit_event(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) as audit_id
      `;
      const params = [
        userId,
        action,
        resource,
        String(resourceId),
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        description,
        ipAddress,
        userAgent,
        status,
      ];

      const db = client || this.pool;
      const result = await db.query(query, params);
      return result.rows[0]?.audit_id;
    } catch (error) {
      console.error('Audit logging failed:', error);
      throw error;
    }
  }

  /**
   * Log CREATE action
   */
  async logCreate({ userId, resource, resourceId, data, ipAddress, userAgent }, client = null) {
    return this.log({
      userId,
      action: 'CREATE',
      resource,
      resourceId,
      newValues: data,
      description: `Created new ${resource} record`,
      ipAddress,
      userAgent,
    }, client);
  }

  /**
   * Log UPDATE action
   */
  async logUpdate({
    userId,
    resource,
    resourceId,
    oldValues,
    newValues,
    ipAddress,
    userAgent,
  }, client = null) {
    return this.log({
      userId,
      action: 'UPDATE',
      resource,
      resourceId,
      oldValues,
      newValues,
      description: `Updated ${resource} record`,
      ipAddress,
      userAgent,
    }, client);
  }

  /**
   * Log DELETE action
   */
  async logDelete({ userId, resource, resourceId, oldValues, ipAddress, userAgent }, client = null) {
    return this.log({
      userId,
      action: 'DELETE',
      resource,
      resourceId,
      oldValues,
      description: `Deleted ${resource} record`,
      ipAddress,
      userAgent,
    }, client);
  }

  /**
   * Log soft-delete action
   */
  async logSoftDelete({ userId, resource, resourceId, oldValues, ipAddress, userAgent }, client = null) {
    return this.log({
      userId,
      action: 'SOFT_DELETE',
      resource,
      resourceId,
      oldValues,
      description: `Soft-deleted ${resource} record`,
      ipAddress,
      userAgent,
    }, client);
  }

  /**
   * Get audit logs for a resource
   */
  async getAuditLogsForResource(resource, resourceId, limit = 50) {
    const query = `
      SELECT id, user_id, admin_id, action, table_name, record_id, old_data, new_data, ip_address, user_agent, created_at, resource, resource_id, description, status, request_method, request_path, response_status_code, admin_email, admin_name, details, entity_id, old_values, new_values FROM audit_logs
      WHERE resource = $1 AND resource_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    const result = await this.pool.query(query, [resource, String(resourceId), limit]);
    return result.rows;
  }

  /**
   * Get audit logs for a user
   */
  async getAuditLogsForUser(userId, limit = 50) {
    const query = `
      SELECT id, user_id, admin_id, action, table_name, record_id, old_data, new_data, ip_address, user_agent, created_at, resource, resource_id, description, status, request_method, request_path, response_status_code, admin_email, admin_name, details, entity_id, old_values, new_values FROM audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await this.pool.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Search audit logs with filters
   */
  async searchAuditLogs({
    resource,
    action,
    userId,
    startDate,
    endDate,
    status,
    limit = 100,
    offset = 0,
  } = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (resource) {
      conditions.push(`resource = $${paramIndex++}`);
      params.push(resource);
    }

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }

    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT id, user_id, admin_id, action, table_name, record_id, old_data, new_data, ip_address, user_agent, created_at, resource, resource_id, description, status, request_method, request_path, response_status_code, admin_email, admin_name, details, entity_id, old_values, new_values FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex}
    `;
    params.push(limit);
    params.push(offset);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(startDate, endDate) {
    const query = `
      SELECT 
        resource,
        action,
        status,
        COUNT(*) as count,
        MIN(created_at) as first_occurrence,
        MAX(created_at) as last_occurrence
      FROM audit_logs
      WHERE ($1::timestamp IS NULL OR created_at >= $1)
        AND ($2::timestamp IS NULL OR created_at <= $2)
      GROUP BY resource, action, status
      ORDER BY count DESC
    `;

    const result = await this.pool.query(query, [startDate || null, endDate || null]);
    return result.rows;
  }

  /**
   * Clean old audit logs (retention policy)
   */
  async cleanOldAuditLogs(olderThanDays = 365) {
    const days = Math.max(30, parseInt(olderThanDays)); // safety: never delete < 30 days
    const query = `
      DELETE FROM audit_logs
      WHERE created_at < NOW() - make_interval(days => $1)
      AND status = 'success'
    `;
    const result = await this.pool.query(query, [days]);
    return result.rowCount;
  }
}

export default AuditTrailManager;
