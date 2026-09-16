import { createHash, timingSafeEqual } from 'node:crypto';

// Wompi (Colombia) — the pieces that must be exactly right, kept pure so
// they can be unit-tested without a network.
//
// Two secrets, two jobs:
//   WOMPI_INTEGRITY_SECRET  signs what the widget is allowed to charge
//                           (reference + amount + currency). Wompi
//                           refuses a checkout whose signature doesn't
//                           match, so the browser can't lower the price.
//   WOMPI_EVENTS_SECRET     signs the webhook Wompi sends us when a
//                           transaction changes state.
// The private key (WOMPI_PRIVATE_KEY) is only used to read a transaction
// back from Wompi's API when the browser says "it was approved" — we
// never believe the browser, we ask Wompi.
//
// Docs: https://docs.wompi.co/docs/colombia/widget-checkout-web/ and
// https://docs.wompi.co/docs/colombia/eventos/

export type WompiEnv = 'sandbox' | 'production';

export function wompiEnv(): WompiEnv {
  return process.env.WOMPI_ENV === 'production' ? 'production' : 'sandbox';
}

export function wompiApiBase(env: WompiEnv = wompiEnv()): string {
  return env === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
}

export function wompiConfigured(): boolean {
  return Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_INTEGRITY_SECRET);
}

/**
 * Integrity signature for the checkout widget:
 * SHA-256 over `<reference><amountInCents><currency><secret>`, hex.
 * Exactly this concatenation, no separators — Wompi recomputes it.
 */
export function integritySignature(reference: string, amountInCents: number, currency: string, secret: string): string {
  return createHash('sha256').update(`${reference}${amountInCents}${currency}${secret}`).digest('hex');
}

export interface WompiTransaction {
  id: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING' | string;
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
  customer_email?: string;
}

export interface WompiEvent {
  event: string;
  data: { transaction?: Partial<WompiTransaction> } & Record<string, unknown>;
  timestamp: number;
  signature: { properties: string[]; checksum: string };
}

/** Walks a dotted path ("transaction.amount_in_cents") through the event data. */
function pluck(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), data);
}

/**
 * Webhook checksum: SHA-256 over the concatenated values of the
 * properties Wompi lists in `signature.properties` (read from `data`,
 * in that order), then the timestamp, then the events secret.
 */
export function eventChecksum(event: Pick<WompiEvent, 'data' | 'timestamp' | 'signature'>, secret: string): string {
  const values = event.signature.properties.map((p) => String(pluck(event.data, p) ?? ''));
  return createHash('sha256').update(`${values.join('')}${event.timestamp}${secret}`).digest('hex');
}

export function verifyEventChecksum(event: Pick<WompiEvent, 'data' | 'timestamp' | 'signature'>, secret: string): boolean {
  const expected = Buffer.from(eventChecksum(event, secret).toLowerCase(), 'utf8');
  const received = Buffer.from(String(event.signature?.checksum ?? '').toLowerCase(), 'utf8');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * The one check that decides whether a transaction pays for a given
 * order: approved, for that exact reference, that exact amount, that
 * exact currency. Anything else — a cheaper transaction, someone else's
 * reference, a pending one — is not a payment.
 */
export function transactionPaysFor(
  tx: Partial<WompiTransaction> | null | undefined,
  expected: { reference: string; amountInCents: number; currency: string }
): boolean {
  if (!tx) return false;
  return (
    tx.status === 'APPROVED' &&
    tx.reference === expected.reference &&
    Number(tx.amount_in_cents) === expected.amountInCents &&
    String(tx.currency).toUpperCase() === expected.currency.toUpperCase()
  );
}

/** Reads a transaction back from Wompi. Never trusts the widget callback. */
export async function fetchTransaction(id: string, env: WompiEnv = wompiEnv()): Promise<WompiTransaction | null> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return null;
  const headers: Record<string, string> = {};
  // The transactions endpoint is readable with the public key alone, but
  // the private key is accepted too and never rate-limits us the same way.
  if (process.env.WOMPI_PRIVATE_KEY) headers.Authorization = `Bearer ${process.env.WOMPI_PRIVATE_KEY}`;
  const res = await fetch(`${wompiApiBase(env)}/transactions/${encodeURIComponent(id)}`, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: WompiTransaction };
  return body.data ?? null;
}

/**
 * La URL del Web Checkout de Wompi.
 *
 * Se usa esta y no el widget de JavaScript por tres razones: el pago
 * queda siendo un redirect normal (funciona igual en el navegador del
 * sistema de la app nativa), no hay que cargar un script de terceros en
 * la página, y el servidor devuelve una URL — exactamente la misma forma
 * que Stripe, así que el navegador no tiene que saber quién cobra.
 *
 * Los nombres de los parámetros son los de Wompi, con dos puntos y todo
 * (`signature:integrity`): no son un estilo nuestro, son su contrato.
 */
export function checkoutUrl(o: {
  publicKey: string;
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  redirectUrl: string;
  email?: string | null;
}): string {
  const url = new URL('https://checkout.wompi.co/p/');
  url.searchParams.set('public-key', o.publicKey);
  url.searchParams.set('currency', o.currency);
  url.searchParams.set('amount-in-cents', String(o.amountInCents));
  url.searchParams.set('reference', o.reference);
  url.searchParams.set('signature:integrity', o.signature);
  url.searchParams.set('redirect-url', o.redirectUrl);
  if (o.email) url.searchParams.set('customer-data:email', o.email);
  return url.toString();
}
