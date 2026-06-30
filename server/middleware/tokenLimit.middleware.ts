import type { Request, Response, NextFunction } from "express";
import { getTodayTokenUsage } from "../services/token.service";

export async function checkTokenLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get userId from request body
    const userId = req.body.userId;

    if (!userId) {
      res.status(400).json({ error: "userId is required for token tracking" });
      return;
    }

    // Check today's token usage
    const tokenInfo = await getTodayTokenUsage(userId);

    if (!tokenInfo.canMakeRequest) {
      res.status(429).json({
        error: "Daily token limit exceeded",
        message: "You have used all your tokens for today. Please try again tomorrow.",
        tokenUsage: {
          tokensUsed: tokenInfo.tokensUsed,
          tokensRemaining: 0,
          dailyLimit: tokenInfo.dailyLimit,
          requestCount: tokenInfo.requestCount,
          resetTime: getNextResetTime(),
        },
      });
      return;
    }

    // Attach token info to request for later use
    (req as any).tokenInfo = tokenInfo;

    next();
  } catch (error) {
    console.error("Token limit check error:", error);
    res.status(500).json({ error: "Failed to check token limit" });
  }
}

function getNextResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}
