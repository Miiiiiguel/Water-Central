import { createRoot } from "react-dom/client";
import App from "./App";
import { initAnalytics } from "./lib/analytics";
import { captureReferralCode } from "./lib/referral";
import { initNative, isNative } from "./lib/native";
import { baseDelServidor, instalarServidor } from "./lib/apiBase";
import "./index.css";

// Webfonts: the <link> in index.html is a preload so it never blocks first
// paint; here it becomes a real stylesheet (CSP forbids inline onload).
const webfonts = document.getElementById("webfonts") as HTMLLinkElement | null;
if (webfonts) {
  webfonts.rel = "stylesheet";
  webfonts.removeAttribute("as");
}

// En la app nativa, /api tiene que ir al servidor de verdad (ver
// lib/apiBase.ts). Va primero: antes de cualquier pedido.
instalarServidor(baseDelServidor(isNative, import.meta.env.VITE_API_URL as string | undefined));

initAnalytics();
captureReferralCode();
initNative();

// PWA service worker (offline shell + push). Web only: inside the native
// app the bundle is already local and WKWebView doesn't support it.
//
// El worker usa skipWaiting() + clientsClaim() + cleanupOutdatedCaches():
// en cuanto hay una versión nueva, toma el control y borra los archivos
// de la vieja. Para quien llega de cero eso es perfecto. Para una
// pestaña que ya estaba abierta es una trampa: sigue ejecutando el
// JavaScript viejo, y el primer trozo que pida a demanda —el de
// Supabase al tocar "Crear cuenta", por ejemplo— ya no existe en el
// servidor. El navegador lanza "Failed to fetch dynamically imported
// module" y la persona ve un error genérico en mitad del registro.
//
// Se arregla donde nace: cuando el worker nuevo toma el control de una
// pestaña que YA tenía uno, se recarga. `controller` en null significa
// primera instalación —no hay nada viejo que reemplazar— y recargar ahí
// sería recargarle la página a todo el que entra por primera vez. El
// candado `recargando` existe porque `controllerchange` puede llegar más
// de una vez y dos recargas seguidas son un bucle.
if (!isNative && "serviceWorker" in navigator && import.meta.env.PROD) {
  const teniaControlador = navigator.serviceWorker.controller !== null;
  let recargando = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!teniaControlador || recargando) return;
    recargando = true;
    window.location.reload();
  });

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
