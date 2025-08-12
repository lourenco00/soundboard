import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string() });

export async function POST(req: NextRequest) {
  const { email, password } = schema.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  if (!user.emailVerifiedAt) return NextResponse.json({ error: "Email not verified" }, { status: 403 });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });

  const token = createSessionToken({ uid: user.id });
  setSessionCookie(token);
  return NextResponse.json({ ok: true, plan: user.plan });
}