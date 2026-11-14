// @vitest-environment happy-dom
import { describe, test, expect } from "vitest";
import {
  hasPermission,
  getResourceFromSegment,
  getResourceFromPath,
  RESOURCE_ALIASES,
} from "../rbac.js";

describe("hasPermission alias matrix", () => {
  test("view ↔ read are interchangeable", () => {
    expect(hasPermission(["tests:read"], "tests:view")).toBe(true);
    expect(hasPermission(["tests:view"], "tests:read")).toBe(true);
  });

  test("create/edit ↔ write are interchangeable", () => {
    expect(hasPermission(["tests:write"], "tests:create")).toBe(true);
    expect(hasPermission(["tests:write"], "tests:edit")).toBe(true);
    expect(hasPermission(["tests:create"], "tests:write")).toBe(true);
    expect(hasPermission(["tests:edit"], "tests:write")).toBe(true);
  });

  test("resource wildcard grants any action on that resource", () => {
    expect(hasPermission(["tests:*"], "tests:view")).toBe(true);
    expect(hasPermission(["tests:*"], "tests:admin")).toBe(true);
  });

  test("global wildcard grants everything", () => {
    expect(hasPermission(["*"], "tests:admin")).toBe(true);
  });

  test("system ↔ settings are interchangeable", () => {
    expect(hasPermission(["settings:view"], "system:view")).toBe(true);
    expect(hasPermission(["system:read"], "settings:read")).toBe(true);
    expect(hasPermission(["settings:*"], "system:view")).toBe(true);
  });

  test("resource aliases resolve (test ↔ tests)", () => {
    expect(RESOURCE_ALIASES.tests).toBe("test");
    expect(hasPermission(["test:view"], "tests:view")).toBe(true);
  });

  test("super flag bypasses all checks", () => {
    expect(hasPermission([], "tests:admin", true)).toBe(true);
    expect(hasPermission(undefined, "tests:view", true)).toBe(true);
  });

  test("malformed input denies safely", () => {
    expect(hasPermission([], "malformed")).toBe(false);
    expect(hasPermission([], "")).toBe(false);
    expect(hasPermission([], "tests:view")).toBe(false);
  });

  test("view-only grant does NOT imply admin (live-room least privilege)", () => {
    expect(hasPermission(["tests:view", "tests:read"], "tests:admin")).toBe(
      false,
    );
    expect(hasPermission(["tests:admin"], "tests:admin")).toBe(true);
  });
});

describe("live-operation resource mapping (backend-canonical)", () => {
  test("live segments map to the tests resource (no phantom live/proctoring)", () => {
    expect(getResourceFromSegment("live-monitor")).toBe("tests");
    expect(getResourceFromSegment("live-proctoring")).toBe("tests");
    expect(getResourceFromSegment("live")).toBe("tests");
    expect(getResourceFromSegment("live-tests")).toBe("tests");
    expect(getResourceFromSegment("proctoring")).toBe("tests");
    expect(getResourceFromSegment("practice-questions")).toBe("tests");
    expect(getResourceFromPath("/admin/live-monitor")).toBe("tests");
    expect(getResourceFromPath("/admin/live-proctoring")).toBe("tests");
  });

  test("manage is a UI-gating-only wildcard for its resource", () => {
    expect(hasPermission(["tests:manage"], "tests:view")).toBe(true);
    expect(hasPermission(["tests:view"], "tests:manage")).toBe(true);
    expect(hasPermission(["tests:read"], "tests:manage")).toBe(true);
    expect(hasPermission(["tests:create"], "tests:manage")).toBe(true);
    expect(hasPermission(["tests:write"], "tests:manage")).toBe(true);
    expect(hasPermission(["tests:*"], "tests:manage")).toBe(true);
    expect(hasPermission(["content:view"], "tests:manage")).toBe(false);
  });

  test("blogs and blog map to content resource", () => {
    expect(getResourceFromSegment("blogs")).toBe("content");
    expect(getResourceFromSegment("blog")).toBe("content");
    expect(getResourceFromPath("/admin/blogs")).toBe("content");
    expect(getResourceFromPath("/admin/blog")).toBe("content");
  });
});
