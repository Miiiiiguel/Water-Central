import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Request } from 'express';

// Server-side Supabase access.
//
// - getSupabaseAdmin(): service-role client that bypasses RLS. Only ever
//   used for things the browser must not be able to do itself (recording
//   a payment, reading someone's push subscriptions). Needs
//   SUPABASE_SERVICE_ROLE_KEY, which is server-only — see .env.example.
// - getUserFromRequest(): verifies a "Authorization: Bearer <jwt>" header
//   against Supabase and returns the user, so routes can trust *who* is
//   calling without trusting anything the client claims about itself.

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

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  // The anon key + the user's own JWT is enough to validate it; no
  // service-role privileges needed just to identify the caller.
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
