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
    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update subscription reminder status
    const { data, error } = await supabaseAdmin
      .from('active_subscriptions')
      .update({
        reminder_sent: true,
        reminder_sent_at: now,
        last_contacted_at: now,
        updated_at: now,
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating reminder status:', error);
      return NextResponse.json(
        { error: 'Failed to update reminder status', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: data,
    });
  } catch (error: any) {
    console.error('Error in update reminder:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

