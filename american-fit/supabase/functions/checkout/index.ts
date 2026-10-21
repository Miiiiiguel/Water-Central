// Supabase Edge Function: creates a hosted checkout for a plan.
//
//   POST { plan: "pro" | "elite", period: "monthly" | "yearly", gateway: "wompi" | "stripe" }
//   Authorization: Bearer <user access token>   (supabase.functions.invoke adds it)
//   → { url }  hosted checkout to redirect to
//
// Secrets (supabase secrets set …): PUBLIC_APP_URL, WOMPI_PUBLIC_KEY,
// WOMPI_INTEGRITY_SECRET, STRIPE_SECRET_KEY, STRIPE_PRICE_PRO_MONTHLY,
// STRIPE_PRICE_PRO_YEARLY, STRIPE_PRICE_ELITE_MONTHLY, STRIPE_PRICE_ELITE_YEARLY.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Keep in sync with src/lib/payments.ts.
const PRICES = {
  pro: { monthly: { USD: 12.99, COP: 49_900 }, yearly: { USD: 99.99, COP: 399_900 } },
  elite: { monthly: { USD: 29.99, COP: 119_900 }, yearly: { USD: 249.99, COP: 999_900 } },
} as const;

// One-time Tienda products. Keep in sync with src/data/shop.ts.
const PRODUCTS: Record<string, { name: string; COP: number; USD: number }> = {
  "revision-tecnica-3": { name: "3 revisiones de técnica", COP: 59_900, USD: 15.99 },
  "sesion-1a1": { name: "Sesión 1:1 con coach", COP: 99_900, USD: 25.99 },
  "plan-nutricional": { name: "Plan de alimentación personalizado", COP: 149_900, USD: 39.99 },
  "programa-gluteos": { name: "Programa Glúteos de acero", COP: 89_900, USD: 22.99 },
  "programa-hipertrofia": { name: "Programa Hipertrofia Torso / Pierna", COP: 89_900, USD: 22.99 },
  "programa-fuerza": { name: "Programa Fuerza 5×5", COP: 79_900, USD: 19.99 },
  "clases-privadas-4": { name: "4 clases privadas en vivo", COP: 349_900, USD: 89.99 },
  "reto-21": { name: "Reto 21 días guiado", COP: 39_900, USD: 9.99 },
  "regalo-pro-3m": { name: "Tarjeta regalo Pro · 3 meses", COP: 139_900, USD: 34.99 },
  "regalo-pro-12m": { name: "Tarjeta regalo Pro · 12 meses", COP: 399_900, USD: 99.99 },
  "propina-5": { name: "Propina para el coach", COP: 5_000, USD: 1.49 },
  "propina-10": { name: "Propina para el coach", COP: 10_000, USD: 2.99 },
  "propina-20": { name: "Propina para el coach", COP: 20_000, USD: 5.49 },
};

const env = (k: string) => Deno.env.get(k) ?? "";

