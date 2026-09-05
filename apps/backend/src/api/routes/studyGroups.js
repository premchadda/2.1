import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { idsMatch } from "../../services/core/common.js";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import {
  findPeerMatches,
  createQuizDuel,
  submitDuelAnswer,
  getDuelStatus,
} from "../../services/core/studyMatchmakerService.js";

const router = express.Router();

// @route   GET /api/study-groups
// @desc    Get all study groups
// @access  Public
router.get("/", async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    const isAuth = req.user?.id;

    let groups = await dbHelpers.find("studyGroups", { isActive: true });

    if (!isAuth) {
      groups = groups.filter((g) => !g.isPrivate);
    } else {
      const userMemberships = await dbHelpers.find("studyGroupMembers", {
        userId: req.user.id,
        isActive: { $ne: false },
      });
      const privateGroupIds = new Set(
        userMemberships.map((m) => m.groupId?.toString()),
      );
      groups = groups.filter(
        (g) => !g.isPrivate || privateGroupIds.has((g._id || g.id)?.toString()),
      );
    }

    // Filter by category
    if (category && category !== "all") {
      groups = groups.filter((g) => g.category === category);
    }

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      groups = groups.filter(
        (g) =>
          g.name?.toLowerCase().includes(searchLower) ||
          g.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort by most active and apply pagination
    groups = groups
      .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    // Get member count for each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const members = await dbHelpers.find("studyGroupMembers", {
          groupId: group._id || group.id,
          isActive: { $ne: false },
        });
        return {
          ...group,
          memberCount: members.length,
          isPrivate: group.isPrivate || false,
        };
      }),
    );

    res.json({
      success: true,
      data: groupsWithCounts,
      count: groupsWithCounts.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/study-groups/:id
// @desc    Get single study group with members
// @access  Public
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === "my" || id === "categories") return next();

    let group = await dbHelpers.findById("studyGroups", id);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Study group not found" });
    }

    // Get members
    const members = await dbHelpers.find("studyGroupMembers", {
      groupId: group._id || group.id,
      isActive: { $ne: false },
    });

    // Get admin info for each member
    const membersWithInfo = await Promise.all(
      members.map(async (member) => {
        const user = await dbHelpers.findById("users", member.userId);
        return {
          ...member,
          userName: user?.name || member.userName,
        };
      }),
    );

    res.json({
      success: true,
      data: {
        ...group,
        members: membersWithInfo,
        memberCount: members.length,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups
// @desc    Create a new study group
// @access  Private
router.post("/", protect, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      isPrivate,
      maxMembers = 50,
    } = req.body;

    if (!name || !description) {
      return res
        .status(400)
        .json({ success: false, message: "Name and description required" });
    }

    const group = await dbHelpers.insertOne("studyGroups", {
      name,
      description,
      category: category || "general",
      isPrivate: isPrivate || false,
      maxMembers: maxMembers || 50,
      userId: req.user.id,
      ownerName: req.user.name,
      isActive: true,
      memberCount: 1,
      createdAt: new Date().toISOString(),
    });

    // Add creator as admin member
    await dbHelpers.insertOne("studyGroupMembers", {
      groupId: group._id || group.id,
      userId: req.user.id,
      userName: req.user.name,
      role: "admin",
      joinedAt: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   PUT /api/study-groups/:id
// @desc    Update a study group
// @access  Private (owner only)
router.put("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, isPrivate, maxMembers } = req.body;

    const group = await dbHelpers.findById("studyGroups", id);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Study group not found" });
    }

    if (!idsMatch(group.userId, req.user.id) && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const updated = await dbHelpers.updateById("studyGroups", id, {
      ...(name && { name }),
      ...(description && { description }),
      ...(category && { category }),
      ...(isPrivate !== undefined && { isPrivate }),
      ...(maxMembers && { maxMembers }),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   DELETE /api/study-groups/:id
// @desc    Delete a study group
// @access  Private (owner only)
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await dbHelpers.findById("studyGroups", id);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Study group not found" });
    }

    if (!idsMatch(group.userId, req.user.id) && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    await dbHelpers.softDelete("studyGroups", id, req.user.id);

    res.json({ success: true, message: "Study group deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups/:id/join
// @desc    Join a study group
// @access  Private
router.post("/:id/join", protect, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await dbHelpers.findById("studyGroups", id);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Study group not found" });
    }

    // Check if already a member
    const existingMember = await dbHelpers.findOne("studyGroupMembers", {
      groupId: group._id || group.id,
      userId: req.user.id,
      isActive: { $ne: false },
    });

    if (existingMember) {
      return res
        .status(400)
        .json({ success: false, message: "Already a member" });
    }

    // Check max members
    const members = await dbHelpers.find("studyGroupMembers", {
      groupId: group._id || group.id,
      isActive: { $ne: false },
    });
    if (members.length >= (group.maxMembers || 50)) {
      return res.status(400).json({ success: false, message: "Group is full" });
    }

    // Add member
    const member = await dbHelpers.insertOne("studyGroupMembers", {
      groupId: group._id || group.id,
      userId: req.user.id,
      userName: req.user.name,
      role: "member",
      joinedAt: new Date().toISOString(),
    });

    // Update member count
    await dbHelpers.updateById("studyGroups", id, {
      memberCount: members.length + 1,
    });

    res.status(201).json({ success: true, data: member });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups/:id/leave
// @desc    Leave a study group
// @access  Private
router.post("/:id/leave", protect, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await dbHelpers.findById("studyGroups", id);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Study group not found" });
    }

    // Find and remove member
    const member = await dbHelpers.findOne("studyGroupMembers", {
      groupId: group._id || group.id,
      userId: req.user.id,
      isActive: { $ne: false },
    });

    if (!member) {
      return res.status(400).json({ success: false, message: "Not a member" });
    }

    // Can't leave if only admin
    if (member.role === "admin") {
      const members = await dbHelpers.find("studyGroupMembers", {
        groupId: group._id || group.id,
        isActive: { $ne: false },
      });
      if (members.length === 1) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Cannot leave as the only admin. Delete the group instead.",
          });
      }
    }

    await dbHelpers.softDelete(
      "studyGroupMembers",
      member._id || member.id,
      req.user.id,
    );

    // Update member count
    const remainingMembers = await dbHelpers.find("studyGroupMembers", {
      groupId: group._id || group.id,
      isActive: { $ne: false },
    });
    await dbHelpers.updateById("studyGroups", id, {
      memberCount: remainingMembers.length,
    });

    res.json({ success: true, message: "Left the group" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   PUT /api/study-groups/:id/member/:memberId/role
// @desc    Update member role
// @access  Private (group admin only)
router.put("/:id/member/:memberId/role", protect, async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;

    const group = await dbHelpers.findById("studyGroups", id);

    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: "Study group not found" });
    }

    // Check if requester is admin
    const requesterMember = await dbHelpers.findOne("studyGroupMembers", {
      groupId: group._id || group.id,
      userId: req.user.id,
      isActive: { $ne: false },
    });

    if (
      (!requesterMember || requesterMember.role !== "admin") &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const memberToUpdate = await dbHelpers.findById(
      "studyGroupMembers",
      memberId,
    );
    if (
      !memberToUpdate ||
      !idsMatch(memberToUpdate.groupId, group._id || group.id)
    ) {
      return res
        .status(404)
        .json({ success: false, message: "Group member not found" });
    }

    const updated = await dbHelpers.updateById("studyGroupMembers", memberId, {
      role,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/study-groups/my
// @desc    Get user's study groups
// @access  Private
router.get("/my", protect, async (req, res) => {
  try {
    const members = await dbHelpers.find("studyGroupMembers", {
      userId: req.user.id,
      isActive: { $ne: false },
    });
    const groupIds = members.map((m) => m.groupId);

    const groups = await Promise.all(
      groupIds.map(async (groupId) => {
        const group = await dbHelpers.findById("studyGroups", groupId);
        const member = members.find((m) => idsMatch(m.groupId, groupId));
        return group ? { ...group, role: member?.role } : null;
      }),
    );

    res.json({
      success: true,
      data: groups.filter(Boolean),
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/study-groups/categories
// @desc    Get study group categories
// @access  Public
router.get("/categories", async (req, res) => {
  try {
    const categories = [
      { id: "general", name: "General", icon: "👥" },
      { id: "ssc", name: "SSC Preparation", icon: "📋" },
      { id: "railway", name: "Railway Exams", icon: "🚂" },
      { id: "banking", name: "Banking Exams", icon: "🏦" },
      { id: "state-psc", name: "State PSC", icon: "🏛️" },
      { id: "defence", name: "Defence Exams", icon: "🛡️" },
      { id: "teaching", name: "Teaching Exams", icon: "📚" },
    ];

    res.json({ success: true, data: categories });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== GROUP MESSAGES =====
// @route   GET /api/study-groups/:id/messages
// @desc    Get messages in a study group
// @access  Public / Private
router.get("/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const messages = await dbHelpers.find("studyGroupMessages", {
      groupId: id,
    });
    const sorted = (messages || [])
      .sort(
        (a, b) =>
          new Date(a.createdAt || a.created_at || 0) -
          new Date(b.createdAt || b.created_at || 0),
      )
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    const messagesWithUser = await Promise.all(
      sorted.map(async (msg) => {
        const user = await dbHelpers.findById(
          "users",
          msg.userId || msg.user_id,
        );
        return {
          ...msg,
          userName: user?.name || "Student",
        };
      }),
    );

    res.json({
      success: true,
      data: messagesWithUser,
      count: messagesWithUser.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups/:id/messages
// @desc    Send a message in a study group
// @access  Private
router.post("/:id/messages", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, messageType = "text" } = req.body;

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Message content is required" });
    }

    const newMsg = await dbHelpers.insertOne("studyGroupMessages", {
      groupId: id,
      userId: req.user.id,
      content: content.trim(),
      messageType,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: {
        ...newMsg,
        userName: req.user.name || "You",
        userId: req.user.id,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== GROUP POSTS =====
// @route   GET /api/study-groups/:id/posts
// @desc    Get discussion posts for a study group
router.get("/:id/posts", async (req, res) => {
  try {
    const { id } = req.params;
    const posts = await dbHelpers.find("communityPosts", {
      groupId: id,
      isActive: true,
    });
    const sorted = (posts || []).sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );

    const postsWithUser = await Promise.all(
      sorted.map(async (post) => {
        const user = await dbHelpers.findById(
          "users",
          post.userId || post.user_id,
        );
        return {
          ...post,
          userName: user?.name || "Student",
          author: user?.name || "Student",
        };
      }),
    );

    res.json({
      success: true,
      data: postsWithUser,
      count: postsWithUser.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups/:id/posts
// @desc    Create a discussion post in a study group
router.post("/:id/posts", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, postType = "discussion", tags = [] } = req.body;

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Post content is required" });
    }

    const newPost = await dbHelpers.insertOne("communityPosts", {
      title: title || "",
      content: content.trim(),
      groupId: id,
      userId: req.user.id,
      postType: postType || "discussion",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: {
        ...newPost,
        userName: req.user.name || "You",
        author: req.user.name || "You",
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/study-groups/:id/posts/:postId
// @desc    Get single post with comments
router.get("/:id/posts/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await dbHelpers.findById("communityPosts", postId);
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const comments = await dbHelpers.find("communityComments", {
      postId,
      isActive: true,
    });
    const commentsWithUser = await Promise.all(
      (comments || []).map(async (c) => {
        const user = await dbHelpers.findById("users", c.userId || c.user_id);
        return {
          ...c,
          userName: user?.name || "Student",
        };
      }),
    );

    res.json({
      success: true,
      data: {
        ...post,
        comments: commentsWithUser,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups/:id/posts/:postId/comments
// @desc    Add a comment to a group post
router.post("/:id/posts/:postId/comments", protect, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment content is required" });
    }

    const comment = await dbHelpers.insertOne("communityComments", {
      postId,
      userId: req.user.id,
      content: content.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: {
        ...comment,
        userName: req.user.name || "You",
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups/:id/posts/:postId/like
// @desc    Like / toggle upvote on a group post
router.post("/:id/posts/:postId/like", protect, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await dbHelpers.findById("communityPosts", postId);
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const currentLikes = Number(post.likes ?? post.upvotes ?? 0);
    const updated = await dbHelpers.updateById("communityPosts", postId, {
      likes: currentLikes + 1,
      upvotes: currentLikes + 1,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: updated,
      message: "Post liked successfully",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   PUT /api/study-groups/:id/posts/:postId/pin
// @desc    Pin / unpin a group post
router.put("/:id/posts/:postId/pin", protect, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await dbHelpers.findById("communityPosts", postId);
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const isPinned = Boolean(post.isPinned ?? post.is_pinned ?? false);
    const updated = await dbHelpers.updateById("communityPosts", postId, {
      isPinned: !isPinned,
      is_pinned: !isPinned,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: updated,
      message: !isPinned
        ? "Post pinned successfully"
        : "Post unpinned successfully",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups/matchmaker/find-peers
// @desc    Match candidate with peer learners based on target exam and complementary strengths
// @access  Protected
router.post("/matchmaker/find-peers", protect, async (req, res) => {
  try {
    const user = req.user;
    const {
      targetExam,
      strongSubject,
      weakSubject,
      preferredSlot,
      limit = 5,
    } = req.body;

    const candidateProfile = {
      id: user.id,
      name: user.name,
      targetExam: targetExam || user.target_exam || "SSC CGL",
      strongSubject: strongSubject || "Quantitative Aptitude",
      weakSubject: weakSubject || "General Awareness",
      preferredSlot: preferredSlot || "Evening",
    };

    // Candidate pool: users or studyGroup members
    const pool = await dbHelpers
      .find("users", { is_active: true })
      .catch(() => []);
    const matches = findPeerMatches(candidateProfile, pool, Number(limit));

    res.json({
      success: true,
      data: {
        profile: candidateProfile,
        matches,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups/duels/create
// @desc    Create a 1v1 live rapid-fire quiz duel challenge
// @access  Protected
router.post("/duels/create", protect, async (req, res) => {
  try {
    const initiator = { id: req.user.id, name: req.user.name || "Player 1" };
    const { opponentId, opponentName, subject } = req.body;

    if (!opponentId) {
      return res
        .status(400)
        .json({ success: false, message: "opponentId is required" });
    }

    const opponent = {
      id: opponentId,
      name: opponentName || `Player #${opponentId}`,
    };
    const duel = createQuizDuel(initiator, opponent, { subject });

    res.status(201).json({
      success: true,
      data: duel,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/study-groups/duels/:duelId
// @desc    Get duel state and current participant scores
// @access  Protected
router.get("/duels/:duelId", protect, async (req, res) => {
  try {
    const duel = getDuelStatus(req.params.duelId);
    res.json({
      success: true,
      data: duel,
    });
  } catch (error) {
    res
      .status(404)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   POST /api/study-groups/duels/:duelId/answer
// @desc    Submit answer in active 1v1 quiz duel
// @access  Protected
router.post("/duels/:duelId/answer", protect, async (req, res) => {
  try {
    const { duelId } = req.params;
    const { questionIndex, selectedOption, responseTimeMs } = req.body;

    const result = submitDuelAnswer(duelId, req.user.id, {
      questionIndex,
      selectedOption,
      responseTimeMs,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
