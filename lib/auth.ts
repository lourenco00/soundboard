// lib/auth.ts
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

export async function readSession(): Promise<Session | null> {
  // Next 15: cookies() is async
  const c = (await cookies()).get(COOKIE)?.value;
  if (!c) return null;
  try { return jwt.verify(c, SECRET) as Session; } catch { return null; }
}

export async function requireUser() {
  const sess = await readSession();
  if (!sess) return null;
  return prisma.user.findUnique({ where: { id: sess.uid } });
}

export async function setSessionCookie(token: string) {
  (await cookies()).set({
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  (await cookies()).set({
    name: COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}
