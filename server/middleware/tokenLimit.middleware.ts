import type { Request, Response, NextFunction } from "express";
import { createGuestUser } from "../services/guest.service";
import { getTodayTokenUsage, getNextResetTimeIST } from "../services/token.service";

/**
 * Ensures requests that need a user always have a persisted user record.
 * Anonymous callers receive a temporary guest user whose ID is returned in
 * both req.body.userId and the X-User-Id response header.
 */
export async function ensureUserId(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.body.userId) {
      const guest = await createGuestUser();
      req.body.userId = guest.userId;
    }

    res.setHeader("X-User-Id", req.body.userId);
    next();
  } catch (error) {
    console.error("Failed to resolve request user:", error);
    res.status(500).json({ error: "Failed to create guest user" });
  }
}

/**
 * Middleware: check whether the user has daily tokens remaining.
 * Performs a daily reset check (IST-based) before evaluating the quota.
 */
export async function checkTokenLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.body.userId;

    if (!userId) {
      res.status(500).json({ error: "Request user was not initialized" });
      return;
    }

    // getTodayTokenUsage already calls checkAndResetDaily internally
    const tokenInfo = await getTodayTokenUsage(userId);

    if (!tokenInfo.canMakeRequest) {
      const resetTime = getNextResetTimeIST();
      res.status(429).json({
        error: "Daily token limit reached",
        message: `You have used all your tokens for today. Resets at 12:00 AM IST.`,
        tokenUsage: {
          tokensUsedToday: tokenInfo.tokensUsedToday,
          tokensRemaining: 0,
          dailyLimit: tokenInfo.dailyLimit,
          contextWindowLimit: tokenInfo.contextWindowLimit,
          requestCount: tokenInfo.requestCount,
          resetTime,
        },
      });
      return;
    }

    // Attach token info for downstream handlers
    (req as any).tokenInfo = tokenInfo;
    next();
  } catch (error) {
    console.error("Token limit check error:", error);
    res.status(500).json({ error: "Failed to check token limit" });
  }
}