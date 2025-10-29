import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create a new client for each request (useful for server-side)
export function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
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
