export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireUser } from "@/lib/auth";

function getBaseUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_PUBLIC_URL;
  if (env) return env.replace(/\/+$/, "");
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const host  = (req.headers.get("x-forwarded-host")  || req.headers.get("host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

/** Resolve the Stripe price id for the requested tier, with sensible fallbacks. */
function priceForTier(tier: string | null): string | undefined {
  const studio = process.env.STRIPE_PRICE_STUDIO;
  const producer = process.env.STRIPE_PRICE_PRODUCER;
  const fallback = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  if (tier === "producer") return producer || fallback;
  if (tier === "studio") return studio || fallback;
  return fallback || studio;
}

export async function POST(req: NextRequest) {
  // Read tier from the posted form (or JSON, if called that way).
  let tier: string | null = null;
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      tier = (await req.json())?.tier ?? null;
    } else {
      const form = await req.formData();
      tier = (form.get("tier") as string) || null;
    }
  } catch {
    /* no body — fall back to default price */
  }

  const price = priceForTier(tier);
  if (!price) {
    return NextResponse.json(
      { error: "No Stripe price configured (set STRIPE_PRICE_STUDIO/PRODUCER or NEXT_PUBLIC_STRIPE_PRICE_ID)" },
      { status: 500 }
    );
  }

  // Link the checkout to the signed-in user so the webhook can map it back.
  const user = await requireUser();

  const base = getBaseUrl(req);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/cancel`,
    allow_promotion_codes: true,
    ...(user?.email ? { customer_email: user.email } : {}),
    ...(user?.id ? { client_reference_id: user.id } : {}),
    metadata: { tier: tier || "studio", ...(user?.id ? { userId: user.id } : {}) },
    subscription_data: {
      metadata: { tier: tier || "studio", ...(user?.id ? { userId: user.id } : {}) },
    },
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}

export async function GET() {
  return NextResponse.redirect("/api/entitlements");
}
