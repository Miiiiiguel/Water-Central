// Ad/conversion tracking — Meta Pixel, TikTok Pixel, Google Analytics 4.
//
// Each one only loads if its env var is set, so this is a safe no-op
// until you add real pixel IDs:
//   VITE_META_PIXEL_ID
//   VITE_TIKTOK_PIXEL_ID
//   VITE_GA_MEASUREMENT_ID
//
// Call initAnalytics() once on app start (done in main.tsx), and
// trackLead() / trackInitiateCheckout() wherever a real lead or
// checkout happens (contact form submit, Calendly booking, plan
// checkout click) so ad spend can actually be optimized against
// real conversions instead of just clicks.

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    ttq?: any;
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

const metaPixelId = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const tiktokPixelId = import.meta.env.VITE_TIKTOK_PIXEL_ID as string | undefined;
const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let initialized = false;

function initMetaPixel(id: string) {
  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq?.('init', id);
  window.fbq?.('track', 'PageView');
}

function initTikTokPixel(id: string) {
  const w = window as any;
  const ttq = (w.ttq = w.ttq || []);
  ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
  ttq.setAndDefer = (t: any, e: string) => {
    t[e] = (...args: any[]) => t.push([e, ...args]);
  };
  ttq.methods.forEach((m: string) => ttq.setAndDefer(ttq, m));
  ttq.load = (pixelId: string) => {
    const src = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    const script = document.createElement('script');
    script.async = true;
    script.src = `${src}?sdkid=${pixelId}&lib=ttq`;
    const first = document.getElementsByTagName('script')[0];
    first.parentNode?.insertBefore(script, first);
  };
  ttq.load(id);
  ttq.page();
}

function initGoogleAnalytics(id: string) {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: any[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', id);
}

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (metaPixelId) initMetaPixel(metaPixelId);
  if (tiktokPixelId) initTikTokPixel(tiktokPixelId);
  if (gaMeasurementId) initGoogleAnalytics(gaMeasurementId);
}

/** Fire this when a real lead comes in: contact form submit, Calendly booking, freight quote, etc. */
export function trackLead(params?: Record<string, unknown>) {
  window.fbq?.('track', 'Lead', params);
  window.ttq?.track('SubmitForm', params);
  window.gtag?.('event', 'generate_lead', params);
}

/** Fire this when someone starts a paid checkout (Stripe). */
export function trackInitiateCheckout(params?: Record<string, unknown>) {
  window.fbq?.('track', 'InitiateCheckout', params);
  window.ttq?.track('InitiateCheckout', params);
  window.gtag?.('event', 'begin_checkout', params);
}

/** Fire this when a new account is created. */
export function trackSignUp(params?: Record<string, unknown>) {
  window.fbq?.('track', 'CompleteRegistration', params);
  window.ttq?.track('CompleteRegistration', params);
  window.gtag?.('event', 'sign_up', params);
}
