import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../config/db.config";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { blacklistToken, comparePassword, hashPassword, publicUser, sendVerificationEmail, signSession, verifyToken } from "../services/auth.service";
import { requireAuth, type AuthRequest } from "../middleware/auth.middleware";

const router = Router();
const cookieName = () => process.env.AUTH_COOKIE_NAME || "purplexity_session";
const clientUrl = () => process.env.CLIENT_URL || "http://localhost:3000";

// ── Register ──────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !name || typeof password !== "string" || password.length < 8) return void res.status(400).json({ error: "Name, email, and a password of at least 8 characters are required" });
    const normalized = String(email).trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email: normalized } })) return void res.status(409).json({ error: "An account with this email already exists" });
    const user = await prisma.user.create({ data: { email: normalized, name: String(name).trim(), provider: "Credentials", passwordHash: await hashPassword(password), tokenLimit: 100000, dailyTokenLimit: 100000 } });
    await sendVerificationEmail(user);
    res.status(201).json({ message: "Check your email to verify your account", user: publicUser(user) });
  } catch (error) { console.error("Registration failed:", error); res.status(500).json({ error: "Could not create the account or send its verification email" }); }
});

// ── Login — returns JWT in body ───────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: String(req.body.email || "").trim().toLowerCase() } });
  if (!user?.passwordHash || !(await comparePassword(String(req.body.password || ""), user.passwordHash))) return void res.status(401).json({ error: "Incorrect email or password" });
  if (!user.emailVerified) return void res.status(403).json({ error: "Verify your email before signing in" });
  const token = signSession(user);
  res.json({ token, user: publicUser(user) });
});

// ── Verify Email ──────────────────────────────────────────────────────────────
router.get("/verify-email", async (req, res) => {
  try {
    const payload = verifyToken(String(req.query.token || ""));
    if (payload.type !== "verify") throw new Error();
    const user = await prisma.user.update({ where: { id: payload.sub }, data: { emailVerified: true } });
    const token = signSession(user);
    res.json({ message: "Email verified", token, user: publicUser(user) });
  } catch { res.status(400).json({ error: "Verification link is invalid or expired" }); }
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return void res.status(404).json({ error: "Account not found" });
  res.json({ user: publicUser(user), tokenUsage: { used: user.tokensUsed, limit: user.tokenLimit, remaining: Math.max(0, user.tokenLimit - user.tokensUsed) } });
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  const token = req.cookies?.[cookieName()] || req.headers.authorization?.slice(7);
  if (token) {
    try { await blacklistToken(verifyToken(token)); } catch {}
  }
  res.clearCookie(cookieName(), { path: "/" });
  res.json({ message: "Signed out" });
});

// ── OAuth Sync (called by frontend after Supabase OAuth completes) ────────────
// Frontend uses Supabase for the OAuth dance with Google/GitHub.
// After Supabase returns the user, frontend calls this endpoint to
// create/update the user in our Prisma DB and get our own JWT.
router.post("/oauth-sync", async (req, res) => {
  try {
    const { email, name, avatar, provider } = req.body;
    if (!email) return void res.status(400).json({ error: "Email is required" });
    const normalized = String(email).trim().toLowerCase();
    const providerName = String(provider || "oauth").charAt(0).toUpperCase() + String(provider || "oauth").slice(1);

    const user = await prisma.user.upsert({
      where: { email: normalized },
      update: {
        name: String(name || "").trim() || undefined,
        profileImage: avatar || undefined,
        emailVerified: true,
      },
      create: {
        email: normalized,
        name: String(name || "User").trim(),
        profileImage: avatar || null,
        provider: providerName,
        emailVerified: true,
        tokenLimit: 100000,
        dailyTokenLimit: 100000,
      },
    });

    const token = signSession(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error("OAuth sync error:", error);
    res.status(500).json({ error: "Failed to sync OAuth user" });
  }
});

// ── Forgot Password ───────────────────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return void res.status(400).json({ error: "Email is required" });
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (!user || user.provider !== "Credentials") {
      return void res.json({ message: "If an account exists, a reset link has been sent" });
    }
    const token = jwt.sign({ sub: user.id, email: user.email, jti: randomUUID(), type: "reset" }, process.env.JWT_SECRET!, { expiresIn: "30m" });
    const url = `${clientUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "Purplexity <no-reply@localhost>",
      to: user.email,
      subject: "Reset your Purplexity password",
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px"><h1>Reset your password</h1><p>Hi ${user.name}, click the button below to reset your password. This link expires in 30 minutes.</p><p><a href="${url}" style="display:inline-block;background:#168b86;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Reset password</a></p><p style="color:#999;font-size:12px">If you didn't request this, you can safely ignore it.</p></div>`,
    });
    res.json({ message: "If an account exists, a reset link has been sent" });
  } catch (error) { console.error("Forgot password error:", error); res.status(500).json({ error: "Failed to send reset email" }); }
});

// ── Reset Password ────────────────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || typeof password !== "string" || password.length < 8) {
      return void res.status(400).json({ error: "Valid token and a password of at least 8 characters are required" });
    }
    let payload: any;
    try { payload = jwt.verify(token, process.env.JWT_SECRET!); } catch { return void res.status(400).json({ error: "Reset link is invalid or expired" }); }
    if (payload.type !== "reset") return void res.status(400).json({ error: "Invalid token type" });
    await prisma.user.update({ where: { id: payload.sub }, data: { passwordHash: await hashPassword(password) } });
    res.json({ message: "Password updated. You can now sign in." });
  } catch (error) { console.error("Reset password error:", error); res.status(500).json({ error: "Failed to reset password" }); }
});

export default router;
