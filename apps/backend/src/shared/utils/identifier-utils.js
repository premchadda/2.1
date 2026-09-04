import { parseNumericId } from "./db-utils.js";

// 24-char hex strings are MongoDB ObjectIds — they cannot exist as Postgres PKs.
// We retain the pattern only for fast rejection (no DB lookup needed).
const LEGACY_OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const getInternalId = (record) => {
  if (!record || typeof record !== "object") return null;
  return record.id ?? record._id ?? null;
};

export async function findEntityByIdentifier(
  dbHelpers,
  collection,
  identifier,
  options = {},
) {
  const { slugFields = [] } = options;

  if (!dbHelpers || identifier === undefined || identifier === null) {
    return null;
  }

  if (typeof identifier === "number" && Number.isFinite(identifier)) {
    return dbHelpers.findById(collection, identifier);
  }

  if (typeof identifier !== "string") {
    return null;
  }

  const normalizedIdentifier = identifier.trim();
  if (!normalizedIdentifier) {
    return null;
  }

  const entityType = dbHelpers.getTableName?.(collection) || collection;

  if (dbHelpers.isValidPublicId?.(normalizedIdentifier, entityType)) {
    const byPublicId = await dbHelpers.findByPublicId(
      collection,
      normalizedIdentifier,
    );
    if (byPublicId) {
      return byPublicId;
    }
  }

  const numericId = parseNumericId(normalizedIdentifier);
  if (numericId !== null) {
    const byId = await dbHelpers.findById(collection, numericId);
    if (byId) {
      return byId;
    }
  }

  for (const field of slugFields) {
    // Primary: exact match (DB helper already normalises casing via collation or LOWER index).
    const byField = await dbHelpers.findOne(collection, {
      [field]: normalizedIdentifier,
    });
    if (byField) return byField;

    // Secondary: explicit LOWER() case-insensitive lookup via raw pool query.
    // Avoids loading the entire table just for a slug miss.
    try {
      const tableName = dbHelpers.getTableName?.(collection) || collection;
      const { rows } = await dbHelpers.pool.query(
        `SELECT * FROM ${tableName} WHERE LOWER(${field}) = LOWER($1) LIMIT 1`,
        [normalizedIdentifier],
      );
      if (rows[0]) {
        const record = dbHelpers.toCamel ? dbHelpers.toCamel(rows[0]) : rows[0];
        return record;
      }
    } catch {
      // If pool query fails (e.g. field doesn't exist), skip silently.
    }
  }

  // Legacy MongoDB ObjectIds (24-char hex) cannot exist as Postgres integer PKs.
  // Return null immediately — no DB scan needed.
  if (LEGACY_OBJECT_ID_PATTERN.test(normalizedIdentifier)) {
    return null;
  }

  return null;
}

export async function resolveInternalIdByIdentifier(
  dbHelpers,
  collection,
  identifier,
  options = {},
) {
  const entity = await findEntityByIdentifier(
    dbHelpers,
    collection,
    identifier,
    options,
  );
  return getInternalId(entity);
}
