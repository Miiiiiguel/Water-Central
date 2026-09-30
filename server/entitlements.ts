import type { SupabaseClient } from '@supabase/supabase-js';
import { CATALOG, type PlanId } from './catalog';

// Lo que entrega una compra ya pagada, sea cual sea la pasarela: tokens
// que no vencen o un plan de tokens por mes. Lo llaman el webhook de
// Stripe y la confirmación de Wompi, cada uno una sola vez por pago.
//
// `ref` identifica el pago (el id de la orden o de la sesión de Stripe).
// El plan se crea con esa referencia única, así que un reintento no da
// dos planes. Los tokens de paquete dependen de que quien llama ya haya
// garantizado una sola llamada por pago (lo hacen los dos).

export async function entregarCompra(
  admin: SupabaseClient,
  compra: { userId: string | null; plan: string; ref: string }
): Promise<void> {
  if (!compra.userId || !(compra.plan in CATALOG)) return;
  const grants = CATALOG[compra.plan as PlanId].grants;
  if (!grants) return;

  if (grants.researchCredits) {
    const { error } = await admin.rpc('grant_research_credits', { p_user_id: compra.userId, p_credits: grants.researchCredits });
    if (error) console.error(`[compras] no se pudieron acreditar los tokens de ${compra.plan}:`, error.message);
  }

  if (grants.tokenPlan) {
    const { error } = await admin.rpc('grant_token_plan', {
      p_user_id: compra.userId,
      p_plan: compra.plan,
      p_monthly: grants.tokenPlan.monthlyTokens,
      p_months: grants.tokenPlan.months,
      p_ref: compra.ref,
    });
    if (error) console.error(`[compras] no se pudo activar el plan ${compra.plan}:`, error.message);
  }
}
