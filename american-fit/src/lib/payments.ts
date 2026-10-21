import type { BillingPeriod, Plan } from "./store";
import { supabase } from "./supabase";

/*
 * Checkout.
 *
 * Two gateways, chosen by the buyer:
 *   - Wompi (Colombia, COP): PSE, Nequi, Bancolombia, cards.
 *   - Stripe (international, USD): cards, Apple Pay, Google Pay.
 *
 * The browser never sees a secret: it asks the `checkout` Edge Function
 * (supabase/functions/checkout) for a hosted checkout URL and goes there.
 * The `payments-webhook` function confirms the payment and activates the
 * plan; the app then reads it back (lib/sync.ts → refreshSubscription).
 *
 * Without Supabase configured the app runs in test mode: nothing is
 * charged and the checkout screen offers a clearly labeled simulation.
 */

export type Gateway = "wompi" | "stripe";

export const PRICES: Record<Exclude<Plan, "free">, Record<BillingPeriod, { USD: number; COP: number }>> = {
  pro: { monthly: { USD: 12.99, COP: 49_900 }, yearly: { USD: 99.99, COP: 399_900 } },
  elite: { monthly: { USD: 29.99, COP: 119_900 }, yearly: { USD: 249.99, COP: 999_900 } },
};

export const PLAN_NAME: Record<Plan, string> = { free: "Free", pro: "Pro", elite: "Elite" };

export const paymentsLive = !!supabase;

export function formatMoney(amount: number, currency: "USD" | "COP") {
  return currency === "COP"
    ? `$${amount.toLocaleString("es-CO", { maximumFractionDigits: 0 })} COP`
    : `US$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

/** Asks the server for a hosted checkout URL and redirects to it. */
export async function startCheckout(plan: Exclude<Plan, "free">, period: BillingPeriod, gateway: Gateway): Promise<string | null> {
  if (!supabase) return "Pagos en modo de prueba.";
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>("checkout", {
    body: { plan, period, gateway },
  });
  if (error || !data?.url) return data?.error ?? "No pudimos abrir la pasarela de pago. Intenta de nuevo en unos minutos.";
  window.location.href = data.url;
  return null;
}

/** Stops automatic renewal; the plan stays active until the paid period ends. */
export async function cancelPlan(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("checkout", { body: { action: "cancel" } });
  return error || !data?.ok ? data?.error ?? "No pudimos cancelar. Intenta de nuevo." : null;
}

/** One-time Tienda purchase (or a tip) through the same gateways. */
export async function startProductCheckout(productId: string, gateway: Gateway): Promise<string | null> {
  if (!supabase) return "Pagos en modo de prueba.";
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>("checkout", {
    body: { product: productId, gateway },
  });
  if (error || !data?.url) return data?.error ?? "No pudimos abrir la pasarela de pago. Intenta de nuevo en unos minutos.";
  window.location.href = data.url;
  return null;
}
