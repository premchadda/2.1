// Pure helper functions for postgres-helpers (no `this` dependency).

export const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

// Helper to stringify JSONB values (objects and arrays) for PostgreSQL
export const stringifyJsonbValue = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
};

// Helper to prepare values for PostgreSQL insert/update based on table's JSONB columns
export const prepareDbValues = (table, dbData, jsonbColumns = [], timestampColumns = []) => {
  const result = {};
  for (const [key, value] of Object.entries(dbData)) {
    if (jsonbColumns.includes(key)) {
      result[key] = stringifyJsonbValue(value);
    } else if (
      timestampColumns.includes(key) &&
      (value === "" || value === undefined)
    ) {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result;
};