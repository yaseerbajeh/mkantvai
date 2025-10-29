import { createSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createSupabaseClient();
    
    // Exchange the code for a session
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to home page after verification
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}

