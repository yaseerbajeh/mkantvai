import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (typeof window !== 'undefined') {
  console.log('Supabase Config:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 8) + '...' : 'undefined'
  });
}

// Client-side Supabase client with proper session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Create a new client for each request (useful for server-side)
export function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });
}

export type Movie = {
  id: string;
  title: string;
  synopsis: string | null;
  year: number | null;
  type: 'movie' | 'series' | null;
  genre: string | null;
  platform: string | null;
  rating: string | null;
  duration: string | null;
  url: string | null;
  new: string | null; // Month abbreviation: jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec
  note: string | null; // Custom notes like "added new this month"
};
