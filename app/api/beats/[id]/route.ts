import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = requireUser();
    const beat = await prisma.beat.findFirst({ where: { id: params.id, userId: uid } });
    if (!beat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(beat);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = requireUser();
    const body = await req.json();
    const beat = await prisma.beat.update({
      where: { id: params.id },
      data: {
        name: body.name,
        bpm: body.bpm,
        steps: body.steps,
        pattern: body.pattern
      }
    });
    if (beat.userId !== uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(beat);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = requireUser();
    const beat = await prisma.beat.findUnique({ where: { id: params.id } });
    if (!beat || beat.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.beat.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }
}
