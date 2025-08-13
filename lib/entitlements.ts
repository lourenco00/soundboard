// lib/entitlements.ts
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const COOKIE = "sb_entitlements";
const SECRET = process.env.AUTH_JWT_SECRET!; // reuse or separate secret

export function signEntitlements(payload: any, maxAgeSeconds: number) {
  return jwt.sign(payload, SECRET, { expiresIn: maxAgeSeconds });
}

export async function readEntitlements() {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return jwt.verify(raw, SECRET);
  } catch {
    return null;
  }
}

export async function setEntitlementsCookie(token: string) {
  const store = await cookies();
  store.set({
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
