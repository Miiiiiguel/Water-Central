import type { CapacitorConfig } from "@capacitor/cli";

// Wraps the built web app (dist/) into native iOS/Android projects.
// `pnpm cap:sync` then `npx cap add ios` / `npx cap add android` the
// first time; see README.md → "Apps nativas".
const config: CapacitorConfig = {
  appId: "com.mygymcommunity.app",
  appName: "MyGym Community",
  webDir: "dist",
  // Same near-black as the app so the first paint has no white flash.
  backgroundColor: "#07090F",
  loggingBehavior: "production",
  server: { androidScheme: "https" },
  ios: { contentInset: "never" },
  android: { allowMixedContent: false },
};

export default config;
