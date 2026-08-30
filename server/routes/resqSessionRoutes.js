// RESQ Mode Session Lifecycle API Routes
import express from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  createResqSession,
  findResqSessionById,
  findActiveSessionByUserId,
  endResqSession,
} from "../models/resqSessionModel.js";

const router = express.Router();

// 1. Start a new RESQ Mode Safety Session
router.post("/start", authenticate, async (req, res) => {
  try {
    const { safetyTimerMinutes = 30, trustedContacts = [], metadata = {} } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || req.user.fullName || "Field Personnel";
    const userMobile = req.user.mobile || null;

    // Check if user already has an active session
    const existingActive = await findActiveSessionByUserId(userId);
    if (existingActive) {
      // Auto-end the existing session and start a new clean session
      await endResqSession(existingActive.session_id, userId);
    }

    const session = await createResqSession({
      userId,
      userName,
      userMobile,
      safetyTimerMinutes: parseInt(safetyTimerMinutes, 10) || 30,
      trustedContacts,
      metadata,
    });

    const shareUrl = `/resq/track/${session.session_id}`;

    return res.status(201).json({
      success: true,
      message: "RESQ Mode session started successfully",
      sessionId: session.session_id,
      shareUrl,
      session,
    });
  } catch (err) {
    console.error("Failed to start RESQ session:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error starting RESQ Mode session",
    });
  }
});

// 2. Stop / Deactivate an active RESQ Mode Session
router.post("/stop", authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required to end RESQ Mode",
      });
    }

    const session = await findResqSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "RESQ Mode session not found",
      });
    }

    if (session.user_id !== userId && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to stop this session",
      });
    }

    const endedSession = await endResqSession(sessionId, session.user_id);

    return res.status(200).json({
      success: true,
      message: "RESQ Mode session ended successfully",
      sessionId,
      session: endedSession,
    });
  } catch (err) {
    console.error("Failed to stop RESQ session:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error stopping RESQ Mode session",
    });
  }
});

// 3. Get Active Session for the Authenticated User
router.get("/active/me", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const activeSession = await findActiveSessionByUserId(userId);

    if (!activeSession) {
      return res.status(200).json({
        success: true,
        active: false,
        session: null,
      });
    }

    return res.status(200).json({
      success: true,
      active: true,
      session: activeSession,
      shareUrl: `/resq/track/${activeSession.session_id}`,
    });
  } catch (err) {
    console.error("Failed to retrieve active session:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error checking active session",
    });
  }
});

// 4. Read Session Details by Session ID
router.get("/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await findResqSessionById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "RESQ Mode session not found",
      });
    }

    return res.status(200).json({
      success: true,
      session,
      shareUrl: `/resq/track/${session.session_id}`,
    });
  } catch (err) {
    console.error("Failed to fetch session details:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error retrieving session",
    });
  }
});

export default router;
