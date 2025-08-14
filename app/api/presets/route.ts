import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const g: any = globalThis as any;
if (!g.__PIANO_PRESETS__) g.__PIANO_PRESETS__ = [];
if (!g.__PRESET_FOLDERS__) g.__PRESET_FOLDERS__ = []; // {id,name}

export async function GET() {
  try {
    const { uid } = requireUser();

    const beats = await prisma.beat.findMany({
      where: { userId: uid },
      select: { id: true, name: true, folder: true },
      orderBy: { name: "asc" },
    });

    const pianos = (g.__PIANO_PRESETS__ as any[]).filter(p => p.userId === uid);

    const items = [
      ...beats.map(b => ({ id: b.id, name: b.name, kind: "step",  folder: b.folder || null })),
      ...pianos.map(p => ({ id: p.id, name: p.name, kind: "piano", folder: p.folder || null })),
    ];

    return NextResponse.json({ folders: g.__PRESET_FOLDERS__, items });
  } catch {
    return NextResponse.json({ folders: [], items: [] });
  }
}
