import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const g: any = globalThis as any;
if (!g.__PIANO_PRESETS__) g.__PIANO_PRESETS__ = [];

export async function GET() {
  try {
    const { uid } = requireUser();
    return NextResponse.json((g.__PIANO_PRESETS__ as any[]).filter(p => p.userId === uid));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const { uid } = requireUser();
    const body = await req.json();
    const item = { ...body, userId: uid }; // allow optional {folder}
    const i = g.__PIANO_PRESETS__.findIndex((p: any) => p.id === body.id && p.userId === uid);
    if (i >= 0) g.__PIANO_PRESETS__[i] = item;
    else g.__PIANO_PRESETS__.push(item);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
