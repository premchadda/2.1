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

const mockFind = jest.fn();
const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockInsertOne = jest.fn();
const mockUpdateById = jest.fn();
const mockSoftDelete = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    dbHelpers: {
      find: (...args) => mockFind(...args),
      findById: (...args) => mockFindById(...args),
      findOne: (...args) => mockFindOne(...args),
      insertOne: (...args) => mockInsertOne(...args),
      updateById: (...args) => mockUpdateById(...args),
      softDelete: (...args) => mockSoftDelete(...args),
    },
    pool: { query: jest.fn() },
  }),
);

let authUser = { id: 1, name: "Alice", role: "user" };

jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  protect: (req, res, next) => {
    if (!authUser) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });
    }
    req.user = authUser;
    next();
  },
  admin: (req, res, next) => {
    if (req.user?.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }
    next();
  },
}));

const { default: studyGroupsRouter } =
  await import("../api/routes/studyGroups.js");

let server;
let baseUrl;

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/study-groups", studyGroupsRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/study-groups`;
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
}

describe("StudyGroups API Routes", () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    authUser = { id: 1, name: "Alice", role: "user" };
    await startServer();
  });

  afterEach(async () => {
    await stopServer();
  });

  describe("GET /api/study-groups", () => {
    it("returns public groups and filters out private groups for unauthenticated visitors", async () => {
      authUser = null;
      const mockGroups = [
        {
          id: 1,
          name: "SSC CGL Prep",
          isPrivate: false,
          isActive: true,
          memberCount: 10,
        },
        {
          id: 2,
          name: "Secret Club",
          isPrivate: true,
          isActive: true,
          memberCount: 5,
        },
      ];
      mockFind
        .mockResolvedValueOnce(mockGroups)
        .mockResolvedValueOnce([{ id: 101, groupId: 1, userId: 10 }]);

      const res = await fetch(`${baseUrl}`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("SSC CGL Prep");
    });

    it("filters groups by category and search keyword", async () => {
      const mockGroups = [
        {
          id: 1,
          name: "Railway Math",
          category: "railway",
          isActive: true,
          memberCount: 20,
        },
        {
          id: 2,
          name: "SSC English",
          category: "ssc",
          isActive: true,
          memberCount: 15,
        },
      ];
      mockFind
        .mockResolvedValueOnce(mockGroups)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 101, groupId: 1 }]);

      const res = await fetch(`${baseUrl}?category=railway&search=math`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Railway Math");
    });
  });

  describe("POST /api/study-groups (create)", () => {
    it("rejects creation when name or description is missing", async () => {
      const res = await fetch(`${baseUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Only Name" }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.message).toContain("required");
    });

    it("creates group and automatically registers creator as admin member", async () => {
      mockInsertOne
        .mockResolvedValueOnce({ id: 99, name: "Quant Mastery", userId: 1 })
        .mockResolvedValueOnce({
          id: 1,
          groupId: 99,
          userId: 1,
          role: "admin",
        });

      const res = await fetch(`${baseUrl}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Quant Mastery",
          description: "Advanced SSC Quant problems",
          category: "ssc",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.id).toBe(99);
      expect(mockInsertOne).toHaveBeenCalledTimes(2);
      expect(mockInsertOne.mock.calls[0][0]).toBe("studyGroups");
      expect(mockInsertOne.mock.calls[1][0]).toBe("studyGroupMembers");
      expect(mockInsertOne.mock.calls[1][1].role).toBe("admin");
    });
  });

  describe("POST /api/study-groups/:id/join and /leave", () => {
    it("blocks joining if user is already a member", async () => {
      mockFindById.mockResolvedValueOnce({ id: 10, name: "Study Group" });
      mockFindOne.mockResolvedValueOnce({ id: 1, groupId: 10, userId: 1 });

      const res = await fetch(`${baseUrl}/10/join`, { method: "POST" });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.message).toBe("Already a member");
    });

    it("blocks joining if group is at max capacity", async () => {
      mockFindById.mockResolvedValueOnce({
        id: 10,
        name: "Full Group",
        maxMembers: 2,
      });
      mockFindOne.mockResolvedValueOnce(null);
      mockFind.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      const res = await fetch(`${baseUrl}/10/join`, { method: "POST" });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.message).toBe("Group is full");
    });

    it("successfully joins group and increments member count", async () => {
      mockFindById.mockResolvedValueOnce({
        id: 10,
        name: "Open Group",
        maxMembers: 50,
      });
      mockFindOne.mockResolvedValueOnce(null);
      mockFind.mockResolvedValueOnce([{ id: 1 }]);
      mockInsertOne.mockResolvedValueOnce({
        id: 2,
        groupId: 10,
        userId: 1,
        role: "member",
      });
      mockUpdateById.mockResolvedValueOnce({ id: 10, memberCount: 2 });

      const res = await fetch(`${baseUrl}/10/join`, { method: "POST" });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.role).toBe("member");
      expect(mockUpdateById).toHaveBeenCalledWith("studyGroups", "10", {
        memberCount: 2,
      });
    });

    it("prevents sole admin from leaving group without deletion or reassignment", async () => {
      mockFindById.mockResolvedValueOnce({ id: 10, name: "Admin Group" });
      mockFindOne.mockResolvedValueOnce({
        id: 1,
        groupId: 10,
        userId: 1,
        role: "admin",
      });
      mockFind.mockResolvedValueOnce([{ id: 1, role: "admin" }]);

      const res = await fetch(`${baseUrl}/10/leave`, { method: "POST" });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.message).toContain("Cannot leave as the only admin");
    });

    it("allows non-admin member to leave group and updates count", async () => {
      mockFindById.mockResolvedValueOnce({ id: 10, name: "Normal Group" });
      mockFindOne.mockResolvedValueOnce({
        id: 55,
        groupId: 10,
        userId: 1,
        role: "member",
      });
      mockSoftDelete.mockResolvedValueOnce(true);
      mockFind.mockResolvedValueOnce([{ id: 1, role: "admin" }]);
      mockUpdateById.mockResolvedValueOnce({ id: 10, memberCount: 1 });

      const res = await fetch(`${baseUrl}/10/leave`, { method: "POST" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Left the group");
      expect(mockSoftDelete).toHaveBeenCalledWith("studyGroupMembers", 55, 1);
    });
  });

  describe("PUT /api/study-groups/:id/member/:memberId/role", () => {
    it("blocks non-admin members from changing user roles", async () => {
      mockFindById.mockResolvedValueOnce({ id: 10, name: "Group" });
      mockFindOne.mockResolvedValueOnce({
        id: 1,
        groupId: 10,
        userId: 1,
        role: "member",
      });

      const res = await fetch(`${baseUrl}/10/member/2/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.message).toBe("Not authorized");
    });

    it("allows group admin to promote member to admin", async () => {
      mockFindById
        .mockResolvedValueOnce({ id: 10, name: "Group" })
        .mockResolvedValueOnce({
          id: 2,
          groupId: 10,
          userId: 2,
          role: "member",
        });
      mockFindOne.mockResolvedValueOnce({
        id: 1,
        groupId: 10,
        userId: 1,
        role: "admin",
      });
      mockUpdateById.mockResolvedValueOnce({ id: 2, role: "admin" });

      const res = await fetch(`${baseUrl}/10/member/2/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.role).toBe("admin");
    });
  });

  describe("Group Discussion Messages & Posts", () => {
    it("sends a group chat message", async () => {
      mockInsertOne.mockResolvedValueOnce({
        id: 701,
        groupId: "10",
        userId: 1,
        content: "Hello study buddies!",
      });

      const res = await fetch(`${baseUrl}/10/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Hello study buddies!" }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.content).toBe("Hello study buddies!");
      expect(body.data.userName).toBe("Alice");
    });

    it("rejects sending empty message content", async () => {
      const res = await fetch(`${baseUrl}/10/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "   " }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.message).toContain("required");
    });

    it("creates a discussion post with title and content", async () => {
      mockInsertOne.mockResolvedValueOnce({
        id: 801,
        title: "Trigonometry Shortcut Tricks",
        content: "Use tan(theta) substitution for symmetric angles",
        groupId: "10",
        userId: 1,
      });

      const res = await fetch(`${baseUrl}/10/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Trigonometry Shortcut Tricks",
          content: "Use tan(theta) substitution for symmetric angles",
        }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.id).toBe(801);
      expect(body.data.title).toBe("Trigonometry Shortcut Tricks");
    });

    it("adds a comment to a group discussion post", async () => {
      mockInsertOne.mockResolvedValueOnce({
        id: 901,
        postId: "801",
        content: "Great trick! Saved me 30 seconds.",
        userId: 1,
      });

      const res = await fetch(`${baseUrl}/10/posts/801/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Great trick! Saved me 30 seconds." }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.id).toBe(901);
      expect(body.data.content).toContain("Saved me 30 seconds");
    });

    it("pins and unpins a discussion post", async () => {
      mockFindById.mockResolvedValueOnce({
        id: "801",
        title: "Important Rules",
        isPinned: false,
      });
      mockUpdateById.mockResolvedValueOnce({
        id: "801",
        isPinned: true,
      });

      const res = await fetch(`${baseUrl}/10/posts/801/pin`, {
        method: "PUT",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.message).toBe("Post pinned successfully");
      expect(mockUpdateById).toHaveBeenCalledWith(
        "communityPosts",
        "801",
        expect.objectContaining({ isPinned: true }),
      );
    });
  });
});
