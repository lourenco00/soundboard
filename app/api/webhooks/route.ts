export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const stripe = getStripe();
  const rawBody = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, secret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Update DB entitlements. handleStripeEvent is the source of truth for
  // user.plan and ignores event types it doesn't care about.
  try {
    const handled = await handleStripeEvent(event);
    return NextResponse.json({ received: true, handled });
  } catch (e) {
    console.error("Webhook handler error:", e);
    // 500 → Stripe will retry the delivery
    return NextResponse.json({ received: true, handled: false }, { status: 500 });
  }
}
