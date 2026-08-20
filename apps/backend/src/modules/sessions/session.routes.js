import express from "express";
import sessionController from "./session.controller.js";
import { protect } from "../../middleware/auth.middleware.js";
import { validateCsrfToken } from "../../middleware/csrf.middleware.js";

const router = express.Router();

// All session routes require authentication
router.use(protect);

// GET /api/sessions — list current user's active sessions
router.get("/", sessionController.getMySessions);

// DELETE /api/sessions — revoke all other sessions for current user (except current session)
router.delete("/", validateCsrfToken, sessionController.revokeAllSessions);

// DELETE /api/sessions/:sessionId — revoke specific session
router.delete(
  "/:sessionId",
  validateCsrfToken,
  sessionController.revokeSession,
);

export default router;
