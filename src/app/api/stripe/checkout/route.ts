// src/app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const plan: "PRO" | "DELUXE" = body?.plan;

  if (!plan || !["PRO", "DELUXE"].includes(plan)) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  const priceId = plan === "PRO"
    ? process.env.STRIPE_PRO_PRICE_ID!
    : process.env.STRIPE_DELUXE_PRICE_ID!;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    // Buscar o crear customer de Stripe
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/upgrade?success=true&plan=${plan.toLowerCase()}`,
      cancel_url: `${appUrl}/upgrade?canceled=true`,
      metadata: { user_id: user.id, plan },
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("[stripe/checkout]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
