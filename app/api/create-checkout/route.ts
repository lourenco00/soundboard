import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const price = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!;
  const success = `${process.env.NEXT_PUBLIC_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancel = `${process.env.NEXT_PUBLIC_PUBLIC_URL}/cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription", // or "payment" for one-time
    line_items: [{ price, quantity: 1 }],
    success_url: success,
    cancel_url: cancel,
    allow_promotion_codes: true,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}

export async function GET() {
  // lightweight plan check (used by TopBar as /api/entitlements GET)
  // Forward to entitlements route for consistency
  return NextResponse.redirect("/api/entitlements");
}