// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().transform(v => v.trim().toLowerCase()),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const { email, password } = schema.parse(await req.json());
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    if (!user.emailVerifiedAt) return NextResponse.json({ error: "Email not verified" }, { status: 403 });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });

    const token = createSessionToken({ uid: user.id });
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
