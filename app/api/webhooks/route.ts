import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const buf = Buffer.from(await req.arrayBuffer());

  let event;
  try { event = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2023-10-16" })
      .webhooks.constructEvent(buf, sig!, secret); }
  catch (e:any) { return new NextResponse(`Bad signature: ${e.message}`, { status: 400 }); }

  try {
    if (event.type === "customer.subscription.deleted" ||
        event.type === "customer.subscription.unpaid" ||
        event.type === "customer.subscription.paused") {
      const sub = event.data.object as any;
      const custId = sub.customer as string;
      await prisma.user.updateMany({ where: { stripeCustId: custId }, data: { plan: "FREE" } });
    }
    return NextResponse.json({ received: true });
  } catch (e:any) {
    return new NextResponse(`Webhook error: ${e.message}`, { status: 500 });
  }
}