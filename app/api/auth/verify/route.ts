// app/api/auth/verify/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    // Busca token e valida expiração
    const vt = await prisma.verificationToken.findUnique({ where: { token } });
    if (!vt || vt.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired" }, { status: 400 });
    }

    // Garante atomicidade: marcar verificado e consumir o token
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: vt.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.verificationToken.delete({ where: { id: vt.id } }),
    ]);

    const jwt = createSessionToken({ uid: user.id });
    // Se o teu setSessionCookie for async (muito provável), dá await:
    await setSessionCookie(jwt);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
