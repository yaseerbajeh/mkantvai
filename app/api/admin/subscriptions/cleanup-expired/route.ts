import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    // Use database function to move expired subscriptions
    const { data, error } = await supabaseAdmin.rpc('move_expired_subscriptions');

    if (error) {
      console.error('Error moving expired subscriptions:', error);
      return NextResponse.json(
        { error: 'Failed to move expired subscriptions', details: error.message },
        { status: 500 }
      );
    }

    const movedCount = data?.[0]?.moved_count || 0;

    return NextResponse.json({
      success: true,
      movedCount,
      message: `Successfully moved ${movedCount} expired subscription(s)`,
    });
  } catch (error: any) {
    console.error('Error in cleanup expired subscriptions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

