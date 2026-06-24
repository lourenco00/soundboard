import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/my-sounds → the user's saved/rendered sounds ({ id, name, src })
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json([], { status: 200 });

  const rows = await prisma.userSound.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    rows.map(r => ({ id: r.id, name: r.name, src: r.src, kind: r.kind, durationMs: r.durationMs }))
  );
}

// POST /api/my-sounds → register a sound the client already has a URL for
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body?.src || !body?.name) {
    return NextResponse.json({ error: "name and src are required" }, { status: 400 });
  }

  const created = await prisma.userSound.create({
    data: {
      userId: user.id,
      name: String(body.name),
      src: String(body.src),
      kind: body.kind === "SAMPLE" ? "SAMPLE" : "BEAT",
      durationMs: Math.round(Number(body.durationMs) || 0),
    },
  });

  return NextResponse.json({ id: created.id, name: created.name, src: created.src }, { status: 201 });
}
