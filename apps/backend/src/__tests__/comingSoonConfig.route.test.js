import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import express from "express";
import http from "http";

const mockPoolQuery = jest.fn();
const mockFind = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
    dbHelpers: { find: (...args) => mockFind(...args) },
  }),
);

jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  protect: (req, res, next) => next(),
  admin: (req, res, next) => next(),
  superAdmin: (req, res, next) => next(),
}));

const { default: extrasRouter } = await import("../api/routes/admin-extras.js");

let server;

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", extrasRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return `http://127.0.0.1:${port}/api/admin`;
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
}

describe("GET/PUT /admin/coming-soon-config (admin-extras.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockResolvedValue({ rows: [] });
    mockFind.mockResolvedValue([]);
  });

  afterEach(async () => {
    await stopServer();
  });

  it("GET returns empty defaults when nothing is stored", async () => {
    const base = await startServer();
    const response = await fetch(`${base}/coming-soon-config`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: { siteConfig: {}, pages: [] },
    });
    expect(mockFind).toHaveBeenCalledWith("appSettings", {
      key: "coming_soon_config",
    });
  });

  it("GET returns stored siteConfig and pages", async () => {
    mockFind.mockResolvedValue([
      {
        id: 1,
        key: "coming_soon_config",
        value: {
          siteConfig: {
            maintenanceMode: true,
            maintenanceMessage: "Back soon",
          },
          pages: [{ key: "videos", comingSoon: true }],
        },
      },
    ]);
    const base = await startServer();
    const response = await fetch(`${base}/coming-soon-config`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.siteConfig.maintenanceMode).toBe(true);
    expect(body.data.pages).toEqual([{ key: "videos", comingSoon: true }]);
  });

  it("GET normalizes a stored value missing siteConfig/pages keys", async () => {
    mockFind.mockResolvedValue([
      { id: 1, key: "coming_soon_config", value: {} },
    ]);
    const base = await startServer();
    const response = await fetch(`${base}/coming-soon-config`);
    const body = await response.json();

    expect(body).toEqual({
      success: true,
      data: { siteConfig: {}, pages: [] },
    });
  });

  it("PUT persists via key/value upsert on conflict and round-trips", async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
    const base = await startServer();

    const payload = {
      siteConfig: { maintenanceMode: true, maintenanceMessage: "Round trip" },
      pages: [{ key: "liveTests", comingSoon: true }],
    };
    const putResponse = await fetch(`${base}/coming-soon-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const putBody = await putResponse.json();

    expect(putResponse.status).toBe(200);
    expect(putBody).toEqual({
      success: true,
      message: "Configuration saved successfully",
    });

    const [sql, params] = mockPoolQuery.mock.calls[0];
    expect(sql).toContain("ON CONFLICT (key) DO UPDATE");
    expect(params[0]).toBe("coming_soon_config");
    const written = JSON.parse(params[1]);
    expect(written.siteConfig).toEqual(payload.siteConfig);
    expect(written.pages).toEqual(payload.pages);

    mockFind.mockResolvedValue([
      { id: 1, key: "coming_soon_config", value: written },
    ]);
    const getResponse = await fetch(`${base}/coming-soon-config`);
    const getBody = await getResponse.json();

    expect(getResponse.status).toBe(200);
    expect(getBody.data.siteConfig).toEqual(payload.siteConfig);
    expect(getBody.data.pages).toEqual(payload.pages);
  });
});
