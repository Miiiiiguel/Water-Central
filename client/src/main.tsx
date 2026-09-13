import { createRoot } from "react-dom/client";
import App from "./App";
import { initAnalytics } from "./lib/analytics";
import { captureReferralCode } from "./lib/referral";
import { initNative, isNative } from "./lib/native";
import "./index.css";

// Webfonts: the <link> in index.html is a preload so it never blocks first
// paint; here it becomes a real stylesheet (CSP forbids inline onload).
const webfonts = document.getElementById("webfonts") as HTMLLinkElement | null;
if (webfonts) {
  webfonts.rel = "stylesheet";
  webfonts.removeAttribute("as");
}

initAnalytics();
captureReferralCode();
initNative();

// PWA service worker (offline shell + push). Web only: inside the native
// app the bundle is already local and WKWebView doesn't support it.
if (!isNative && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}

// Optional client error monitoring. Loaded on demand so the SDK never
// ships in the bundle unless a DSN is configured.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  import("@sentry/react").then((Sentry) => {
    Sentry.init({ dsn: sentryDsn, environment: import.meta.env.MODE, tracesSampleRate: 0.1, sendDefaultPii: false });
    (window as any).__sentry = Sentry;
  });
}

createRoot(document.getElementById("root")!).render(<App />);

// Fade out and remove the static splash screen (see client/index.html)
// once React has mounted. The small delay keeps the brand moment
// visible instead of flashing instantly.
const splash = document.getElementById("app-splash");
if (splash) {
  window.setTimeout(() => {
    splash.classList.add("app-splash-hidden");
    splash.addEventListener("transitionend", () => splash.remove(), { once: true });
  }, 350);
}
