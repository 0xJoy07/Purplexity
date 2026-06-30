import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { prisma } from "../config/db.config";

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return process.env.JWT_SECRET;
};

export type SessionPayload = { sub: string; email: string; jti: string; type: "session" | "verify" | "oauth" };

export function signSession(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email, jti: randomUUID(), type: "session" }, secret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any,
  });
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

export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const token = signVerification(user);
  const url = `${process.env.CLIENT_URL || "http://localhost:3001"}/verify-email?token=${encodeURIComponent(token)}`;
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Purplexity <no-reply@localhost>",
    to: user.email,
    subject: "Verify your Purplexity account",
    text: `Welcome to Purplexity. Verify your email: ${url}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px"><h1>Verify your email</h1><p>Hi ${user.name}, confirm your Purplexity account to unlock your 100,000 token allowance.</p><p><a href="${url}" style="display:inline-block;background:#d6ff5f;color:#111;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Verify email</a></p><p>This link expires in 24 hours.</p></div>`,
  });
}

export async function isBlacklisted(jti: string) {
  return Boolean(await prisma.revokedToken.findUnique({ where: { jti }, select: { id: true } }));
}

export async function blacklistToken(payload: SessionPayload & { exp: number }) {
  await prisma.revokedToken.upsert({
    where: { jti: payload.jti }, update: {},
    create: { jti: payload.jti, userId: payload.sub, expiresAt: new Date(payload.exp * 1000) },
  });
  await prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export function publicUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}
