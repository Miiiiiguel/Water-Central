import type { CapacitorConfig } from '@capacitor/cli';

// This wraps the built web app (dist/public) into native iOS/Android
// projects using Capacitor. See APP_STORE.md for the full app-store
// steps — this config alone does not produce a submittable build; that
// needs Xcode (iOS) and Android Studio / the Android SDK (Android) on
// your own machine, plus your own Apple/Google developer accounts.
const config: CapacitorConfig = {
  appId: 'com.easycomex.app',
  appName: 'Easycomex',
  webDir: 'dist/public',
  // Navy behind the WebView so the first paint isn't a white flash.
  backgroundColor: '#1B1A45',
  loggingBehavior: 'production',
  server: {
    androidScheme: 'https',
  },
  ios: {
    // We handle the notch ourselves with env(safe-area-inset-*).
    contentInset: 'never',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1B1A45',
      overlaysWebView: false,
    },
  },
};

export default config;
