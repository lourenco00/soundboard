import { NextResponse } from "next/server";

let PRESETS: any[] = []; // note: Node module scope is isolated per file in dev
// To share memory between files in dev, you can centralize in /lib/pianoStore.ts
// For now we’ll re-read from globalThis if present:
const g: any = globalThis as any;
if (!g.__PIANO_PRESETS__) g.__PIANO_PRESETS__ = [];
PRESETS = g.__PIANO_PRESETS__;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const p = PRESETS.find(x => x.id === params.id);
  if (!p) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(p);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const before = PRESETS.length;
  PRESETS = PRESETS.filter(x => x.id !== params.id);
  g.__PIANO_PRESETS__ = PRESETS;
  const ok = PRESETS.length !== before;
  return NextResponse.json({ ok });
}
