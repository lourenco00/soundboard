export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

function getBaseUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_PUBLIC_URL;
  if (env) return env.replace(/\/+$/, "");
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const host  = (req.headers.get("x-forwarded-host")  || req.headers.get("host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const price = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  if (!price) return NextResponse.json({ error: "Missing NEXT_PUBLIC_STRIPE_PRICE_ID" }, { status: 500 });

  const base = getBaseUrl(req);
  const success = `${base}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancel  = `${base}/cancel`;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: success,
    cancel_url: cancel,
    allow_promotion_codes: true,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}

export async function GET() {
  return NextResponse.redirect("/api/entitlements");
}
