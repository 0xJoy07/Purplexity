import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../config/db.config";
import { blacklistToken, comparePassword, hashPassword, publicUser, sendVerificationEmail, signOAuthState, signSession, verifyToken } from "../services/auth.service";
import { requireAuth, type AuthRequest } from "../middleware/auth.middleware";

const router = Router();
const cookieName = () => process.env.AUTH_COOKIE_NAME || "purplexity_session";
const clientUrl = () => process.env.CLIENT_URL || "http://localhost:3001";
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 604800000, path: "/" };
const setSession = (res: Response, user: { id: string; email: string }) => res.cookie(cookieName(), signSession(user), cookieOptions);

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

router.post("/login", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: String(req.body.email || "").trim().toLowerCase() } });
  if (!user?.passwordHash || !(await comparePassword(String(req.body.password || ""), user.passwordHash))) return void res.status(401).json({ error: "Incorrect email or password" });
  if (!user.emailVerified) return void res.status(403).json({ error: "Verify your email before signing in" });
  setSession(res, user); res.json({ user: publicUser(user) });
});

router.get("/verify-email", async (req, res) => {
  try {
    const payload = verifyToken(String(req.query.token || ""));
    if (payload.type !== "verify") throw new Error();
    const user = await prisma.user.update({ where: { id: payload.sub }, data: { emailVerified: true } });
    setSession(res, user); res.json({ message: "Email verified", user: publicUser(user) });
  } catch { res.status(400).json({ error: "Verification link is invalid or expired" }); }
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return void res.status(404).json({ error: "Account not found" });
  res.json({ user: publicUser(user), tokenUsage: { used: user.tokensUsed, limit: user.tokenLimit, remaining: Math.max(0, user.tokenLimit - user.tokensUsed) } });
});

router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  const token = req.cookies?.[cookieName()] || req.headers.authorization?.slice(7);
  if (token) await blacklistToken(verifyToken(token));
  res.clearCookie(cookieName(), { path: "/" }); res.json({ message: "Signed out" });
});

router.get("/google", (_req, res) => res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", redirect_uri: process.env.GOOGLE_CALLBACK_URL || "", response_type: "code", scope: "openid email profile", prompt: "select_account", state: signOAuthState() })}`));
router.get("/google/callback", async (req, res) => {
  try {
    if (verifyToken(String(req.query.state || "")).type !== "oauth") throw new Error();
    const tokens: any = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: String(req.query.code), client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: process.env.GOOGLE_CALLBACK_URL || "", grant_type: "authorization_code" }) }).then(r => r.json());
    const p: any = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then(r => r.json());
    if (!p.email) throw new Error();
    const user = await prisma.user.upsert({ where: { email: p.email.toLowerCase() }, update: { name: p.name, profileImage: p.picture, emailVerified: true }, create: { email: p.email.toLowerCase(), name: p.name, profileImage: p.picture, provider: "Google", emailVerified: true, tokenLimit: 100000, dailyTokenLimit: 100000 } });
    setSession(res, user); res.redirect(clientUrl());
  } catch { res.redirect(`${clientUrl()}/?authError=google`); }
});

router.get("/github", (_req, res) => res.redirect(`https://github.com/login/oauth/authorize?${new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID || "", redirect_uri: process.env.GITHUB_CALLBACK_URL || "", scope: "read:user user:email", state: signOAuthState() })}`));
router.get("/github/callback", async (req, res) => {
  try {
    if (verifyToken(String(req.query.state || "")).type !== "oauth") throw new Error();
    const tokens: any = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code: req.query.code, redirect_uri: process.env.GITHUB_CALLBACK_URL }) }).then(r => r.json());
    const headers = { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "Purplexity" };
    const p: any = await fetch("https://api.github.com/user", { headers }).then(r => r.json());
    const emails = await fetch("https://api.github.com/user/emails", { headers }).then(r => r.json()) as any[];
    const email = emails.find(e => e.primary && e.verified)?.email || emails.find(e => e.verified)?.email;
    if (!email) throw new Error();
    const user = await prisma.user.upsert({ where: { email: email.toLowerCase() }, update: { name: p.name || p.login, profileImage: p.avatar_url, emailVerified: true }, create: { email: email.toLowerCase(), name: p.name || p.login, profileImage: p.avatar_url, provider: "Github", emailVerified: true, tokenLimit: 100000, dailyTokenLimit: 100000 } });
    setSession(res, user); res.redirect(clientUrl());
  } catch { res.redirect(`${clientUrl()}/?authError=github`); }
});

export default router;
