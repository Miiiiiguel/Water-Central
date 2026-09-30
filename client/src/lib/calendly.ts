// Calendly popup widget loader.
//
// Set VITE_CALENDLY_URL to your scheduling page (e.g.
// https://calendly.com/tu-usuario/consultoria-30min) to activate it.
// Until then, openCalendlyPopup() resolves to false and callers should
// fall back to scrolling to the contact form.

export const calendlyUrl = import.meta.env.VITE_CALENDLY_URL as string | undefined;
export const isCalendlyConfigured = Boolean(calendlyUrl);

let scriptPromise: Promise<void> | null = null;

function loadCalendlyScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if ((window as any).Calendly) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Calendly widget script'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/** Opens the Calendly popup. Returns false (no-op) if VITE_CALENDLY_URL isn't set. */
export async function openCalendlyPopup(): Promise<boolean> {
  if (!calendlyUrl) return false;
  try {
    await loadCalendlyScript();
    (window as any).Calendly?.initPopupWidget({ url: calendlyUrl });
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}
