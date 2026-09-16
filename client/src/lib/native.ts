import { Capacitor } from '@capacitor/core';

// True only inside the actual iOS/Android app (Capacitor), never in a
// regular browser tab or the installed PWA — everything here is either
// gated behind this check or already a safe no-op on the web.
export const isNative = Capacitor.isNativePlatform();

// Fired on window when the native app comes back to the foreground —
// e.g. after paying in the system browser. Screens that show live data
// (payments, notifications) listen for it and refetch.
export const RESUME_EVENT = 'easycomex:resume';

// Client-side navigation without a full reload (wouter listens to popstate).
function navigateTo(path: string) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// Called once on app start (see main.tsx).
export async function initNative() {
  if (!isNative) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light }); // light icons for our dark navy bar
    await StatusBar.setBackgroundColor({ color: '#1B1A45' }).catch(() => {
      // iOS has no background color API — style alone is enough there.
    });
  } catch {
    // Status bar plugin not available on this platform — skip.
  }

  try {
    const { App } = await import('@capacitor/app');

    // Android hardware back button: walk the app's own history instead of
    // closing on the first press.
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });

    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) window.dispatchEvent(new Event(RESUME_EVENT));
    });

    // Universal/App Links (https://easycomex.com/pago/exito …) land here
    // once the domain association is in place — see APP_STORE.md.
    App.addListener('appUrlOpen', async ({ url }) => {
      try {
        const u = new URL(url);
        const path = u.pathname + u.search;
        if (path && path !== '/') navigateTo(path);
        const { Browser } = await import('@capacitor/browser');
        await Browser.close().catch(() => {});
      } catch {
        // malformed URL — ignore
      }
    });
  } catch {
    // Not running under Capacitor's App plugin — skip.
  }

  interceptExternalLinks();
}

// Opens a URL outside the app shell: the system browser sheet on native
// (SFSafariViewController / Chrome Custom Tab — required for Stripe
// Checkout and Google OAuth, which refuse embedded WebViews), a new tab
// on the web.
export async function openExternal(url: string) {
  if (!isNative) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// Inside the WebView, a plain <a href="https://wa.me/…"> would navigate
// the app itself away to WhatsApp's site. Route every off-origin http(s)
// link through the system browser instead; mailto:/tel:/sms: are handed
// to the OS by the WebView already.
function interceptExternalLinks() {
  document.addEventListener(
    'click',
    (e) => {
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!/^https?:/i.test(href)) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin === window.location.origin) return;
      e.preventDefault();
      openExternal(url.toString());
    },
    { capture: true }
  );
}

// A light tap for buttons/nav — no-ops instantly on the web, so it's
// safe to sprinkle on every interactive element without extra checks.
export async function hapticTap() {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics unavailable on this device — skip.
  }
}
