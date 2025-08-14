import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";     // ✅ FIXED
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const beats = await prisma.beat.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json(beats);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const beat = await prisma.beat.create({
      data: {
        userId: user.id,
        name: body.name || "New Beat",
        bpm: body.bpm || 120,
        steps: body.steps || 16,
        pattern: body.pattern || { tracks: [] }
      }
    });
    return NextResponse.json(beat, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}
