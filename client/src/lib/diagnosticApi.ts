import type { Answer } from './diagnosticContent';

// Client side of the maturity diagnostic: the API calls, the little bit
// of local persistence that survives a trip to the checkout, and the
// Wompi widget loader. No scoring here — that's diagnosticContent.ts.

export type Country = 'CO' | 'US' | 'OT';

export interface Lead {
  empresa: string;
  nombre: string;
  celular: string;
  correo: string;
  pais: Country;
}

export interface Price {
  amountInCents: number;
  currency: string;
  display: string;
  note: string;
}

export interface DiagnosticResult {
  ref: string;
  score: number;
  tier: string;
  gaps: number;
  paid: boolean;
  pais: Country;
  empresa: string | null;
  answers: Answer[];
  price: Price;
  actions: { index: number; question: string; section: string; action: string }[] | null;
}

export interface DiagnosticConfig {
  enabled: boolean;
  publicKey: string | null;
  env: 'sandbox' | 'production';
  price: { CO: Price; INTL: Price };
}

// What we keep in the browser: enough to show the result again after a
// redirect, never anything the server would not hand back anyway.
const STORAGE_KEY = 'ecx:diagnostic';

export interface StoredDiagnostic {
  ref: string | null;
  lead: Lead;
  answers: (Answer | string)[];
  at: number;
}

export function loadStored(): StoredDiagnostic | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDiagnostic;
    // A result older than 30 days is stale enough to start over.
    if (!parsed || Date.now() - parsed.at > 30 * 24 * 3600 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStored(value: StoredDiagnostic | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — the flow still works, it just won't survive a reload */
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as { error?: string }).error || `http_${res.status}`), { status: res.status });
  return body as T;
}

export function getConfig(): Promise<DiagnosticConfig> {
  return fetch('/api/diagnostic/config').then((r) => json<DiagnosticConfig>(r));
}

export function createDiagnostic(lead: Lead, answers: (Answer | string)[], token: string | null) {
  return fetch('/api/diagnostic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...lead, answers }),
  }).then((r) => json<{ ref: string; score: number; gaps: number; tier: string; price: Price }>(r));
}

export function getDiagnostic(ref: string): Promise<DiagnosticResult> {
  return fetch(`/api/diagnostic/${encodeURIComponent(ref)}`, { cache: 'no-store' }).then((r) => json<DiagnosticResult>(r));
}

export function confirmDiagnostic(ref: string, transactionId: string | null): Promise<DiagnosticResult> {
  return fetch('/api/diagnostic/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, transactionId }),
  }).then((r) => json<DiagnosticResult>(r));
}

export interface WompiInit {
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  publicKey: string;
  customer: { email: string | null; fullName: string | null; phone: string };
}

export function wompiInit(ref: string): Promise<WompiInit> {
  return fetch('/api/diagnostic/wompi-init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref }),
  }).then((r) => json<WompiInit>(r));
}

// --- Wompi widget -----------------------------------------------------

interface WidgetResult {
  transaction?: { id: string; status: string; reference: string } | null;
}

interface WidgetCheckoutCtor {
  new (options: {
    currency: string;
    amountInCents: number;
    reference: string;
    publicKey: string;
    signature: { integrity: string };
    redirectUrl?: string;
    customerData?: { email?: string; fullName?: string; phoneNumber?: string; phoneNumberPrefix?: string };
  }): { open: (cb: (result: WidgetResult) => void) => void };
}

declare global {
  interface Window {
    WidgetCheckout?: WidgetCheckoutCtor;
  }
}

const WIDGET_SRC = 'https://checkout.wompi.co/widget.js';
let widgetLoading: Promise<WidgetCheckoutCtor> | null = null;

/** Loads Wompi's widget script once, only when someone actually pays. */
export function loadWompiWidget(): Promise<WidgetCheckoutCtor> {
  if (window.WidgetCheckout) return Promise.resolve(window.WidgetCheckout);
  if (!widgetLoading) {
    widgetLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = WIDGET_SRC;
      script.async = true;
      script.onload = () => (window.WidgetCheckout ? resolve(window.WidgetCheckout) : reject(new Error('widget_missing')));
      script.onerror = () => {
        widgetLoading = null;
        reject(new Error('widget_load_failed'));
      };
      document.head.appendChild(script);
    });
  }
  return widgetLoading;
}

/**
 * Wompi's hosted checkout page — what the native app uses, since the
 * widget's modal doesn't belong inside a WebView. Same signature, same
 * amount; the buyer comes back to /diagnostico?ref=…&id=<transaction>.
 */
export function wompiRedirectUrl(init: WompiInit, redirectUrl: string): string {
  const q = new URLSearchParams({
    'public-key': init.publicKey,
    currency: init.currency,
    'amount-in-cents': String(init.amountInCents),
    reference: init.reference,
    'signature:integrity': init.signature,
    'redirect-url': redirectUrl,
  });
  if (init.customer.email) q.set('customer-data:email', init.customer.email);
  if (init.customer.fullName) q.set('customer-data:full-name', init.customer.fullName);
  return `https://checkout.wompi.co/p/?${q.toString()}`;
}
