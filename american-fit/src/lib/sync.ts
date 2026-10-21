import { getState, onStateChange, replaceState, type AppState } from "./store";
import { supabase } from "./supabase";

/*
 * Cloud mirror of the signed-in account's state (table af_user_state,
 * one JSON row per user — see supabase/schema.sql). On sign-in the newer
 * copy wins; afterwards every change is pushed, debounced. The plan is
 * read from af_subscriptions, which only the payment webhook can write.
 */

export function startSync(userId: string) {
  if (!supabase) return () => {};
  const db = supabase;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const push = (s: AppState) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void db.from("af_user_state").upsert({ user_id: userId, state: s, updated_at: new Date(s.updatedAt).toISOString() });
    }, 1500);
  };
  (async () => {
    const { data } = await db.from("af_user_state").select("state, updated_at").eq("user_id", userId).maybeSingle();
    const remote = data?.state as AppState | undefined;
    if (!stopped && remote && (remote.updatedAt ?? 0) > getState().updatedAt) replaceState(remote);
    else if (!stopped) push(getState());
    await refreshSubscription(userId);
  })();

  const off = onStateChange((s, id) => id === userId && push(s));
  return () => {
    stopped = true;
    clearTimeout(timer);
    off();
  };
}

/** Pulls the server-side subscription and payments into local state. */
export async function refreshSubscription(userId: string) {
  if (!supabase) return;
  const [{ data: sub }, { data: pays }] = await Promise.all([
    supabase.from("af_subscriptions").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("af_payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  const { actions } = await import("./store");
  if (sub) {
    actions.setSubscription({
      plan: sub.plan,
      period: sub.period,
      provider: sub.provider,
      status: sub.status === "active" ? "active" : "canceled",
      renewsAt: new Date(sub.current_period_end).getTime(),
    });
  }
  for (const p of pays ?? []) {
    actions.recordPayment({
      id: p.id,
      at: new Date(p.created_at).getTime(),
      plan: p.plan ?? "free",
      period: p.period ?? "monthly",
      productId: p.product ?? undefined,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      reference: p.reference,
    }, false);
  }
}
