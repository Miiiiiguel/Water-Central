import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Request } from 'express';

// Server-side Supabase access.
//
// - getSupabaseAdmin(): service-role client that bypasses RLS. Only ever
//   used for things the browser must not be able to do itself (recording
//   a payment, reading someone's push subscriptions). Needs
//   SUPABASE_SERVICE_ROLE_KEY, which is server-only — see .env.example.
// - getUserClient(token): anon client acting AS the caller (their JWT).
//   Every query still goes through RLS, so it can only see what that
//   user could see from the browser — ideal for reading their own
//   profile/role without service-role privileges.
// - getUserFromRequest() / getProfileFromRequest(): verify the
//   "Authorization: Bearer <jwt>" header against Supabase and return who
//   is calling. Routes trust *this*, never anything the client claims.

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export function getAnonClient(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function getUserClient(token: string): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function getBearerToken(req: Request): string {
  const header = req.header('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const client = getUserClient(token);
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export interface ProfileRow {
  id: string;
  email: string;
  role: 'cliente' | 'vendedor';
}

export interface AuthContext {
  user: User;
  profile: ProfileRow;
  // Authenticator assurance level from the JWT: 'aal2' means the user
  // completed MFA in this session.
  aal: 'aal1' | 'aal2';
}

export async function getProfileFromRequest(req: Request): Promise<AuthContext | null> {
  const token = getBearerToken(req);
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const client = getUserClient(token)!;
  const { data } = await client.from('profiles').select('id, email, role').eq('id', user.id).single();
  if (!data) return null;
  const aal = decodeAal(token);
  return { user, profile: data as ProfileRow, aal };
}

function decodeAal(token: string): 'aal1' | 'aal2' {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}
