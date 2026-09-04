import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import {
  protect,
  admin,
  superAdmin,
} from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";

const router = express.Router();

router.use(protect);
router.use(admin);

// NOTE: /navigation CRUD was removed from this router — admin-navigation.js
// is mounted first (admin-routes-index.js) and owns POST/PUT/PATCH/DELETE
// /navigation[/:id]; these handlers were permanently shadowed by it (and PUT
// /navigation/:id was routing to the WRONG table, navigationMenu). Only the
// tag-configs endpoints below remain.

// ===== TAG CONFIGS =====
router.get(
  "/tag-configs",
  responseCache("admin-tag-configs", 60),
  asyncHandler(async (req, res) => {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 100, 1),
      500,
    );
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const tags = await dbHelpers.find("tagConfigs", {}, limit, offset);
    res.json({ success: true, data: tags });
  }),
);

router.post(
  "/tag-configs",
  asyncHandler(async (req, res) => {
    const {
      name,
      label,
      color,
      icon,
      route,
      filterKey,
      filter_key,
      filterValue,
      filter_value,
      description,
      displayOrder,
      display_order,
      isActive,
      is_active,
    } = req.body;
    const tagName = (name || label || "").trim();
    if (!tagName) {
      return res
        .status(400)
        .json({ success: false, message: "Tag name or label is required" });
    }
    const payload = {
      name: tagName,
      label: (label || tagName).trim(),
      description: description ?? null,
      color: color || null,
      icon: icon || null,
      route: route || null,
      filter_key: filterKey || filter_key || null,
      filter_value: filterValue ?? filter_value ?? null,
      display_order: Number(displayOrder ?? display_order ?? 0),
      is_active: isActive ?? is_active ?? true,
      created_at: new Date().toISOString(),
    };
    const newTag = await dbHelpers.insertOne("tagConfigs", payload);
    res.status(201).json({ success: true, data: newTag });
  }),
);

router.put(
  "/tag-configs/:id",
  asyncHandler(async (req, res) => {
    const {
      name,
      label,
      color,
      icon,
      route,
      filterKey,
      filter_key,
      filterValue,
      filter_value,
      description,
      displayOrder,
      display_order,
      isActive,
      is_active,
    } = req.body;
    const payload = {};
    if (name !== undefined || label !== undefined) {
      payload.name = (name || label || "").trim();
      payload.label = (label || name || "").trim();
    }
    if (description !== undefined) payload.description = description;
    if (color !== undefined) payload.color = color;
    if (icon !== undefined) payload.icon = icon;
    if (route !== undefined) payload.route = route;
    if (filterKey !== undefined || filter_key !== undefined)
      payload.filter_key = filterKey || filter_key;
    if (filterValue !== undefined || filter_value !== undefined)
      payload.filter_value = filterValue ?? filter_value;
    if (displayOrder !== undefined || display_order !== undefined)
      payload.display_order = Number(displayOrder ?? display_order ?? 0);
    if (isActive !== undefined || is_active !== undefined)
      payload.is_active = Boolean(isActive ?? is_active);
    payload.updated_at = new Date().toISOString();

    const updated = await dbHelpers.updateById(
      "tagConfigs",
      req.params.id,
      payload,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Tag config not found" });
    }
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/tag-configs/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "tagConfigs",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Tag config not found" });
    }
    res.json({ success: true, message: "Tag config moved to trash" });
  }),
);

export default router;
