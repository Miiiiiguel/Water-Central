import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Supabase is optional. With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * set, accounts, history sync and payments run in the cloud; without
 * them the app uses on-device accounts (see lib/auth.tsx) so it still
 * works offline, in previews and in demos.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;

export const cloudEnabled = !!supabase;
