import { createRoot } from "react-dom/client";
import App from "./App";
import { initAnalytics } from "./lib/analytics";
import { captureReferralCode } from "./lib/referral";
import "./index.css";

initAnalytics();
captureReferralCode();

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
