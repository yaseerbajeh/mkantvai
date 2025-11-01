import { createSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');

  if (code) {
    const supabase = createSupabaseClient();
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      // If there's an error, redirect to auth page
      return NextResponse.redirect(new URL('/auth?error=invalid_token', requestUrl.origin));
    }

    // If it's a password recovery type, redirect to reset password page with type parameter
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/auth/reset-password?type=recovery', requestUrl.origin));
    }
  }

  // Redirect to home page after verification
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}

