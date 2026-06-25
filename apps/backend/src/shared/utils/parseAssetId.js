/**
 * Canonical asset ID parser.
 *
 * Returns:
 *   - null  when the value is missing, empty, the literal strings "null"/"undefined",
 *           or anything that does not coerce to a usable identifier.
 *   - number when the trimmed value parses to a finite integer (matches numeric FK columns).
 *   - string when the value is non-numeric (e.g. UUID-style asset IDs).
 *
 * The string form is preserved verbatim (after trimming) so the same helper can be
 * used regardless of whether the `assets.id` column is numeric or a UUID.
 */
export const parseAssetId = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (!str || str === "null" || str === "undefined") return null;

  if (/^-?\d+$/.test(str)) {
    const numeric = Number.parseInt(str, 10);
    if (Number.isFinite(numeric)) return numeric;
  }

  return str;
};

export default parseAssetId;
