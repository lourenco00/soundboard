import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const g: any = globalThis as any;
if (!g.__PIANO_PRESETS__) g.__PIANO_PRESETS__ = [];

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const { uid } = requireUser();
    const p = (g.__PIANO_PRESETS__ as any[]).find(x => x.id === id && x.userId === uid);
    if (!p) return new NextResponse("Not found", { status: 404 });
    return NextResponse.json(p);
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const { uid } = requireUser();
    const before = g.__PIANO_PRESETS__.length;
    g.__PIANO_PRESETS__ = g.__PIANO_PRESETS__.filter((x: any) => !(x.id === id && x.userId === uid));
    const ok = g.__PIANO_PRESETS__.length !== before;
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
