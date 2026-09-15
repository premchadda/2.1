import { describe, it, expect } from "@jest/globals";
import { buildObjectKey } from "../src/infrastructure/storage/storageProvider.js";

describe("storageProvider.buildObjectKey", () => {
  it("uses flat category path when no scope provided", () => {
    const key = buildObjectKey("image", "q1.png");
    expect(key).toMatch(/^assets\/image\/\d+-q1\.png$/);
  });

  it('falls back to "general" when category missing', () => {
    const key = buildObjectKey(undefined, "file.bin");
    expect(key).toMatch(/^assets\/general\/\d+-file\.bin$/);
  });

  it("uses tests/<id> segment when testId is given", () => {
    const key = buildObjectKey("test-image", "q1.png", { testId: 123 });
    expect(key).toMatch(/^assets\/tests\/123\/\d+-q1\.png$/);
  });

  it("uses series/<id>/tests/<id> when both ids are given", () => {
    const key = buildObjectKey("test-image", "q1.png", {
      testId: 123,
      testSeriesId: 7,
    });
    expect(key).toMatch(/^assets\/series\/7\/tests\/123\/\d+-q1\.png$/);
  });

  it("uses series/<id> when only series id is given", () => {
    const key = buildObjectKey("image", "banner.jpg", { testSeriesId: 7 });
    expect(key).toMatch(/^assets\/series\/7\/\d+-banner\.jpg$/);
  });

  it("sanitizes traversal attempts in testId", () => {
    const key = buildObjectKey("image", "q1.png", { testId: "../../evil" });
    // traversal sequences are neutralized, and slashes stripped
    expect(key).not.toContain("..");
    expect(key).toMatch(/^assets\/tests\//);
  });

  it("sanitizes traversal attempts in category", () => {
    const key = buildObjectKey("../../etc", "x.png");
    expect(key).not.toContain("..");
  });
});
