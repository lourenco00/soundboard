import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // enforce free plan limit
  if (user.plan === "FREE") {
    const count = await prisma.sample.count({ where: { userId: user.id } });
    const limit = parseInt(process.env.MAX_FREE_SAMPLES || "5", 10);
    if (count >= limit) {
      return NextResponse.json({ error: `Free plan limit reached (${limit}).` }, { status: 403 });
    }
  }

  // Read the multipart body natively (App Router gives us a web Request).
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const blob = file as File;
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 25MB)." }, { status: 413 });
  }

  const uploadDir = process.env.UPLOAD_DIR || "./public/uploads";
  const userDir = path.join(uploadDir, user.id);
  await fs.mkdir(userDir, { recursive: true });

  const safe = (blob.name || "sample").replace(/[^\w\-.]+/g, "_");
  const destPath = path.join(userDir, safe);

  const bytes = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(destPath, bytes);

  const publicPath = `/uploads/${user.id}/${safe}`;
  await prisma.sample.create({
    data: { userId: user.id, name: safe, path: publicPath, sizeBytes: bytes.length },
  });

  return NextResponse.json({ ok: true, path: publicPath, name: safe });
}
