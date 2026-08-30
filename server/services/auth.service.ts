import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { prisma } from "../config/db.config";
import { UAParser } from "ua-parser-js";

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return process.env.JWT_SECRET;
};

export type SessionPayload = { sub: string; email: string; jti: string; type: "session" | "verify" | "oauth" };

export type SignSessionResult = { token: string; jti: string; expiresAt: Date };

/**
 * Signs a session JWT. Generates jti upfront and returns it alongside the token
 * so callers can persist the session without decoding the JWT.
 */
export function signSession(user: { id: string; email: string }): SignSessionResult {
  const jti = randomUUID();
  const expiresIn = (process.env.JWT_EXPIRES_IN || "7d") as any;
  const token = jwt.sign({ sub: user.id, email: user.email, jti, type: "session" }, secret(), { expiresIn });

  // Calculate expiry date from the JWT_EXPIRES_IN string
  const decoded = jwt.decode(token) as { exp: number };
  const expiresAt = new Date(decoded.exp * 1000);

  return { token, jti, expiresAt };
}

export function signVerification(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email, jti: randomUUID(), type: "verify" }, secret(), { expiresIn: "24h" });
}

export function signOAuthState() {
  return jwt.sign({ sub: "oauth", email: "", jti: randomUUID(), type: "oauth" }, secret(), { expiresIn: "10m" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, secret()) as SessionPayload & { exp: number };
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// ── User-Agent Parsing ────────────────────────────────────────────────────────

/**
 * Parses a raw User-Agent string into a human-readable device description.
 * e.g. "Chrome on Windows" or "Safari on macOS"
 */
export function parseUserAgent(ua: string | undefined): string {
  if (!ua) return "Unknown";
  const result = UAParser(ua);
  const browser = result.browser;
  const os = result.os;
  const browserName = browser.name || "Unknown browser";
  const osName = os.name || "Unknown OS";
  return `${browserName} on ${osName}`;
}

// ── Session Persistence ───────────────────────────────────────────────────────

/**
 * Persists a session row in the database. Wrapped in try/catch so a DB failure
 * does NOT prevent the login response from succeeding.
 * Also prunes expired sessions for the user (fire-and-forget).
 */
export async function createSession(
  jti: string,
  userId: string,
  expiresAt: Date,
  userAgent: string | undefined,
  ipAddress: string | undefined,
): Promise<void> {
  try {
    await prisma.session.create({
      data: {
        jti,
        userId,
        device: parseUserAgent(userAgent),
        ipAddress: ipAddress || null,
        expiresAt,
      },
    });
    // Fire-and-forget: prune this user's expired sessions
    pruneExpiredSessions(userId).catch(() => {});
  } catch (err) {
    console.error("Failed to persist session (login still succeeds):", err);
  }
}

/** Deletes a single session by its JWT ID. */
export async function deleteSessionByJti(jti: string): Promise<void> {
  try {
    await prisma.session.deleteMany({ where: { jti } });
  } catch (err) {
    console.error("Failed to delete session:", err);
  }
}

/** Deletes all sessions for a user. */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Removes expired session rows. If userId is provided, scopes to that user.
 * Otherwise cleans up globally (for startup cron).
 */
export async function pruneExpiredSessions(userId?: string): Promise<void> {
  const where: any = { expiresAt: { lt: new Date() } };
  if (userId) where.userId = userId;
  await prisma.session.deleteMany({ where });
}

// ── Existing helpers ──────────────────────────────────────────────────────────

export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const token = signVerification(user);
  if (!process.env.CLIENT_URL) throw new Error("CLIENT_URL environment variable is not set");
  const url = `${process.env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Purplexity <no-reply@purplexity.app>",
    to: user.email,
    subject: "Verify your Purplexity account",
    text: `Welcome to Purplexity. Verify your email: ${url}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px"><h1>Verify your email</h1><p>Hi ${user.name}, confirm your Purplexity account to unlock your 100,000 token allowance.</p><p><a href="${url}" style="display:inline-block;background:#d6ff5f;color:#111;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Verify email</a></p><p>This link expires in 24 hours.</p></div>`,
  });
}

export async function isBlacklisted(jti: string) {
  return Boolean(await prisma.revokedToken.findUnique({ where: { jti }, select: { id: true } }));
}

export async function blacklistToken(payload: SessionPayload & { exp: number }): Promise<void>;
export async function blacklistToken(jti: string, userId: string, expiresAt: Date): Promise<void>;
export async function blacklistToken(
  payloadOrJti: (SessionPayload & { exp: number }) | string,
  userId?: string,
  expiresAt?: Date,
): Promise<void> {
  if (typeof payloadOrJti === "string") {
    await prisma.revokedToken.upsert({
      where: { jti: payloadOrJti }, update: {},
      create: { jti: payloadOrJti, userId: userId!, expiresAt: expiresAt! },
    });
  } else {
    await prisma.revokedToken.upsert({
      where: { jti: payloadOrJti.jti }, update: {},
      create: { jti: payloadOrJti.jti, userId: payloadOrJti.sub, expiresAt: new Date(payloadOrJti.exp * 1000) },
    });
  }
  await prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export function publicUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}
