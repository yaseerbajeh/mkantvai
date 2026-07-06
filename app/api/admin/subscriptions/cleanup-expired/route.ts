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
    const now = new Date().toISOString();

    const { data: expiredSubscriptions, error: fetchError } = await supabaseAdmin
      .from('active_subscriptions')
      .select('*')
      .lte('expiration_date', now);

    if (fetchError) {
      console.error('Error fetching expired subscriptions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch expired subscriptions', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        movedCount: 0,
        message: 'No expired subscriptions to move',
      });
    }

    const expiredRows = expiredSubscriptions.map((subscription: any) => ({
      id: subscription.id,
      order_id: subscription.order_id,
      customer_name: subscription.customer_name,
      customer_email: subscription.customer_email,
      customer_phone: subscription.customer_phone,
      subscription_code: subscription.subscription_code,
      subscription_type: subscription.subscription_type,
      subscription_duration: subscription.subscription_duration,
      expiration_date: subscription.expiration_date,
      start_date: subscription.start_date,
      product_code: subscription.product_code,
      reminder_sent: subscription.reminder_sent,
      reminder_sent_at: subscription.reminder_sent_at,
      last_contacted_at: subscription.last_contacted_at,
      renewed_from_subscription_id: subscription.renewed_from_subscription_id,
      is_renewed: subscription.is_renewed,
      renewal_count: subscription.renewal_count,
      created_at: subscription.created_at,
      updated_at: subscription.updated_at,
      expired_at: now,
    }));

    const { error: upsertError } = await supabaseAdmin
      .from('expired_subscriptions')
      .upsert(expiredRows, { onConflict: 'id' });

    if (upsertError) {
      console.error('Error moving expired subscriptions:', upsertError);
      return NextResponse.json(
        { error: 'Failed to move expired subscriptions', details: upsertError.message },
        { status: 500 }
      );
    }

    const expiredIds = expiredSubscriptions.map((subscription: any) => subscription.id);
    const { error: deleteError } = await supabaseAdmin
      .from('active_subscriptions')
      .delete()
      .in('id', expiredIds);

    if (deleteError) {
      console.error('Error deleting moved expired subscriptions:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete moved expired subscriptions', details: deleteError.message },
        { status: 500 }
      );
    }

    const movedCount = expiredSubscriptions.length;

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
