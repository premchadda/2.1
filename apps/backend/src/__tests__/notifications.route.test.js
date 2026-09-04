import { jest, describe, expect, it } from "@jest/globals";

jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  protect: (req, res, next) => next(),
  admin: (req, res, next) => next(),
}));
jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    dbHelpers: {},
    pool: {},
  }),
);

const { default: notificationsRouter } =
  await import("../api/routes/notifications.js");

describe("notifications route schema compatibility", () => {
  it("mounts the notifications router after switching reads to action_url", () => {
    const route = notificationsRouter.stack.find(
      (layer) => layer.route?.path === "/",
    );
    const source =
      route?.route?.stack
        ?.map((layer) => layer.handle?.toString())
        .join("\n") || "";

    expect(source).toContain("action_url AS link_url");
    expect(source).not.toContain("created_at, link_url, metadata");
  });
});
