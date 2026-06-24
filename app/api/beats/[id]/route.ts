import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/beats/:id
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;          // ← await params
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const beat = await prisma.beat.findFirst({
      where: { id, userId: user.id },
    });

    if (!beat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(beat);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// PUT /api/beats/:id
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;          // ← await params
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();

    // Safer update: constrain by both id & userId so you can’t change another user’s beat
    const updated = await prisma.beat.updateMany({
      where: { id, userId: user.id },
      data: {
        name: body.name,
        bpm: body.bpm,
        steps: body.steps,
        pattern: body.pattern,
        ...(body.folder !== undefined ? { folder: body.folder } : {}),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const beat = await prisma.beat.findUnique({ where: { id } });
    return NextResponse.json(beat);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

// DELETE /api/beats/:id
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;          // ← await params
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Delete guarded by userId
    const deleted = await prisma.beat.deleteMany({
      where: { id, userId: user.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }
}
