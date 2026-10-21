// Supabase Edge Function: payment confirmations from Wompi and Stripe.
//
// Point both dashboards at  https://<project>.supabase.co/functions/v1/payments-webhook
//   Wompi  → Desarrolladores → URL de eventos  (event: transaction.updated)
//   Stripe → Developers → Webhooks  (checkout.session.completed, invoice.paid,
//            customer.subscription.deleted)
// Deploy with --no-verify-jwt: gateways don't send a Supabase token; every
// request is authenticated by its own signature instead.
//
// Secrets: WOMPI_EVENTS_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.

import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const DAY = 86_400_000;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (t: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));
async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Extends (or starts) a plan by one billing period from today or its current end. */
async function activate(userId: string, plan: string, period: string, provider: string, ref: string | null, endsAt?: number) {
  const { data: cur } = await admin.from("af_subscriptions").select("current_period_end, plan").eq("user_id", userId).maybeSingle();
  const from = cur && cur.plan === plan ? Math.max(Date.now(), new Date(cur.current_period_end).getTime()) : Date.now();
  const end = endsAt ?? from + (period === "yearly" ? 365 : 30) * DAY;
  await admin.from("af_subscriptions").upsert({
    user_id: userId,
    plan,
    period,
    provider,
    status: "active",
    current_period_end: new Date(end).toISOString(),
    provider_ref: ref,
    updated_at: new Date().toISOString(),
  });
}

async function handleWompi(body: any) {
  // Checksum = SHA256(values of signature.properties + timestamp + events secret).
  const props: string[] = body?.signature?.properties ?? [];
  const values = props.map(p => p.split(".").reduce((o: any, k) => o?.[k], body.data)).join("");
  const expected = await sha256(`${values}${body.timestamp}${env("WOMPI_EVENTS_SECRET")}`);
  if (!body?.signature?.checksum || !safeEqual(expected, String(body.signature.checksum).toLowerCase())) {
    return new Response("bad signature", { status: 401 });
  }
  if (body.event !== "transaction.updated") return new Response("ignored");
  const tx = body.data.transaction;
  const { data: pay } = await admin.from("af_payments").select("*").eq("reference", tx.reference).maybeSingle();
  if (!pay || pay.status === "approved") return new Response("ok");
  if (tx.status === "APPROVED") {
    // Guard against a tampered amount: it must match what we priced.
    if (tx.amount_in_cents !== Math.round(Number(pay.amount) * 100) || tx.currency !== "COP") {
      await admin.from("af_payments").update({ status: "declined" }).eq("id", pay.id);
      return new Response("amount mismatch", { status: 400 });
    }
    await admin.from("af_payments").update({ status: "approved" }).eq("id", pay.id);
    await activate(pay.user_id, pay.plan, pay.period, "wompi", tx.id);
  } else if (["DECLINED", "VOIDED", "ERROR"].includes(tx.status)) {
    await admin.from("af_payments").update({ status: "declined" }).eq("id", pay.id);
  }
  return new Response("ok");
}

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}` } });
  return res.ok ? res.json() : null;
}

async function handleStripe(raw: string, header: string) {
  const parts = Object.fromEntries(header.split(",").map(kv => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  const expected = await hmac(env("STRIPE_WEBHOOK_SECRET"), `${parts.t}.${raw}`);
  if (!parts.v1 || !safeEqual(expected, parts.v1) || Math.abs(Date.now() / 1000 - t) > 300) {
    return new Response("bad signature", { status: 401 });
  }
  const event = JSON.parse(raw);
  const obj = event.data.object;

  if (event.type === "checkout.session.completed") {
    const { user_id, plan, period } = obj.metadata ?? {};
    if (!user_id) return new Response("ok");
    await admin.from("af_payments").update({ status: "approved" }).eq("reference", obj.id);
    const sub = obj.subscription ? await stripeGet(`subscriptions/${obj.subscription}`) : null;
    const endSec = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
    await activate(user_id, plan, period, "stripe", obj.subscription ?? null, endSec ? endSec * 1000 : undefined);
  }

  if (event.type === "invoice.paid" && obj.billing_reason === "subscription_cycle") {
    const { data: sub } = await admin.from("af_subscriptions").select("*").eq("provider_ref", obj.subscription).maybeSingle();
    if (sub) {
      const end = obj.lines?.data?.[0]?.period?.end;
      await admin.from("af_payments").upsert(
        { user_id: sub.user_id, provider: "stripe", reference: obj.id, plan: sub.plan, period: sub.period, amount: obj.amount_paid / 100, currency: "USD", status: "approved" },
        { onConflict: "reference" }
      );
      await activate(sub.user_id, sub.plan, sub.period, "stripe", obj.subscription, end ? end * 1000 : undefined);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    await admin.from("af_subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("provider_ref", obj.id);
  }
  return new Response("ok");
}

Deno.serve(async req => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const raw = await req.text();
  const stripeSig = req.headers.get("stripe-signature");
  if (stripeSig) return handleStripe(raw, stripeSig);
  try {
    return await handleWompi(JSON.parse(raw));
  } catch {
    return new Response("bad request", { status: 400 });
  }
});
