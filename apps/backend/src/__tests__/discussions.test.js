import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock postgres helpers
const mockFind = jest.fn();
const mockFindById = jest.fn();
const mockInsertOne = jest.fn();
const mockUpdateById = jest.fn();
const mockSoftDelete = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    dbHelpers: {
      find: mockFind,
      findById: mockFindById,
      insertOne: mockInsertOne,
      updateById: mockUpdateById,
      softDelete: mockSoftDelete,
    },
  }),
);

// Mock auth middleware
jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  protect: (req, res, next) => {
    req.user = req.user || {
      id: 101,
      email: "student1@test.com",
      isAdmin: false,
    };
    next();
  },
  admin: (req, res, next) => {
    if (!req.user?.isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }
    next();
  },
}));

// Import router
const { default: discussionsRouter } =
  await import("../api/routes/discussions.js");

describe("Student Discussion Forum & Moderation Pipeline (discussions.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getHandler = (method, path) => {
    const layer = discussionsRouter.stack.find(
      (l) =>
        l.route &&
        l.route.path === path &&
        l.route.methods[method.toLowerCase()],
    );
    return layer.route.stack.slice(-1)[0].handle;
  };

  describe("GET /question/:questionId", () => {
    it("returns sorted and paginated discussions with nested replies", async () => {
      const handler = getHandler("get", "/question/:questionId");

      mockFind
        .mockResolvedValueOnce([
          {
            id: 10,
            questionId: 5,
            content: "First thread",
            upvotes: 2,
            createdAt: "2026-09-01T10:00:00Z",
          },
          {
            id: 11,
            questionId: 5,
            content: "Popular thread",
            upvotes: 15,
            createdAt: "2026-09-02T10:00:00Z",
          },
        ]) // questionDiscussions
        .mockResolvedValueOnce([
          { id: 101, discussionId: 10, content: "Reply to first" },
          { id: 102, discussionId: 11, content: "Reply to popular" },
        ]); // discussionReplies

      const req = {
        params: { questionId: "5" },
        query: { page: "1", limit: "10", sortBy: "popular" },
      };
      const res = { json: jest.fn() };

      await handler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 2,
          total: 2,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 11,
              upvotes: 15,
              replies: expect.arrayContaining([
                expect.objectContaining({ id: 102 }),
              ]),
            }),
          ]),
        }),
      );
    });
  });

  describe("POST /question/:questionId", () => {
    it("rejects post when content is empty or whitespace", async () => {
      const handler = getHandler("post", "/question/:questionId");
      const req = {
        params: { questionId: "5" },
        body: { content: "   " },
        user: { id: 101 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "content is required" }),
      );
    });

    it("creates new question discussion thread with initial 0 upvotes", async () => {
      const handler = getHandler("post", "/question/:questionId");
      mockInsertOne.mockResolvedValueOnce({
        id: 12,
        questionId: 5,
        userId: 101,
        content: "How do you solve this quickly?",
        upvotes: 0,
        isActive: true,
      });

      const req = {
        params: { questionId: "5" },
        body: { content: "How do you solve this quickly?" },
        user: { id: 101 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockInsertOne).toHaveBeenCalledWith(
        "questionDiscussions",
        expect.objectContaining({
          questionId: 5,
          userId: 101,
          content: "How do you solve this quickly?",
          upvotes: 0,
          isActive: true,
        }),
      );
    });
  });

  describe("POST /:discussionId/replies", () => {
    it("returns 404 if discussion does not exist", async () => {
      const handler = getHandler("post", "/:discussionId/replies");
      mockFindById.mockResolvedValueOnce(null);

      const req = {
        params: { discussionId: "999" },
        body: { content: "Reply content" },
        user: { id: 101 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "discussion not found" }),
      );
    });

    it("adds reply linked to existing discussion thread", async () => {
      const handler = getHandler("post", "/:discussionId/replies");
      mockFindById.mockResolvedValueOnce({ id: 10, content: "Main thread" });
      mockInsertOne.mockResolvedValueOnce({
        id: 103,
        discussionId: 10,
        content: "Here is the step",
      });

      const req = {
        params: { discussionId: "10" },
        body: { content: "Here is the step" },
        user: { id: 102 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockInsertOne).toHaveBeenCalledWith(
        "discussionReplies",
        expect.objectContaining({
          discussionId: 10,
          userId: 102,
          content: "Here is the step",
        }),
      );
    });
  });

  describe("POST /:discussionId/upvote", () => {
    it("records upvote and increments upvote counter", async () => {
      const handler = getHandler("post", "/:discussionId/upvote");
      mockFindById.mockResolvedValueOnce({ id: 10, upvotes: 3 });
      mockFind.mockResolvedValueOnce([]); // no existing vote from user 101
      mockInsertOne.mockResolvedValueOnce({ id: 501 });
      mockUpdateById.mockResolvedValueOnce({ id: 10, upvotes: 4 });

      const req = {
        params: { discussionId: "10" },
        user: { id: 101 },
      };
      const res = { json: jest.fn() };

      await handler(req, res);
      expect(mockInsertOne).toHaveBeenCalledWith(
        "discussionVotes",
        expect.objectContaining({
          discussionId: 10,
          userId: 101,
          voteType: "upvote",
        }),
      );
      expect(mockUpdateById).toHaveBeenCalledWith(
        "questionDiscussions",
        10,
        expect.objectContaining({ upvotes: 4 }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it("prevents double voting and returns 400 already upvoted", async () => {
      const handler = getHandler("post", "/:discussionId/upvote");
      mockFindById.mockResolvedValueOnce({ id: 10, upvotes: 4 });
      mockFind.mockResolvedValueOnce([
        { id: 501, discussionId: 10, userId: 101 },
      ]); // already voted

      const req = {
        params: { discussionId: "10" },
        user: { id: 101 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "already upvoted" }),
      );
    });
  });

  describe("PUT /:discussionId and DELETE /:discussionId", () => {
    it("rejects unauthorized edit if candidate is neither author nor admin", async () => {
      const handler = getHandler("put", "/:discussionId");
      mockFindById.mockResolvedValueOnce({ id: 10, userId: 999 }); // author is user 999

      const req = {
        params: { discussionId: "10" },
        body: { content: "Malicious modification" },
        user: { id: 101, isAdmin: false },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "not authorized to edit this discussion",
        }),
      );
    });

    it("allows author to edit their own discussion post", async () => {
      const handler = getHandler("put", "/:discussionId");
      mockFindById.mockResolvedValueOnce({ id: 10, userId: 101 }); // author matches user 101
      mockUpdateById.mockResolvedValueOnce({
        id: 10,
        content: "Updated explanation",
      });

      const req = {
        params: { discussionId: "10" },
        body: { content: "Updated explanation" },
        user: { id: 101, isAdmin: false },
      };
      const res = { json: jest.fn() };

      await handler(req, res);
      expect(mockUpdateById).toHaveBeenCalledWith(
        "questionDiscussions",
        "10",
        expect.objectContaining({ content: "Updated explanation" }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Discussion updated successfully",
        }),
      );
    });

    it("allows admin to soft delete any inappropriate post", async () => {
      const handler = getHandler("delete", "/:discussionId");
      mockFindById.mockResolvedValueOnce({ id: 10, userId: 999 }); // post by user 999
      mockSoftDelete.mockResolvedValueOnce({ id: 10, isDeleted: true });

      const req = {
        params: { discussionId: "10" },
        user: { id: 1, isAdmin: true }, // admin user
      };
      const res = { json: jest.fn() };

      await handler(req, res);
      expect(mockSoftDelete).toHaveBeenCalledWith(
        "questionDiscussions",
        "10",
        1,
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Discussion deleted successfully",
        }),
      );
    });
  });
});
