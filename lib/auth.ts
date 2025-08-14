// lib/auth.ts
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import bcrypt from "bcrypt";

const COOKIE = "sb_session";
const SECRET = process.env.AUTH_JWT_SECRET!;

export type Session = { uid: string };

// ---------- tokens ----------
export function createSessionToken(s: Session, ttl = "30d") {
  return jwt.sign(s, SECRET, { expiresIn: ttl });
}

function verifyToken(token?: string): Session | null {
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET) as Session;
  } catch {
    return null;
  }
}

// ---------- readers ----------
/**
 * Reads session from:
 * 1) Cookie: sb_session
 * 2) Authorization: Bearer <jwt>   (useful for mobile/API callers)
 */
export async function readSession(): Promise<Session | null> {
  // Next 15: cookies() / headers() are async
  const cookieVal = (await cookies()).get(COOKIE)?.value;
  const auth = (await headers()).get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : undefined;

  return verifyToken(bearer) || verifyToken(cookieVal);
}

export async function getUserId(): Promise<string | null> {
  const sess = await readSession();
  return sess?.uid ?? null;
}

/** Returns the DB user or null (non-throwing). */
export async function requireUser(): Promise<import("@prisma/client").User | null> {
  const uid = await getUserId();
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid } });
}

/** Returns the DB user or throws "UNAUTHENTICATED" (throwing variant for APIs). */
export async function requireUserOrThrow() {
  const user = await requireUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

// ---------- cookie writers ----------
export async function setSessionCookie(token: string) {
  (await cookies()).set({
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30d
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

// ---------- misc ----------
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/**
 * Helper for route handlers that want both session + user quickly.
 * Returns { session: Session|null, user: User|null }
 */
export async function getAuth() {
  const session = await readSession();
  const user = session ? await prisma.user.findUnique({ where: { id: session.uid } }) : null;
  return { session, user };
}
