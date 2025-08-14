// app/api/entitlements/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { setEntitlementsCookie, signEntitlements } from "@/lib/entitlements";
import { requireUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ plan: "FREE" });
  return NextResponse.json({ plan: user.plan });
}

export async function POST(req: NextRequest) {
  const { session_id } = await req.json();
  if (!session_id) return new Response(JSON.stringify({ error: "Missing session_id" }), { status: 400 });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription"] });


  const email = session.customer_details?.email;
  if (!email) return NextResponse.json({ error: "No email from Stripe" }, { status: 400 });

  const isActive =
    (session.subscription as any)?.status === "active" || session.payment_status === "paid";
  if (!isActive) return NextResponse.json({ error: "Not active/paid" }, { status: 400 });

  const stripeCustId = (session.customer as any)?.id || session.customer?.toString() || undefined;

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: "$2b$12$placeholderplaceholderplaceholderpl",
      emailVerifiedAt: new Date(),
      stripeCustId,
      plan: "PRO",
    },
    update: { stripeCustId, plan: "PRO" },
  });

  const token = signEntitlements({ plan: "PRO" }, 60 * 60 * 24 * 30);
  await setEntitlementsCookie(token); // <-- await

  return NextResponse.json({ ok: true, plan: "PRO", userId: user.id });
}
