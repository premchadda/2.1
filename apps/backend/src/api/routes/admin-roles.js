import express from "express";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { pool } from "../../infrastructure/database/postgres-helpers.js";
import { invalidateAdminPermissionsCache } from "../../middleware/admin-permission.middleware.js";
import logger from "../../infrastructure/logger/logger.js";

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(protect);
router.use(admin);

/**
 * GET /admin/permissions
 * Get all available permissions
 * Public endpoint (within admin context) - lists all permissions for UI selection
 */
router.get("/permissions", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        id,
        name,
        resource,
        action,
        description,
        created_at
       FROM permissions
       ORDER BY resource ASC, action ASC`,
    );

    // Group permissions by resource
    const groupedPermissions = {};
    rows.forEach((permission) => {
      if (!groupedPermissions[permission.resource]) {
        groupedPermissions[permission.resource] = [];
      }
      groupedPermissions[permission.resource].push({
        id: permission.id,
        name: permission.name,
        action: permission.action,
        description: permission.description,
      });
    });

    res.json({
      success: true,
      data: {
        permissions: rows,
        grouped: groupedPermissions,
        total: rows.length,
      },
    });
  } catch (error) {
    logger.error("Get permissions error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * GET /admin/roles
 * Get all roles with their permissions and user counts
 */
router.get("/roles", async (req, res) => {
  try {
    const rolesQuery = `
      SELECT 
        r.id,
        r.name,
        r.description,
        r.created_at,
        r.updated_at,
        COUNT(DISTINCT ur.user_id) as user_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'resource', p.resource,
              'action', p.action
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) as permissions
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      GROUP BY r.id, r.name, r.description, r.created_at, r.updated_at
      ORDER BY r.created_at DESC
    `;

    const { rows } = await pool.query(rolesQuery);

    res.json({
      success: true,
      data: {
        roles: rows,
        total: rows.length,
      },
    });
  } catch (error) {
    logger.error("Get roles error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

async function resolvePermissionIds(client, permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) return [];
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const rawValues = permissions
    .map((p) => {
      if (typeof p === "string") return p.trim();
      if (p && typeof p === "object")
        return (p.id || p.name || `${p.resource}:${p.action}`).trim();
      return String(p);
    })
    .filter(Boolean);

  const directUuids = rawValues.filter((v) => uuidRegex.test(v));
  const nameKeys = rawValues.filter((v) => !uuidRegex.test(v));

  const resolved = new Set(directUuids);

  if (nameKeys.length > 0) {
    const lookup = await client.query(
      `SELECT id, name, resource, action FROM permissions 
       WHERE name = ANY($1) 
          OR (resource || ':' || action) = ANY($1)`,
      [nameKeys],
    );
    lookup.rows.forEach((r) => resolved.add(r.id));
  }

  return Array.from(resolved);
}

/**
 * POST /admin/roles
 * Create a new role with permissions
 * Requires admin privileges
 */
router.post("/roles", protect, admin, async (req, res) => {
  const { name, description, permissions } = req.body;

  // Validation
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Role name is required",
    });
  }

  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({
      success: false,
      error: "At least one permission is required",
    });
  }

  // Wildcard guard: creating a role that carries "*" requires the granter
  // to hold "*" themselves (single-admin model, no role-name bypass).
  const wantsWildcard = permissions.some((p) => {
    if (typeof p === "string") return p.trim() === "*";
    if (p && typeof p === "object") {
      return (
        p.name === "*" || p.id === "*" || `${p.resource}:${p.action}` === "*:*"
      );
    }
    return false;
  });
  if (wantsWildcard) {
    const granterHasWildcard = await (async () => {
      if ((req.user?.permissions || []).includes("*")) return true;
      try {
        const { rows } = await pool.query(
          `SELECT DISTINCT p.name
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = $1`,
          [req.user.id],
        );
        return rows.some((r) => r.name === "*");
      } catch {
        return false;
      }
    })();
    if (!granterHasWildcard) {
      return res.status(403).json({
        success: false,
        error: "Wildcard grant requires wildcard permission",
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if role name already exists
    const existingRole = await client.query(
      "SELECT id FROM roles WHERE name = $1",
      [name.toLowerCase()],
    );

    if (existingRole.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        error: "Role name already exists",
      });
    }

    // Create role
    const roleResult = await client.query(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at`,
      [name.toLowerCase(), description || null],
    );

    const roleId = roleResult.rows[0].id;

    // Assign permissions to role
    const resolvedPermIds = await resolvePermissionIds(client, permissions);
    if (resolvedPermIds.length > 0) {
      const permissionValues = resolvedPermIds
        .map((_, index) => `($1, $${index + 2})`)
        .join(", ");

      const permissionParams = [roleId, ...resolvedPermIds];

      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ${permissionValues}`,
        permissionParams,
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      data: roleResult.rows[0],
      message: "Role created successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Create role error:", error);

    if (error.code === "23505") {
      // Unique violation
      return res.status(409).json({
        success: false,
        error: "Role name already exists",
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /admin/roles/:id
 * Update role name, description, and permissions
 * Requires admin privileges
 */
router.put("/roles/:id", protect, admin, async (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if role exists
    const existingRole = await client.query(
      "SELECT id, name FROM roles WHERE id = $1",
      [id],
    );

    if (existingRole.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: "Role not found",
      });
    }

    const currentName = existingRole.rows[0].name;

    // Update role name and description if provided
    if (name && name.toLowerCase() !== currentName) {
      // Check if new name already exists
      const nameCheck = await client.query(
        "SELECT id FROM roles WHERE name = $1 AND id != $2",
        [name.toLowerCase(), id],
      );

      if (nameCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          error: "Role name already exists",
        });
      }

      await client.query(
        "UPDATE roles SET name = $1, description = $2, updated_at = NOW() WHERE id = $3",
        [name.toLowerCase(), description || null, id],
      );
    } else if (description !== undefined) {
      await client.query(
        "UPDATE roles SET description = $1, updated_at = NOW() WHERE id = $2",
        [description, id],
      );
    }

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      // Wildcard guard (same rule as role creation above).
      const updateWantsWildcard = permissions.some((p) => {
        if (typeof p === "string") return p.trim() === "*";
        if (p && typeof p === "object") {
          return (
            p.name === "*" ||
            p.id === "*" ||
            `${p.resource}:${p.action}` === "*:*"
          );
        }
        return false;
      });
      if (updateWantsWildcard) {
        let granterHasWildcard = (req.user?.permissions || []).includes("*");
        if (!granterHasWildcard) {
          try {
            const { rows } = await client.query(
              `SELECT DISTINCT p.name
               FROM user_roles ur
               JOIN role_permissions rp ON rp.role_id = ur.role_id
               JOIN permissions p ON p.id = rp.permission_id
               WHERE ur.user_id = $1`,
              [req.user.id],
            );
            granterHasWildcard = rows.some((r) => r.name === "*");
          } catch {
            granterHasWildcard = false;
          }
        }
        if (!granterHasWildcard) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            success: false,
            error: "Wildcard grant requires wildcard permission",
          });
        }
      }
      // Delete existing permissions
      await client.query("DELETE FROM role_permissions WHERE role_id = $1", [
        id,
      ]);

      // Insert new permissions
      const resolvedPermIds = await resolvePermissionIds(client, permissions);
      if (resolvedPermIds.length > 0) {
        const permissionValues = resolvedPermIds
          .map((_, index) => `($1, $${index + 2})`)
          .join(", ");

        const permissionParams = [id, ...resolvedPermIds];

        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ${permissionValues}`,
          permissionParams,
        );
      }
    }

    const { rows: updatedRows } = await client.query(
      "SELECT * FROM roles WHERE id = $1",
      [id],
    );
    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Role updated successfully",
      data: updatedRows[0] || null,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Update role error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "Role name already exists",
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /admin/roles/:id
 * Delete a role
 * Requires admin privileges
 * Prevents deletion of roles that have users assigned
 */
