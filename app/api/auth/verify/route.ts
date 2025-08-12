import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const vt = await prisma.verificationToken.findUnique({ where: { token } });
  if (!vt || vt.expiresAt < new Date()) return NextResponse.json({ error: "Invalid or expired" }, { status: 400 });

  await prisma.user.update({ where: { id: vt.userId }, data: { emailVerifiedAt: new Date() } });
  await prisma.verificationToken.delete({ where: { id: vt.id } });

  const jwt = createSessionToken({ uid: vt.userId });
  setSessionCookie(jwt);

  return NextResponse.json({ ok: true });
}