import type { Request, Response, NextFunction } from "express";
import { isBlacklisted, verifyToken } from "../services/auth.service";

export type AuthRequest = Request & { auth?: { userId: string; email: string; jti: string } };

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const cookieName = process.env.AUTH_COOKIE_NAME || "purplexity_session";
    const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined;
    const token = req.cookies?.[cookieName] || bearer;
    if (!token) return void res.status(401).json({ error: "Authentication required" });
    const payload = verifyToken(token);
    if (payload.type !== "session" || await isBlacklisted(payload.jti)) return void res.status(401).json({ error: "Session is no longer valid" });
    req.auth = { userId: payload.sub, email: payload.email, jti: payload.jti };
    req.body ||= {};
    req.body.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
