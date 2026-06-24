import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

// GET /api/preset-folders → the user's folders
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ folders: [] });

  const folders = await prisma.presetFolder.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ folders });
}

// POST /api/preset-folders → create a folder
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = (body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const folder = await prisma.presetFolder.create({
    data: { userId: user.id, name },
  });
  return NextResponse.json({ id: folder.id, name: folder.name }, { status: 201 });
}
