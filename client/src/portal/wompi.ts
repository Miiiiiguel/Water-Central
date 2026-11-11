import { api } from '@/lib/casillero';

/** Abre el pago de una recarga con Wompi. Devuelve el mensaje de error, o null si redirigió. */
export async function recargarConWompi(token: string | null, montoUsd: number): Promise<string | null> {
  const r = await api<{ url: string }>('/casillero/wallet/recargar', token, { montoUsd });
  if (!r.ok) {
    if (r.error === 'monto_invalido') return 'El monto está fuera de lo permitido.';
    return r.message ?? 'No pudimos abrir el pago. Intenta de nuevo o reporta un pago hecho por fuera.';
  }
  window.location.href = r.data.url;
  return null;
}
