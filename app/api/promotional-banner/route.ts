import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// GET - Fetch active promotional banner
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch the enabled banner that hasn't expired (prioritize blackfriday, then default)
    // First try to get blackfriday banner
    let { data, error } = await supabase
      .from('promotional_banners')
      .select('*')
      .eq('is_enabled', true)
      .eq('banner_type', 'blackfriday')
      .gte('expiration_date', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no blackfriday banner, try default
    if (!data || error) {
      const defaultResult = await supabase
        .from('promotional_banners')
        .select('*')
        .eq('is_enabled', true)
        .eq('banner_type', 'default')
        .gte('expiration_date', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (defaultResult.data) {
        data = defaultResult.data;
        error = defaultResult.error;
      }
    }

    if (error) {
      // If no banner found, return null (not an error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ banner: null });
      }
      console.error('Error fetching promotional banner:', error);
      return NextResponse.json(
        { error: 'Failed to fetch promotional banner' },
        { status: 500 }
      );
    }

    // If no data, return null
    if (!data) {
      return NextResponse.json({ banner: null });
    }

    return NextResponse.json({ banner: data });
  } catch (error: any) {
    console.error('Error in promotional banner API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