router.delete("/roles/:id", protect, admin, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if role exists
    const existingRole = await client.query(
      "SELECT id, name FROM roles WHERE id = $1",
      [id],
    );

    if (existingRole.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: "Role not found",
      });
    }

    // Check if role has users assigned
    const userCountResult = await client.query(
      "SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1",
      [id],
    );

    const userCount = parseInt(userCountResult.rows[0].count);

    if (userCount > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: `Cannot delete role. It has ${userCount} user(s) assigned. Please reassign or remove users first.`,
      });
    }

    // Delete role permissions first
    await client.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);

    // Delete role
    await client.query("DELETE FROM roles WHERE id = $1", [id]);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Delete role error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  } finally {
    client.release();
  }
});

/**
 * GET /admin/roles/:id/users
 * Get all users assigned to a specific role
 */
router.get("/roles/:id/users", async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Get total count
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM user_roles WHERE role_id = $1",
      [id],
    );

    const total = parseInt(countResult.rows[0].count);

    // Get users
    const usersQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.created_at,
        ur.created_at as assigned_at
      FROM user_roles ur
      JOIN users u ON ur.user_id = u.id
      WHERE ur.role_id = $1
      ORDER BY ur.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await pool.query(usersQuery, [
      id,
      parseInt(limit),
      offset,
    ]);

    res.json({
      success: true,
      data: {
        users: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Get role users error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * POST /admin/roles/:id/assign
 * Assign role to users
 */
router.post("/roles/:id/assign", protect, admin, async (req, res) => {
  const { id } = req.params;
  const { user_ids } = req.body;

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: "user_ids array is required",
    });
  }

  // Block self-assign: an admin must not grant roles to their own account
  // through this endpoint (prevents privilege self-escalation).
  if (user_ids.map(String).includes(String(req.user?.id))) {
    return res.status(403).json({
      success: false,
      error: "Cannot assign roles to your own account",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if role exists
    const roleExists = await client.query(
      "SELECT id FROM roles WHERE id = $1",
      [id],
    );

    if (roleExists.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: "Role not found",
      });
    }

    // Block wildcard-powerful grants: if the target role carries the "*"
    // permission, the granter must hold "*" themselves.
    const rolePerms = await client.query(
      `SELECT p.name FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1`,
      [id],
    );
    const grantsWildcard = rolePerms.rows.some((r) => r.name === "*");
    const granterPerms = req.user?.permissions || [];
    if (granterPerms.length === 0) {
      try {
        const { rows: granterRows } = await client.query(
          `SELECT DISTINCT p.name
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = $1`,
          [req.user.id],
        );
        granterPerms.push(...granterRows.map((r) => r.name));
      } catch (grantErr) {
        // Non-fatal: default to the empty set so a wildcard grant stays denied.
        console.warn(
          "[Roles] Failed to load granter permissions (defaulting to none):",
          grantErr?.message,
        );
      }
    }
    // No explicit grants means the default admin tier, which never includes
    // "*", so a wildcard grant is denied below.
    if (grantsWildcard && !granterPerms.includes("*")) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        error: "Wildcard grant requires wildcard permission",
      });
    }

    // Assign role to users (ignore duplicates)
    const values = user_ids
      .map((userId, index) => `($1, $${index + 2})`)
      .join(", ");

    const params = [id, ...user_ids];

    await client.query(
      `INSERT INTO user_roles (role_id, user_id)
       VALUES ${values}
       ON CONFLICT (role_id, user_id) DO NOTHING`,
      params,
    );

    await client.query("COMMIT");

    // Invalidate cached permissions so the grant takes effect immediately.
    for (const uid of user_ids) {
      invalidateAdminPermissionsCache(String(uid));
    }

    res.json({
      success: true,
      message: `Role assigned to ${user_ids.length} user(s)`,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Assign role error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /admin/roles/:id/unassign
 * Remove role from users
 */
router.delete("/roles/:id/unassign", protect, admin, async (req, res) => {
  const { id } = req.params;
  const { user_ids } = req.body;

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: "user_ids array is required",
    });
  }

  try {
    const placeholders = user_ids.map((_, index) => `$${index + 2}`).join(", ");
    const params = [id, ...user_ids];

    await pool.query(
      `DELETE FROM user_roles 
       WHERE role_id = $1 
       AND user_id IN (${placeholders})`,
      params,
    );

    for (const uid of user_ids) {
      invalidateAdminPermissionsCache(String(uid));
    }

    res.json({
      success: true,
      message: `Role removed from ${user_ids.length} user(s)`,
    });
  } catch (error) {
    logger.error("Unassign role error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

export default router;
