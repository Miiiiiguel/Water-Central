import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// During local/dev setup before the real project keys are added, we fall back
// to a placeholder client so the app doesn't crash on import. Every call will
// simply fail until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set — see
// supabase/README.md for setup steps.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export type UserRole = 'cliente' | 'vendedor';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company: string | null;
  role: UserRole;
  created_at: string;
}
