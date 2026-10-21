import "@fontsource-variable/inter";
import "@fontsource/bebas-neue";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Offline support on the web. The native shell (Capacitor) serves files
// from the device already and WKWebView has no service workers.
const isNative = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
if (import.meta.env.PROD && !isNative && "serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}
