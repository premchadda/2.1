import express from "express";
import sessionController from "../../modules/sessions/session.controller.js";
import { protect, admin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(admin);

/**
 * Admin Session Management Routes
 * Delegated to sessionController for centralized WebSocket notifications,
 * geolocation, and audit logging.
 */
router.get("/sessions", sessionController.getAllSessions);
router.get("/sessions/stats", sessionController.getSessionStats);
router.delete("/sessions/:sessionId", sessionController.revokeAnySession);
router.get("/users/:userId/sessions", sessionController.getUserSessionsById);
router.delete("/users/:userId/sessions", sessionController.revokeUserSessions);

export default router;
