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

    // Get the subscription to move
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('active_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Insert into expired_subscriptions
    const { error: insertError } = await supabaseAdmin
      .from('expired_subscriptions')
      .insert({
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
        expired_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error inserting into expired_subscriptions:', insertError);
      return NextResponse.json(
        { error: 'Failed to move subscription to expired', details: insertError.message },
        { status: 500 }
      );
    }

    // Delete from active_subscriptions
    const { error: deleteError } = await supabaseAdmin
      .from('active_subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (deleteError) {
      console.error('Error deleting from active_subscriptions:', deleteError);
      // Try to clean up the inserted row if delete fails
      await supabaseAdmin
        .from('expired_subscriptions')
        .delete()
        .eq('id', subscriptionId);
      
      return NextResponse.json(
        { error: 'Failed to delete subscription', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription moved to expired subscriptions',
    });
  } catch (error: any) {
    console.error('Error in delete subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

