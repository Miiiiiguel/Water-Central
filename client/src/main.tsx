import { createRoot } from "react-dom/client";
import App from "./App";
import { initAnalytics } from "./lib/analytics";
import { captureReferralCode } from "./lib/referral";
import "./index.css";

initAnalytics();
captureReferralCode();

createRoot(document.getElementById("root")!).render(<App />);
