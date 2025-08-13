// app/api/me/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    email: user.email,
    plan: user.plan,
  });
}
