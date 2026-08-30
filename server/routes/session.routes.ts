import { Router } from "express";
import { prisma } from "../config/db.config";
import { blacklistToken, deleteAllUserSessions } from "../services/auth.service";
import { requireAuth, type AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// ── Active Sessions ───────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.auth!.userId;
    const currentJti = req.auth!.jti;

    // Query all non-expired sessions for this user
    const activeSessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActive: "desc" },
      select: {
        id: true,
        jti: true,
        device: true,
        ipAddress: true,
        lastActive: true,
        createdAt: true,
      },
    });

    res.json({
      currentSessionId: currentJti,
      activeSessions: activeSessions.map((s) => ({
        id: s.id,
        isCurrent: s.jti === currentJti,
        device: s.device,
        ipAddress: s.ipAddress,
        lastActive: s.lastActive.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Sessions fetch error:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// ── Sign Out All Devices ──────────────────────────────────────────────────────
router.post("/sign-out-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.auth!.userId;

    // Get all active (non-expired) session JTIs to blacklist their tokens
    const activeSessions = await prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { jti: true, expiresAt: true },
    });

    // Blacklist all active tokens so they're truly invalidated
    for (const session of activeSessions) {
      await blacklistToken(session.jti, userId, session.expiresAt);
    }

    // Delete all session rows for this user
    await deleteAllUserSessions(userId);

    res.json({ message: "Signed out of all devices. Please sign in again." });
  } catch (error) {
    console.error("Sign out all error:", error);
    res.status(500).json({ error: "Failed to sign out of all devices" });
  }
});

export default router;
