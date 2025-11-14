import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get admin user from auth token
async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  // Check if user is admin
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting for admin endpoints
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    // Check admin authentication
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول كمسؤول.' },
        { status: 401 }
      );
    }

    const orderId = params.id;

    if (!orderId) {
      return NextResponse.json(
        { error: 'رقم الطلب مطلوب' },
        { status: 400 }
      );
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // First, check if order exists and get full order details
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, name, email, product_code, product_name')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: 'الطلب غير موجود' },
        { status: 404 }
      );
    }

    // Delete associated subscription(s) from active_subscriptions if they exist
    // Note: active_subscriptions has ON DELETE SET NULL, so order_id might already be NULL
    // We need to match by order_id first, then by email + product_code as fallback
    let subscriptionsToDelete: string[] = [];

    // Method 1: Find by order_id (most reliable)
    const { data: subscriptionsByOrderId, error: subscriptionFetchError } = await supabaseAdmin
      .from('active_subscriptions')
      .select('id')
      .eq('order_id', orderId);

    if (!subscriptionFetchError && subscriptionsByOrderId) {
      subscriptionsToDelete.push(...subscriptionsByOrderId.map(s => s.id));
    }

    // Method 2: Find by email + product_code (in case order_id was set to NULL)
    // This catches subscriptions that lost their order_id reference due to ON DELETE SET NULL
    if (order.email && order.product_code) {
      const { data: subscriptionsByEmail, error: emailFetchError } = await supabaseAdmin
        .from('active_subscriptions')
        .select('id, order_id, customer_email, product_code')
        .eq('customer_email', order.email)
        .eq('product_code', order.product_code)
        .is('order_id', null); // Only match subscriptions with NULL order_id

      if (!emailFetchError && subscriptionsByEmail) {
        // Only add if they don't already have an order_id (orphaned subscriptions)
        const orphanedIds = subscriptionsByEmail
          .filter(s => s.order_id === null)
          .map(s => s.id);
        subscriptionsToDelete.push(...orphanedIds);
      }
    }

    // Remove duplicates
    subscriptionsToDelete = [...new Set(subscriptionsToDelete)];

    // Delete all found subscriptions
    if (subscriptionsToDelete.length > 0) {
      const { error: deleteSubscriptionError } = await supabaseAdmin
        .from('active_subscriptions')
        .delete()
        .in('id', subscriptionsToDelete);

      if (deleteSubscriptionError) {
        console.error('Error deleting subscriptions:', deleteSubscriptionError);
        // Continue with order deletion even if subscription deletion fails
      } else {
        console.log(`Deleted ${subscriptionsToDelete.length} subscription(s) for order ${orderId}`);
      }
    }

    // Delete the order (cascade will handle order_items and used_subscriptions)
    const { error: deleteError } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (deleteError) {
      console.error('Error deleting order:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'فشل في حذف الطلب' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف الطلب بنجاح',
      deletedOrder: {
        id: order.id,
        order_number: order.order_number,
        name: order.name,
      },
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع', details: error.message },
      { status: 500 }
    );
  }
}

