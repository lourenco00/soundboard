// lib/stripe.ts
import Stripe from "stripe";

let _stripe: Stripe | undefined;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing");
  // Simplest: let the SDK use its pinned apiVersion
  _stripe = new Stripe(key);
  // If you want to pin: _stripe = new Stripe(key, { apiVersion: "2025-07-30.basil" });
  return _stripe;
}
