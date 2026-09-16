import { isNative, openExternal } from '@/lib/native';

// Un solo camino para abrir un pago, desde donde sea: los planes, la
// calculadora de ROI, el dashboard y Marco Polo.
//
// Antes cada botón hablaba directo con Stripe y, si Stripe no estaba
// configurado, moría en un `catch` que decía "no pude abrir el pago" sin
// decir por qué. El servidor es quien sabe qué pasarela puede cobrar
// (Stripe o Wompi); acá sólo se abre la URL que devuelva y se traduce el
// motivo cuando no hay ninguna.

export type CheckoutPlan =
  | 'diagnostico_madurez'
  | 'analisis_mercado'
  | 'acompanamiento'
  | 'creditos_marco_polo'
  | 'reporte_detalle'
  | 'reporte_pronostico';

export type CheckoutFailure =
  /** Plan a medida: no se compra de un botón, se habla con el equipo. */
  | 'a_medida'
  /** Ninguna pasarela configurada en el servidor. */
  | 'sin_pasarela'
  /** Falta el service-role: se podría cobrar, pero no registrar. */
  | 'sin_registro'
  /** Lo comprado se acredita a una cuenta, y no hay sesión iniciada. */
  | 'requiere_cuenta'
  | 'red';

export type CheckoutOutcome =
  | { ok: true; gateway: 'stripe' | 'wompi'; reference?: string }
  | { ok: false; reason: CheckoutFailure };

export interface CatalogItem {
  plan: CheckoutPlan;
  label: string;
  labelEn: string;
  amountInCents: number | null;
  currency: string | null;
  displayCop: string | null;
  displayUsd: string | null;
  gateway: 'stripe' | 'wompi' | null;
  payable: boolean;
}

/** Qué se puede cobrar hoy. Para no mostrar un botón que no puede cobrar. */
export async function fetchCatalog(): Promise<CatalogItem[]> {
  try {
    const res = await fetch('/api/checkout/catalog');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? (data.items as CatalogItem[]) : [];
  } catch {
    return [];
  }
}

export async function startCheckout(plan: CheckoutPlan, token: string | null): Promise<CheckoutOutcome> {
  let data: { url?: string; gateway?: 'stripe' | 'wompi'; reference?: string; error?: string };
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ plan, platform: isNative ? 'native' : 'web' }),
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      const reason: CheckoutFailure =
        data.error === 'plan_a_medida' ? 'a_medida'
          : data.error === 'requiere_cuenta' ? 'requiere_cuenta'
            : data.error === 'sin_registro' ? 'sin_registro'
              : data.error === 'sin_pasarela' ? 'sin_pasarela'
                : 'red';
      return { ok: false, reason };
    }
  } catch {
    return { ok: false, reason: 'red' };
  }

  // En la app nativa el pago va en el navegador del sistema: es lo que
  // exigen Apple, Google y las dos pasarelas. La app refresca los pagos
  // al volver al frente.
  if (isNative) await openExternal(data.url);
  else window.location.href = data.url;

  return { ok: true, gateway: data.gateway ?? 'stripe', reference: data.reference };
}

/** El mensaje que ve la persona cuando no se pudo abrir el pago. */
export function checkoutMessage(reason: CheckoutFailure, es: boolean): string {
  switch (reason) {
    case 'a_medida':
      return es
        ? 'Este plan se arma a medida: escribinos y lo cotizamos con tu marca.'
        : 'This plan is custom-built: message us and we will quote it for your brand.';
    case 'sin_pasarela':
      return es
        ? 'El cobro en línea todavía no está habilitado. Escribinos por WhatsApp y lo resolvemos hoy mismo.'
        : 'Online payment is not enabled yet. Message us on WhatsApp and we will sort it today.';
    case 'requiere_cuenta':
      return es
        ? 'Entrá a tu cuenta antes de comprar: las consultas se acreditan a tu usuario.'
        : 'Sign in before buying: lookups are credited to your account.';
    case 'sin_registro':
      return es
        ? 'No podemos registrar la compra en este momento. Escribinos y la tomamos nosotros.'
        : 'We cannot record the purchase right now. Message us and we will take it from here.';
    case 'red':
    default:
      return es
        ? 'No pudimos abrir el pago. Revisá tu conexión o escribinos por WhatsApp.'
        : 'We could not open checkout. Check your connection or message us on WhatsApp.';
  }
}
