import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await requireUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const row = await prisma.pianoPreset.findFirst({
    where: { id, userId: user.id },
  });
  if (!row) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({
    ...(row.data as object),
    id: row.id,
    name: row.name,
    folder: row.folder ?? null,
  });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await prisma.pianoPreset.deleteMany({
    where: { id, userId: user.id },
  });
  return NextResponse.json({ ok: deleted.count > 0 });
}
