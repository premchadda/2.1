import express from "express";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

// @route   GET /api/blogs
// @desc    Get all published blog posts
// @access  Public
router.get("/", async (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const categoryFilter = category && category !== "all" ? category : null;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM blogs
      WHERE deleted_at IS NULL
        AND (status = 'published' OR (status != 'draft' AND status IS NOT NULL))
        AND ($1::text IS NULL OR category = $1)
    `;
    const dataQuery = `
      SELECT *
      FROM blogs
      WHERE deleted_at IS NULL
        AND (status = 'published' OR (status != 'draft' AND status IS NOT NULL))
        AND ($1::text IS NULL OR category = $1)
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [{ rows: countRows }, { rows: blogs }] = await Promise.all([
      pool.query(countQuery, [categoryFilter]),
      pool.query(dataQuery, [categoryFilter, parsedLimit, parsedOffset]),
    ]);

    const total = countRows[0]?.total ?? blogs.length;

    res.json({
      success: true,
      data: blogs,
      count: blogs.length,
      total,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/blogs/categories
// @desc    Get all blog categories
// @access  Public
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT category
      FROM blogs
      WHERE deleted_at IS NULL
        AND (status = 'published' OR (status != 'draft' AND status IS NOT NULL))
        AND category IS NOT NULL AND TRIM(category) != ''
      ORDER BY category ASC
    `);
    const categories = rows.map((r) => r.category);

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/blogs/admin/list
// @desc    Get all blog posts (Admin - including drafts)
// @access  Private/Admin
router.get("/admin/list", protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;
    const categoryFilter = category && category !== "all" ? category : null;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM blogs
      WHERE deleted_at IS NULL
        AND ($1::text IS NULL OR category = $1)
    `;
    const dataQuery = `
      SELECT *
      FROM blogs
      WHERE deleted_at IS NULL
        AND ($1::text IS NULL OR category = $1)
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [{ rows: countRows }, { rows: paginated }] = await Promise.all([
      pool.query(countQuery, [categoryFilter]),
      pool.query(dataQuery, [categoryFilter, limitNum, offset]),
    ]);

    const total = countRows[0]?.total ?? paginated.length;

    res.json({
      success: true,
      data: paginated,
      count: paginated.length,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/blogs/:id
// @desc    Get single blog post
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let blog = null;
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      blog = await dbHelpers.findById("blogs", numId);
    }

    if (!blog) {
      const { rows } = await pool.query(
        "SELECT * FROM blogs WHERE slug = $1 AND deleted_at IS NULL LIMIT 1",
        [id],
      );
      blog = rows[0] || null;
    }

    if (!blog || blog.deletedAt || blog.deleted_at) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    res.json({
      success: true,
      data: blog,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// ===== BLOG ADMIN CRUD OPERATIONS =====
// @route   POST /api/blogs
// @desc    Create a new blog post (Admin)
// @access  Private/Admin
router.post("/", protect, admin, async (req, res) => {
  try {
    const {
      title,
      slug,
      content,
      excerpt,
      category,
      tags,
      featuredImage,
      status = "published",
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required",
      });
    }

    const blogSlug =
      slug ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    // Check if slug already exists
    const { rows: existingBlogs } = await pool.query(
      "SELECT id FROM blogs WHERE slug = $1 AND deleted_at IS NULL LIMIT 1",
      [blogSlug],
    );
    if (existingBlogs.length > 0) {
      return res.status(400).json({
        success: false,
        message: "A blog post with this slug already exists",
      });
    }

    const newBlog = await dbHelpers.insertOne("blogs", {
      title,
      slug: blogSlug,
      content,
      excerpt: excerpt || "",
      category: category || "",
      tags: tags || [],
      featured_image: featuredImage || "",
      status,
      author_id: req.user.id,
      published_at: status === "published" ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: newBlog,
      message: "Blog post created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   PUT /api/blogs/:id
// @desc    Update a blog post (Admin)
// @access  Private/Admin
router.put("/:id", protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      content,
      excerpt,
      category,
      tags,
      featuredImage,
      status,
    } = req.body;

    const blog = await dbHelpers.findById("blogs", id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    const updateData = { updated_at: new Date().toISOString() };

    if (title) {
      updateData.title = title;
      updateData.slug =
        slug ||
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
    }

    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (featuredImage !== undefined) updateData.featured_image = featuredImage;
    if (status !== undefined) {
      updateData.status = status;
      if (status === "published" && !blog.published_at) {
        updateData.published_at = new Date().toISOString();
      }
    }

    const updated = await dbHelpers.updateById("blogs", id, updateData);

    res.json({
      success: true,
      data: updated,
      message: "Blog post updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   DELETE /api/blogs/:id
// @desc    Delete a blog post (Admin)
// @access  Private/Admin
router.delete("/:id", protect, admin, async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await dbHelpers.findById("blogs", id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    await dbHelpers.softDelete("blogs", id, req.user.id);

    res.json({
      success: true,
      message: "Blog post moved to trash",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

export default router;
