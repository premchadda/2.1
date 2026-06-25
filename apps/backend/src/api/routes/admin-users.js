import express from 'express';
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js';
import { findEntityByIdentifier } from '../../shared/utils/identifier-utils.js';
import { invalidateSession } from '../../services/SessionCaptureService.js';

const router = express.Router();

const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, salt, resetPasswordToken, resetPasswordExpires, ...safeUser } = user;
  return safeUser;
};

// List users with pagination
router.get('/users', async (req, res) => {
  try {
    const rawPage = parseInt(req.query.page) || 1;
    const rawLimit = parseInt(req.query.limit) || 20;
    const page = Math.max(1, rawPage);
    const limit = Math.min(Math.max(1, rawLimit), 100); // Max 100 per page
    const offset = (page - 1) * limit;
    const search = req.query.search?.toLowerCase();

    const allUsers = await dbHelpers.find('users', { isActive: true });
    let filteredUsers = allUsers;

    // Apply search filter
    if (search) {
      filteredUsers = filteredUsers.filter(u =>
        (u.name?.toLowerCase().includes(search)) ||
        (u.email?.toLowerCase().includes(search)) ||
        (u.phone?.toLowerCase().includes(search))
      );
    }

    // Sort by created date descending
    filteredUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);
    const sanitized = paginatedUsers.map(sanitizeUser);

    res.json({
      success: true,
      count: sanitized.length,
      total,
      page,
      limit,
      totalPages,
      data: sanitized
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.put('/users/:id/pro-pass', async (req, res) => {
  try {
    const { isProUser, proPassExpiry, passType } = req.body;
    const user = await dbHelpers.findById('users', req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    const expiry = isProUser
      ? proPassExpiry ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const updated = await dbHelpers.updateById('users', req.params.id, {
      isProUser: !!isProUser,
      proPassExpiry: expiry,
      pass_type: isProUser ? (passType || 'pro_yearly') : 'free',
    });
    res.json({ success: true, data: sanitizeUser(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update user status (active/inactive)
router.put('/users/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res
        .status(400)
        .json({ success: false, message: 'isActive must be a boolean value' });
    }
    const user = await dbHelpers.findById('users', req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    const updated = await dbHelpers.updateById('users', req.params.id, {
      isActive,
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, data: sanitizeUser(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update user role - restricted to super_admin for privilege changes
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'user', 'super_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role required (admin, user, or super_admin)',
      });
    }
    const user = await dbHelpers.findById('users', req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    const previousRole = user.role;
    const isPromotingToAdmin = (role === 'admin' || role === 'super_admin') && previousRole === 'user';
    const isPromotingToSuperAdmin = role === 'super_admin' && previousRole !== 'super_admin';
    const isDemotingFromAdmin = (role === 'user') && (previousRole === 'admin' || previousRole === 'super_admin');

    // Prevent self-demotion
    if (String(req.user.id) === String(req.params.id) && role === 'user') {
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own admin role',
      });
    }

    // SECURITY: Role changes involving admin/super_admin roles require super_admin
    const isPrivilegeChange = isPromotingToAdmin || isDemotingFromAdmin || isPromotingToSuperAdmin;

    if (isPrivilegeChange) {
      if (!req.user.isSuperAdmin) {
        console.warn(`[SECURITY] Privilege escalation blocked: User ${req.user.id} (${req.user.email}, role: ${req.user.role}) ` +
          `attempted to change role of user ${user.id} (${user.email}) from ${previousRole} to ${role}`);

        await dbHelpers.insertOne('audit_logs', {
          action: 'privilege_escalation_attempt',
          resource: 'users',
          entity_type: 'users',
          resourceId: user.id,
          adminId: req.user.id,
          adminEmail: req.user.email,
          adminName: req.user.name,
          ipAddress: req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          details: {
            targetUserId: user.id,
            targetUserEmail: user.email,
            previousRole,
            newRole: role,
            blocked: true,
            reason: 'Requires super_admin role',
          },
          status: 'failure',
          requestMethod: req.method,
          requestPath: req.originalUrl,
          timestamp: new Date().toISOString(),
        });

        return res.status(403).json({
          success: false,
          message: 'Role changes for admin users require super_admin privileges',
        });
      }
    }

    // Audit log for role change
    const auditEntry = {
      action: isPrivilegeChange ? 'role_change' : 'update',
      resource: 'users',
      entity_type: 'users',
      resourceId: user.id,
      adminId: req.user.id,
      adminEmail: req.user.email,
      adminName: req.user.name,
      ipAddress: req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      details: {
        targetUserId: user.id,
        targetUserEmail: user.email,
        previousRole,
        newRole: role,
        isPrivilegeChange,
      },
      status: 'success',
      requestMethod: req.method,
      requestPath: req.originalUrl,
      timestamp: new Date().toISOString(),
    };

    const updated = await dbHelpers.updateById('users', req.params.id, {
      role,
      updatedAt: new Date().toISOString(),
    });

    auditEntry.details.successful = true;
    await dbHelpers.insertOne('audit_logs', auditEntry);

    res.json({ success: true, data: sanitizeUser(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete user (soft delete)
router.delete('/users/:id', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }
    const user = await dbHelpers.findById('users', req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    const deleted = await dbHelpers.softDelete(
      'users',
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User moved to trash' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get user's sessions (admin view)
router.get('/users/:id/sessions', async (req, res) => {
  try {
    const userIdParam = req.params.id;
    
    // Try to get internal ID from public_id
    let userId;
    const user = await findEntityByIdentifier(dbHelpers, 'users', userIdParam);
    if (user) {
      userId = user.id || user._id;
    } else {
      // Fall back to numeric ID
      userId = parseInt(userIdParam);
    }
    
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const sessions = await dbHelpers.find('user_sessions', { user_id: userId });
    const formattedSessions = (sessions || []).map(s => ({
      id: s.id,
      sessionId: s.session_id,
      device: s.device_type,
      ip: s.ip_address,
      location: s.city && s.country ? `${s.city}, ${s.country}` : s.country || s.city || 'Unknown',
      lastActive: s.last_active,
      isCurrent: s.is_active,
      browser: s.browser,
      os: s.os,
      createdAt: s.created_at
    }));
    
    formattedSessions.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
    
    res.json({ success: true, data: formattedSessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Revoke user session (admin)
router.delete('/users/:userId/sessions/:sessionId', async (req, res) => {
  try {
    const { userId: userIdParam, sessionId } = req.params;

    // Resolve userId to internal ID
    let userId;
    const user = await findEntityByIdentifier(dbHelpers, 'users', userIdParam);
    if (user) {
      userId = user.id || user._id;
    } else {
      userId = parseInt(userIdParam);
    }

    const session = await dbHelpers.findById('user_sessions', sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (String(session.user_id) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Session does not belong to this user' });
    }

    // Use service to invalidate and emit WebSocket event
    await invalidateSession(sessionId, { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role });

    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;