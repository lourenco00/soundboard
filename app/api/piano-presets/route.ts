import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/piano-presets → list the current user's piano presets
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json([], { status: 200 });

  const rows = await prisma.pianoPreset.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  // return the stored payload merged with the persisted id/name so the client
  // always sees the canonical id/name regardless of what was in `data`
  const presets = rows.map(r => ({
    ...(r.data as object),
    id: r.id,
    name: r.name,
    folder: r.folder ?? null,
  }));

  return NextResponse.json(presets);
}

// POST /api/piano-presets → create or update a preset (upsert by id)
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = body?.name || "Untitled Preset";
  const folder = body?.folder ?? null;

  // If the client supplied an id that already belongs to this user, update it;
  // otherwise create a fresh row and let Prisma generate the id.
  if (body?.id) {
    const existing = await prisma.pianoPreset.findFirst({
      where: { id: body.id, userId: user.id },
    });
    if (existing) {
      const updated = await prisma.pianoPreset.update({
        where: { id: existing.id },
        data: { name, folder, data: body },
      });
      return NextResponse.json({ ok: true, id: updated.id });
    }
  }

  const created = await prisma.pianoPreset.create({
    data: { userId: user.id, name, folder, data: body },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
