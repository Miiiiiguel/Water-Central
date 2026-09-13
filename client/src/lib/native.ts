import { Capacitor } from '@capacitor/core';

// True only inside the actual iOS/Android app (Capacitor), never in a
// regular browser tab or the installed PWA — everything here is either
// gated behind this check or already a safe no-op on the web.
export const isNative = Capacitor.isNativePlatform();

// Called once on app start (see main.tsx). Sets the status bar to match
// the brand navy with light icons/text, and makes the Android hardware
// back button navigate the app's own history instead of the OS default
// (which would otherwise just close the app on the first press).
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
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch {
    // Not running under Capacitor's App plugin — skip.
  }
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
