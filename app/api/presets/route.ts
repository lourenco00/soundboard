import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/presets → unified list of the user's step beats + piano presets,
// plus their folders.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ folders: [], items: [] });

  const [beats, pianos, folders] = await Promise.all([
    prisma.beat.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, folder: true },
      orderBy: { name: "asc" },
    }),
    prisma.pianoPreset.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, folder: true },
      orderBy: { name: "asc" },
    }),
    prisma.presetFolder.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const items = [
    ...beats.map(b => ({ id: b.id, name: b.name, kind: "step", folder: b.folder ?? null })),
    ...pianos.map(p => ({ id: p.id, name: p.name, kind: "piano", folder: p.folder ?? null })),
  ];

  return NextResponse.json({ folders, items });
}
