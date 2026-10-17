import { describe, it, expect } from "@jest/globals";
import {
  SECTION_SOURCE_RANK,
  buildScopedSections,
} from "../shared/utils/sectionScope.js";

/**
 * Mirrors the ranked row shape produced by the `/admin/sections/for-test` CTE.
 * `rn` arrives as a STRING because ROW_NUMBER() is a bigint and node-postgres
 * returns bigints as strings — the regression this file guards.
 */
const ranked = (id, name, source, rn, extra = {}) => ({
  id,
  name,
  source,
  display_order: 0,
  ...extra,
  src_prio: SECTION_SOURCE_RANK[source],
  canonical_key: name.toLowerCase(),
  rn: String(rn),
});

describe("sectionScope.buildScopedSections", () => {
  it("keeps only the winning row (rn = 1) per canonical key", () => {
    const rows = [
      ranked(3033, "English Language", "test", 1),
      ranked(44, "General Intelligence & Reasoning", "default", 1),
      ranked(45, "General Awareness", "default", 1),
      ranked(192, "English Language", "default", 2),
      ranked(196, "English Language", "default", 3),
      ranked(200, "English Language", "default", 4),
    ];

    const out = buildScopedSections(rows);
    expect(out.map((r) => r.id)).toEqual([3033, 44, 45]);
  });

  it("treats rn numerically, not by string identity", () => {
    // A strict `row.rn === 1` would return [] here.
    const out = buildScopedSections([
      ranked(7, "General Awareness", "default", 1),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(7);
  });

  it("strips the ranking helper columns", () => {
    const out = buildScopedSections([
      ranked(45, "General Awareness", "default", 1),
    ]);
    expect(out[0]).not.toHaveProperty("rn");
    expect(out[0]).not.toHaveProperty("src_prio");
    expect(out[0]).not.toHaveProperty("canonical_key");
    expect(out[0]).toMatchObject({ id: 45, name: "General Awareness" });
  });

  it("orders test-owned sections first, then series_stage, then defaults", () => {
    const rows = [
      ranked(50, "Statistics", "default", 1),
      ranked(40, "General Science", "default", 1),
      ranked(20, "Series Template", "series_stage", 1),
      ranked(9, "Own Section", "test", 1),
    ];

    expect(buildScopedSections(rows).map((r) => r.source)).toEqual([
      "test",
      "series_stage",
      "default",
      "default",
    ]);
  });

  it("breaks display_order ties by id", () => {
    const rows = [
      ranked(45, "General Awareness", "default", 1, { display_order: 1 }),
      ranked(44, "General Intelligence", "default", 1, { display_order: 1 }),
      ranked(43, "Trade Specific", "default", 1, { display_order: 0 }),
    ];

    expect(buildScopedSections(rows).map((r) => r.id)).toEqual([43, 44, 45]);
  });

  it("is defensive about malformed input", () => {
    expect(buildScopedSections()).toEqual([]);
    expect(buildScopedSections(null)).toEqual([]);
    expect(buildScopedSections("nope")).toEqual([]);
    expect(buildScopedSections([null, undefined])).toEqual([]);
  });
});
