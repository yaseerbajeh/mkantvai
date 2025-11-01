import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendApprovalEmail } from '@/utils/sendEmail';
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

  // Check if user is admin (you can customize this check)
  // Option 1: Check profiles table for is_admin flag
  // Option 2: Check user email
  // Option 3: Use a simple email whitelist
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
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'رقم الطلب مطلوب' },
        { status: 400 }
      );
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Call the SQL function to assign subscription atomically
    const { data, error } = await supabaseAdmin.rpc('assign_subscription_to_order', {
      p_order_id: order_id,
      p_admin_id: adminUser.id,
    });

    if (error) {
      console.error('Error assigning subscription:', error);
      
      // Check if it's the "no subscriptions available" error
      if (error.message.includes('لا توجد اشتراكات متاحة')) {
        return NextResponse.json(
          { error: 'لا توجد اشتراكات متاحة حالياً' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error.message || 'حدث خطأ أثناء تفعيل الاشتراك' },
        { status: 500 }
      );
    }

    // Fetch order details for email
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Error fetching order:', orderError);
      // Subscription was assigned but couldn't fetch order - still return success
      return NextResponse.json(
        { 
          success: true,
          message: 'تم تفعيل الاشتراك بنجاح',
          subscription: data
        },
        { status: 200 }
      );
    }

    // Send approval email to customer (non-blocking)
    try {
      const subscriptionData = order.assigned_subscription as any;
      const orderDisplayId = (order as any).order_number || order.id.slice(0, 8).toUpperCase();
      await sendApprovalEmail({
        orderId: orderDisplayId,
        name: order.name,
        email: order.email,
        subscriptionCode: subscriptionData?.code || '',
        subscriptionMeta: subscriptionData?.meta,
      });
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'تم تفعيل الاشتراك وإرسال التفاصيل للعميل',
        subscription: data
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

