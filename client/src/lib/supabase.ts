import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// During local/dev setup before the real project keys are added, we fall back
// to a placeholder client so the app doesn't crash on import. Every call will
// simply fail until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set — see
// SETUP.md for setup steps.
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
  referral_code: string;
  referred_by: string | null;
  created_at: string;
}

export type QuoteStatus = 'pending' | 'quoted' | 'won' | 'lost';
export type LeadStatus = 'new' | 'contacted' | 'won' | 'lost';

export interface FreightQuote {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  origin: string;
  destination: string;
  weight_kg: number | null;
  client_type: string | null;
  status: QuoteStatus;
  created_at: string;
}

export interface ContactLead {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  country: string | null;
  sales_channel: string | null;
  interests: string[] | null;
  message: string | null;
  status: LeadStatus;
  created_at: string;
}

export type PlanId = 'diagnostico_madurez' | 'analisis_mercado';

export interface Payment {
  id: string;
  user_id: string | null;
  email: string | null;
  plan: PlanId | string;
  amount_cents: number;
  currency: string;
  status: 'paid' | 'refunded';
  stripe_session_id: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}
