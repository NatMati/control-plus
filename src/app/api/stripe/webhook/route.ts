// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

// Usar service role para saltear RLS en subscriptions
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function planFromPriceId(priceId: string): "PRO" | "DELUXE" | null {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  if (priceId === process.env.STRIPE_DELUXE_PRICE_ID) return "DELUXE";
  return null;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 400 });
  }

  let event: Stripe.Event;
  const rawBody = await req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e: any) {
    console.error("[webhook] Signature error:", e.message);
    return NextResponse.json({ error: `Webhook error: ${e.message}` }, { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    switch (event.type) {

      // ── Suscripción creada o actualizada ────────────────────────────────
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        const priceId = sub.items.data[0]?.price?.id;
        const plan = planFromPriceId(priceId) ?? "FREE";
        const rawPeriodEnd = (sub as any).current_period_end;
        const periodEnd = rawPeriodEnd
          ? new Date(rawPeriodEnd * 1000).toISOString()
          : null;

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          plan,
          status: sub.status as any,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          current_period_end: periodEnd,
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        console.log(`[webhook] ${event.type} → user ${userId} → ${plan}`);
        break;
      }

      // ── Suscripción cancelada ────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          plan: "FREE",
          status: "canceled",
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        console.log(`[webhook] subscription deleted → user ${userId} → FREE`);
        break;
      }

      // ── Pago fallido ─────────────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as any).subscription as string | null;
        if (!subId) break;

        await supabase
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subId);

        console.log(`[webhook] payment_failed → sub ${subId}`);
        break;
      }

      default:
        break;
    }
  } catch (e: any) {
    console.error("[webhook] Handler error:", e);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
