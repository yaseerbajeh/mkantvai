import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { determineSubscriptionType, calculateExpirationDate } from '@/lib/subscription-utils';

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
    const { orderId, subscriptionType } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('status', 'approved')
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found or not approved' },
        { status: 404 }
      );
    }

    // Check if subscription already exists for this order
    const { data: existingSubscription } = await supabaseAdmin
      .from('active_subscriptions')
      .select('id')
      .eq('order_id', orderId)
      .single();

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'Subscription already exists for this order', subscriptionId: existingSubscription.id },
        { status: 409 }
      );
    }

    // Get product details if product_code exists
    let product = null;
    if (order.product_code) {
      const { data: productData } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('product_code', order.product_code)
        .single();
      product = productData;
    }

    // Determine subscription type - use provided type or let database function determine from category
    // The database function will automatically determine subscription_type from product category
    // if p_subscription_type is null
    const subType = subscriptionType || null;

    // Get subscription code
    let subscriptionCode = 'SUB-' + Math.random().toString(36).substr(2, 8).toUpperCase();
    if (order.assigned_subscription?.code) {
      subscriptionCode = order.assigned_subscription.code;
    }

    // Get duration
    let durationText = '1 شهر'; // Default
    if (product?.duration) {
      durationText = product.duration;
    } else if (order.assigned_subscription?.meta?.duration) {
      durationText = order.assigned_subscription.meta.duration;
    }

    // Calculate dates
    const startDate = new Date(order.created_at || new Date());
    const expirationDate = calculateExpirationDate(startDate, durationText);

    // Create subscription using database function
    // Pass null for p_subscription_type to let function determine from product category
    const { data: subscriptionId, error: createError } = await supabaseAdmin.rpc(
      'auto_create_subscription_from_order',
      {
        p_order_id: orderId,
        p_subscription_type: subType, // null will trigger category-based determination
      }
    );

    if (createError) {
      // If function fails, try manual insert
      const { data: newSubscription, error: insertError } = await supabaseAdmin
        .from('active_subscriptions')
        .insert({
          order_id: orderId,
          customer_name: order.name,
          customer_email: order.email,
          customer_phone: order.whatsapp || null,
          subscription_code: subscriptionCode,
          subscription_type: subType,
          subscription_duration: durationText,
          expiration_date: expirationDate.toISOString(),
          start_date: startDate.toISOString(),
          product_code: order.product_code || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating subscription:', insertError);
        return NextResponse.json(
          { error: 'Failed to create subscription', details: insertError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        subscription: newSubscription,
      });
    }

    // Get the created subscription
    const { data: subscription } = await supabaseAdmin
      .from('active_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error: any) {
    console.error('Error in auto-create subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

