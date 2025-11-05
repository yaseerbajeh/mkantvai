import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';
import { sendSubscriptionRefreshEmail } from '@/utils/sendEmail';

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
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { order_id, active_subscription_id } = body;

    if (!order_id && !active_subscription_id) {
      return NextResponse.json(
        { error: 'يجب توفير order_id أو active_subscription_id' },
        { status: 400 }
      );
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Call the SQL function to refresh subscription
    const { data, error } = await supabaseAdmin.rpc('refresh_subscription_from_inventory', {
      p_order_id: order_id || null,
      p_active_subscription_id: active_subscription_id || null,
    });

    if (error) {
      console.error('Error refreshing subscription:', error);
      
      // Check for specific error messages
      if (error.message.includes('لا توجد اشتراكات متاحة')) {
        return NextResponse.json(
          { error: 'لا توجد اشتراكات متاحة في المخزون للمنتج المحدد' },
          { status: 400 }
        );
      }
      
      if (error.message.includes('غير موجود')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'حدث خطأ أثناء تحديث الاشتراك' },
        { status: 500 }
      );
    }

    // Get order details for email
    const orderIdToFetch = order_id || data.order_id;
    let order: any = null;
    let userEmail = '';
    let userName = '';

    if (orderIdToFetch) {
      const { data: orderData, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderIdToFetch)
        .single();

      if (!orderError && orderData) {
        order = orderData;
        userEmail = order.email;
        userName = order.name;
      }
    }

    // If no order, try to get from active_subscriptions
    if (!userEmail && active_subscription_id) {
      const { data: activeSub, error: subError } = await supabaseAdmin
        .from('active_subscriptions')
        .select('customer_email, customer_name')
        .eq('id', active_subscription_id)
        .single();

      if (!subError && activeSub) {
        userEmail = activeSub.customer_email;
        userName = activeSub.customer_name;
      }
    }

    // Send email notification to user
    if (userEmail) {
      try {
        await sendSubscriptionRefreshEmail({
          userName,
          userEmail,
          subscriptionCode: data.subscription_code,
          subscriptionMeta: data.subscription_meta,
          orderId: orderIdToFetch || undefined,
        });
      } catch (emailError) {
        console.error('Error sending subscription refresh email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث الاشتراك بنجاح وإرسال التفاصيل للعميل',
      subscription: {
        code: data.subscription_code,
        meta: data.subscription_meta,
        product_code: data.product_code,
      },
      order_id: data.order_id,
      active_subscription_id: data.active_subscription_id,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

