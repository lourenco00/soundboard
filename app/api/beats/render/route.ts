import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserOrThrow } from "@/lib/auth";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUserOrThrow();
    const { name, wavBase64, durationMs } = await req.json();

    if (!wavBase64?.startsWith("data:audio/wav;base64,")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const b64 = wavBase64.split(",")[1];
    const buf = Buffer.from(b64, "base64");

    const fileId = crypto.randomBytes(8).toString("hex");
    const safeName = (name || "My Beat").replace(/[^\w\- ]+/g, "").trim() || "Beat";
    const filename = `${safeName}-${fileId}.wav`;

    const dir = path.join(process.cwd(), "public", "sounds", "user", user.id);
    await mkdir(dir, { recursive: true });

    const filePath = path.join(dir, filename);
    await writeFile(filePath, buf);

    const src = `/sounds/user/${user.id}/${filename}`;
    const record = await prisma.userSound.create({
      data: { userId: user.id, name: safeName, src, durationMs: Math.round(durationMs || 0), kind: "BEAT" }
    });

    return NextResponse.json(record, { status: 201 });
  } catch (e: any) {
    const msg = e?.message === "UNAUTHENTICATED" ? "Unauthorized" : "Failed to save";
    return NextResponse.json({ error: msg }, { status: e?.message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}
