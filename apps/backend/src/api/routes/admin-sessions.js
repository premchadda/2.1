import express from "express";
import sessionController from "../../modules/sessions/session.controller.js";

const router = express.Router();

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
