import { createRoot } from "react-dom/client";
import App from "./App";
import { initAnalytics } from "./lib/analytics";
import { captureReferralCode } from "./lib/referral";
import { initNative } from "./lib/native";
import "./index.css";

initAnalytics();
captureReferralCode();
initNative();

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