const cors = {
  "Access-Control-Allow-Origin": env("PUBLIC_APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth.user;
  if (!user) return json({ error: "Inicia sesión para pagar." }, 401);

  const body = await req.json().catch(() => ({}));

  // { action: "cancel" } stops renewal; the plan stays until the paid period ends.
  if (body.action === "cancel") {
    const { data: sub } = await admin.from("af_subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    if (!sub) return json({ error: "No tienes una suscripción activa." }, 404);
    if (sub.provider === "stripe" && sub.provider_ref) {
      await fetch(`https://api.stripe.com/v1/subscriptions/${sub.provider_ref}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ cancel_at_period_end: "true" }),
      });
    }
    await admin.from("af_subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("user_id", user.id);
    return json({ ok: true });
  }

  // { product, gateway } → one-time purchase.
  if (body.product) {
    const item = PRODUCTS[body.product];
    if (!item || !["wompi", "stripe"].includes(body.gateway)) return json({ error: "Producto o método de pago no válido." }, 400);
    const appUrl = env("PUBLIC_APP_URL").replace(/\/$/, "");
    const returnUrl = `${appUrl}/pago/resultado`;
    if (body.gateway === "wompi") {
      const reference = `AFP-${crypto.randomUUID()}`;
      const cents = item.COP * 100;
      const signature = await sha256(`${reference}${cents}COP${env("WOMPI_INTEGRITY_SECRET")}`);
      const { error } = await admin.from("af_payments").insert({ user_id: user.id, provider: "wompi", reference, product: body.product, amount: item.COP, currency: "COP" });
      if (error) return json({ error: "No pudimos registrar el pago." }, 500);
      const q = new URLSearchParams({
        "public-key": env("WOMPI_PUBLIC_KEY"),
        currency: "COP",
        "amount-in-cents": String(cents),
        reference,
        "signature:integrity": signature,
        "redirect-url": `${returnUrl}?provider=wompi`,
      });
      if (user.email) q.set("customer-data:email", user.email);
      return json({ url: `https://checkout.wompi.co/p/?${q}` });
    }
    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(Math.round(item.USD * 100)),
      "line_items[0][price_data][product_data][name]": item.name,
      "line_items[0][quantity]": "1",
      client_reference_id: user.id,
      success_url: `${returnUrl}?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/tienda`,
      "metadata[user_id]": user.id,
      "metadata[product]": body.product,
    });
    if (user.email) form.set("customer_email", user.email);
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const session = await res.json();
    if (!res.ok) return json({ error: "No pudimos abrir el pago con tarjeta." }, 502);
    await admin.from("af_payments").insert({ user_id: user.id, provider: "stripe", reference: session.id, product: body.product, amount: item.USD, currency: "USD" });
    return json({ url: session.url });
  }

  const { plan, period, gateway } = body;
  if (!(plan in PRICES) || !["monthly", "yearly"].includes(period) || !["wompi", "stripe"].includes(gateway)) {
    return json({ error: "Plan o método de pago no válido." }, 400);
  }
  const price = PRICES[plan as keyof typeof PRICES][period as "monthly" | "yearly"];
  // Never trust a return URL from the browser: build it from our own origin.
  const appUrl = env("PUBLIC_APP_URL").replace(/\/$/, "");
  const returnUrl = `${appUrl}/pago/resultado`;

  if (gateway === "wompi") {
    const reference = `AF-${crypto.randomUUID()}`;
    const cents = price.COP * 100;
    const signature = await sha256(`${reference}${cents}COP${env("WOMPI_INTEGRITY_SECRET")}`);
    const { error } = await admin.from("af_payments").insert({
      user_id: user.id,
      provider: "wompi",
      reference,
      plan,
      period,
      amount: price.COP,
      currency: "COP",
    });
    if (error) return json({ error: "No pudimos registrar el pago." }, 500);
    const q = new URLSearchParams({
      "public-key": env("WOMPI_PUBLIC_KEY"),
      currency: "COP",
      "amount-in-cents": String(cents),
      reference,
      "signature:integrity": signature,
      "redirect-url": `${returnUrl}?provider=wompi`,
    });
    if (user.email) q.set("customer-data:email", user.email);
    return json({ url: `https://checkout.wompi.co/p/?${q}` });
  }

  const priceId = env(`STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`);
  if (!priceId) return json({ error: "Este plan aún no está disponible con tarjeta internacional." }, 400);
  const form = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    success_url: `${returnUrl}?provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/planes`,
    "metadata[user_id]": user.id,
    "metadata[plan]": plan,
    "metadata[period]": period,
    "subscription_data[metadata][user_id]": user.id,
    "subscription_data[metadata][plan]": plan,
    "subscription_data[metadata][period]": period,
    allow_promotion_codes: "true",
  });
  if (user.email) form.set("customer_email", user.email);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const session = await res.json();
  if (!res.ok) return json({ error: "No pudimos abrir el pago con tarjeta." }, 502);
  await admin.from("af_payments").insert({
    user_id: user.id,
    provider: "stripe",
    reference: session.id,
    plan,
    period,
    amount: price.USD,
    currency: "USD",
  });
  return json({ url: session.url });
});
