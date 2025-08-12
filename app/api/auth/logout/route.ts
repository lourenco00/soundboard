import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  cookies().set({ name: "sb_session", value: "", path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}