// app/api/auth/login/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().transform(v => v.trim().toLowerCase()),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  // 1) Validate input — bad input is a 400.
  let creds: { email: string; password: string };
  try {
    creds = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid email or password format" }, { status: 400 });
  }

  // 2) Authenticate — DB/unexpected failures are 500 (so they're not
  //    silently masked as "bad credentials"; this is what made the prod
  //    "DB missing" failure look like a login bug).
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: creds.email, mode: "insensitive" } },
    });
    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    if (!user.emailVerifiedAt) return NextResponse.json({ error: "Email not verified" }, { status: 403 });

    const ok = await verifyPassword(creds.password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const token = createSessionToken({ uid: user.id });
    await setSessionCookie(token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Server error — please try again" }, { status: 500 });
  }
}
