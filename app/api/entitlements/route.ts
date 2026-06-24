// app/api/entitlements/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { setEntitlementsCookie, signEntitlements } from "@/lib/entitlements";
import { requireUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { applyPlan } from "@/lib/billing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ plan: "FREE" });
  return NextResponse.json({ plan: user.plan });
}

// Post-checkout sync: confirm a Stripe session and grant PRO immediately
// (the webhook is the durable source of truth; this just avoids the wait).
export async function POST(req: NextRequest) {
  const { session_id } = await req.json();
  if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription"] });

  const email = session.customer_details?.email || session.customer_email || undefined;
  const isActive =
    (session.subscription as any)?.status === "active" || session.payment_status === "paid";
  if (!isActive) return NextResponse.json({ error: "Not active/paid" }, { status: 400 });

  const stripeCustId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || undefined;
  const userId = session.client_reference_id || session.metadata?.userId || undefined;

  // Try to flip an existing user (located by customer id / userId / email).
  const applied = await applyPlan({ plan: "PRO", stripeCustId, userId, email });

  // Fallback: a paid session with no matching account (e.g. checkout while
  // logged out) — create a verified PRO user with an unusable random password.
  if (!applied) {
    if (!email) return NextResponse.json({ error: "No email from Stripe" }, { status: 400 });
    const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
    await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      create: { email: email.toLowerCase(), passwordHash: randomHash, emailVerifiedAt: new Date(), stripeCustId, plan: "PRO" },
      update: { stripeCustId, plan: "PRO" },
    });
  }

  const token = signEntitlements({ plan: "PRO" }, 60 * 60 * 24 * 30);
  await setEntitlementsCookie(token);

  return NextResponse.json({ ok: true, plan: "PRO" });
}
