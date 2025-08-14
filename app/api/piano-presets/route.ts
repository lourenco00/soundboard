import { NextResponse } from "next/server";

// In-memory store (swap to DB later). Ephemeral on server restarts.
let PRESETS: any[] = [];

export async function GET() {
  return NextResponse.json(PRESETS);
}

export async function POST(req: Request) {
  const body = await req.json();
  // simple upsert by id
  const idx = PRESETS.findIndex(p => p.id === body.id);
  if (idx >= 0) PRESETS[idx] = body;
  else PRESETS.push(body);
  return NextResponse.json({ ok: true });
}
