// lib/billing.ts
// Entitlement helpers shared by the Stripe webhook and the post-checkout sync.
import type Stripe from "stripe";
import { prisma } from "@/lib/db";

export type Plan = "FREE" | "PRO";

/** Subscription statuses that should grant PRO access. */
const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due", // grace period — keep access until Stripe gives up
]);

export function planForSubscriptionStatus(status: Stripe.Subscription.Status): Plan {
  return ACTIVE_STATUSES.has(status) ? "PRO" : "FREE";
}

function customerIdOf(v: string | { id: string } | null | undefined): string | undefined {
  if (!v) return undefined;
  return typeof v === "string" ? v : v.id;
}

/** Set a user's plan, located by stripe customer id (preferred), userId, or email. */
export async function applyPlan(opts: {
  plan: Plan;
  stripeCustId?: string;
  userId?: string;
  email?: string;
}): Promise<boolean> {
  const { plan, stripeCustId, userId, email } = opts;

  // Find the user by the strongest identifier available.
  let user =
    (stripeCustId && (await prisma.user.findUnique({ where: { stripeCustId } }))) ||
    (userId && (await prisma.user.findUnique({ where: { id: userId } }))) ||
    (email && (await prisma.user.findUnique({ where: { email: email.toLowerCase() } }))) ||
    null;

  if (!user) return false;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      // backfill the customer id so future subscription events resolve fast
      ...(stripeCustId && stripeCustId !== user.stripeCustId ? { stripeCustId } : {}),
    },
  });
  return true;
}

/** Apply entitlement changes for a verified Stripe event. Returns whether it was handled. */
export async function handleStripeEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const paid = s.payment_status === "paid" || s.status === "complete";
      if (!paid) return false;
      return applyPlan({
        plan: "PRO",
        stripeCustId: customerIdOf(s.customer as any),
        userId: s.client_reference_id || (s.metadata?.userId ?? undefined),
        email: s.customer_details?.email || s.customer_email || undefined,
      });
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      return applyPlan({
        plan: planForSubscriptionStatus(sub.status),
        stripeCustId: customerIdOf(sub.customer as any),
        userId: sub.metadata?.userId ?? undefined,
      });
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      return applyPlan({
        plan: "FREE",
        stripeCustId: customerIdOf(sub.customer as any),
        userId: sub.metadata?.userId ?? undefined,
      });
    }

    default:
      return false;
  }
}
