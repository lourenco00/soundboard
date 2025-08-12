import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./db";
import bcrypt from "bcrypt";

const COOKIE = "sb_session";
const SECRET = process.env.AUTH_JWT_SECRET!;

export type Session = { uid: string };

export function createSessionToken(s: Session, ttl = "30d") {
  return jwt.sign(s, SECRET, { expiresIn: ttl });
}

export function readSession(): Session | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  try { return jwt.verify(raw, SECRET) as Session; } catch { return null; }
}

export async function requireUser() {
  const sess = readSession();
  if (!sess) return null;
  return prisma.user.findUnique({ where: { id: sess.uid } });
}

export function setSessionCookie(token: string) {
  cookies().set({
    name: COOKIE, value: token, httpOnly: true, secure: true,
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}