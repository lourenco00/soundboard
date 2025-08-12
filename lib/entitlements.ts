import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

type Entitlements = {
  plan: "FREE" | "PRO";
  // Could include: customerId, subId, expiresAt, features, etc.
  exp?: number; // standard JWT expiry
};

const COOKIE_NAME = "sb_entitlements";
const secret = process.env.ENTITLEMENTS_JWT_SECRET!;

export function signEntitlements(data: Entitlements, ttlSeconds = 60 * 60 * 24 * 30) {
  return jwt.sign(data, secret, { expiresIn: ttlSeconds });
}

export function readEntitlements(): Entitlements {
  const jar = cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return { plan: "FREE" };
  try {
    return jwt.verify(token, secret) as Entitlements;
  } catch {
    return { plan: "FREE" };
  }
}

export function setEntitlementsCookie(value: string) {
  const jar = cookies();
  jar.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}