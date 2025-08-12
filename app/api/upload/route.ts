import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import formidable from "formidable";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parseForm(req: NextRequest) {
  return new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    const form = formidable({ multiples: false, maxFileSize: 25 * 1024 * 1024 }); // 25MB
    // @ts-ignore
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // enforce free plan limit
  if (user.plan === "FREE") {
    const count = await prisma.sample.count({ where: { userId: user.id } });
    const limit = parseInt(process.env.MAX_FREE_SAMPLES || "5", 10);
    if (count >= limit) return NextResponse.json({ error: `Free plan limit reached (${limit}).` }, { status: 403 });
  }

  // Next App Router gives us a web Request; convert to Node req for formidable:
  // @ts-ignore
  const nodeReq = (req as any).request;
  const { files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
    const form = formidable({ multiples: false, maxFileSize: 25 * 1024 * 1024 });
    form.parse(nodeReq, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });

  const file = files.file;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const uploadDir = process.env.UPLOAD_DIR || "./public/uploads";
  const userDir = path.join(uploadDir, user.id);
  await fs.mkdir(userDir, { recursive: true });

  const src = Array.isArray(file) ? file[0].filepath : file.filepath;
  const orig = Array.isArray(file) ? file[0].originalFilename : file.originalFilename;
  const size = Array.isArray(file) ? file[0].size : file.size;

  const safe = (orig || "sample").replace(/[^\w\-.]+/g, "_");
  const destPath = path.join(userDir, safe);
  await fs.copyFile(src, destPath);

  const publicPath = `/uploads/${user.id}/${safe}`;
  await prisma.sample.create({ data: { userId: user.id, name: safe, path: publicPath, sizeBytes: Number(size) } });

  return NextResponse.json({ ok: true, path: publicPath, name: safe });
}