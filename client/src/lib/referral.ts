// Referral link tracking: captures ?ref=CODE from the URL on landing,
// remembers it in localStorage, and hands it to sign-up so the
// handle_new_user() trigger (see supabase/schema.sql) can link the new
// account to whoever referred them.

const STORAGE_KEY = 'easycomex_ref';

/** Call once on app start. Reads ?ref=CODE and stores it if present. */
export function captureReferralCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) localStorage.setItem(STORAGE_KEY, ref);
  } catch {
    // localStorage unavailable (private mode, etc.) — fail silently.
  }
}

export function getStoredReferralCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Once the code has been applied to an account it's no longer needed. */
export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function buildReferralLink(referralCode: string): string {
  return `${window.location.origin}/?ref=${referralCode}`;
}
