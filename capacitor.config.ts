import type { CapacitorConfig } from '@capacitor/cli';

// This wraps the built web app (dist/public) into native iOS/Android
// projects using Capacitor. See SETUP.md for the full app-store steps —
// this config alone does not produce a submittable build; that needs
// Xcode (iOS) and Android Studio / the Android SDK (Android) on your
// own machine, plus your own Apple/Google developer accounts.
const config: CapacitorConfig = {
  appId: 'com.easycomex.app',
  appName: 'Easycomex',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
  },
};

export default config;
