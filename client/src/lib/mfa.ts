import { supabase } from './supabase';

// Two-factor authentication (TOTP: Google Authenticator, 1Password, Authy…)
// on top of Supabase Auth. Sessions carry an "assurance level": aal1 =
// password/Google only, aal2 = also passed a TOTP challenge. The server
// can require aal2 for sensitive routes (see server/auth.ts).

export interface MfaStatus {
  currentLevel: 'aal1' | 'aal2' | null;
  nextLevel: 'aal1' | 'aal2' | null;
  // True when the account has a verified factor but this session hasn't
  // passed the challenge yet — the UI must ask for the code.
  required: boolean;
  enrolled: boolean;
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = (data?.currentLevel as MfaStatus['currentLevel']) ?? null;
  const nextLevel = (data?.nextLevel as MfaStatus['nextLevel']) ?? null;
  return {
    currentLevel,
    nextLevel,
    required: nextLevel === 'aal2' && currentLevel !== 'aal2',
    enrolled: nextLevel === 'aal2',
  };
}

export async function listVerifiedFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp ?? []).filter((f) => f.status === 'verified');
}

export async function startTotpEnrollment(): Promise<{ factorId: string; qrCode: string; secret: string }> {
  // Clean up abandoned enrollments so the friendly name doesn't collide.
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data: enrolled, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Easycomex' });
  if (error) throw error;
  return { factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret };
}

export async function verifyTotp(factorId: string, code: string) {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.replace(/\s/g, '') });
  if (error) throw error;
}

// At login: complete the challenge with the account's verified factor.
export async function completeMfaChallenge(code: string) {
  const factors = await listVerifiedFactors();
  if (!factors.length) throw new Error('No hay un segundo factor configurado.');
  await verifyTotp(factors[0].id, code);
}

export async function disableTotp() {
  const factors = await listVerifiedFactors();
  for (const f of factors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) throw error;
  }
}
