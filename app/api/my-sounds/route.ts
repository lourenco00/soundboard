import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOrThrow } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUserOrThrow();
    const rows = await prisma.userSound.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, src: true, kind: true, durationMs: true }
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
