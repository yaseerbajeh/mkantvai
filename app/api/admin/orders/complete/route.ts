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

    // First, check if order exists and is pending
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: 'الطلب غير موجود' },
        { status: 404 }
      );
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'يمكن فقط تحديث حالة الطلبات المعلقة' },
        { status: 400 }
      );
    }

    // Check if the email exists in authentication system
    // Only allow marking as paid if user is registered
    if (order.email) {
      try {
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (authError) {
          console.error('Error checking user existence:', authError);
          return NextResponse.json(
            { error: 'فشل التحقق من وجود المستخدم. يرجى المحاولة مرة أخرى.' },
            { status: 500 }
          );
        }

        const userExists = authUsers?.users?.some(user => 
          user.email?.toLowerCase() === order.email.toLowerCase()
        );

        if (!userExists) {
          return NextResponse.json(
            { error: `البريد الإلكتروني ${order.email} غير مسجل في النظام. يجب أن يكون العميل مسجلاً أولاً قبل تعيين الطلب كمدفوع.` },
            { status: 400 }
          );
        }
      } catch (authCheckError: any) {
        console.error('Error checking user existence:', authCheckError);
        return NextResponse.json(
          { error: 'حدث خطأ أثناء التحقق من وجود المستخدم. يرجى المحاولة مرة أخرى.' },
          { status: 500 }
        );
      }
    }

    // Step 1: Assign subscription from inventory
    let assignedSubscription: any = null;
    try {
      const { data: assignedSub, error: assignError } = await supabaseAdmin.rpc(
        'assign_subscription_to_order',
        {
          p_order_id: order_id,
          p_admin_id: adminUser.id,
        }
      );

      if (assignError) {
        console.error('Error assigning subscription:', assignError);
        return NextResponse.json(
          { error: assignError.message || 'فشل في تعيين الاشتراك. يرجى التأكد من وجود اشتراكات متاحة في المخزون.' },
          { status: 400 }
        );
      }

      assignedSubscription = assignedSub;
    } catch (assignErr: any) {
      console.error('Error in subscription assignment:', assignErr);
      return NextResponse.json(
        { error: 'فشل في تعيين الاشتراك. يرجى المحاولة مرة أخرى.' },
        { status: 500 }
      );
    }

    // Step 2: Update order status to 'paid' (assign_subscription_to_order sets it to 'approved', so we update to 'paid')
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'paid',
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Error updating order status:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'فشل في تحديث حالة الطلب' },
        { status: 500 }
      );
    }

    // Step 3: Create active subscription entry
    try {
      // First, temporarily update order status to 'approved' so auto_create_subscription_from_order can work
      await supabaseAdmin
        .from('orders')
        .update({ status: 'approved' })
        .eq('id', order_id);

      // Now create active subscription entry
      const { error: createSubError } = await supabaseAdmin.rpc(
        'auto_create_subscription_from_order',
        {
          p_order_id: order_id,
          p_subscription_type: null, // Will be determined by product category
        }
      );

      // Update back to 'paid' status
      await supabaseAdmin
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', order_id);

      if (createSubError) {
        console.error('Error creating active subscription:', createSubError);
        // Non-critical error - subscription is assigned but active subscription creation failed
        console.warn('Subscription assigned but active subscription creation failed:', createSubError.message);
      }
    } catch (createSubErr: any) {
      console.error('Error in auto_create_subscription_from_order:', createSubErr);
      // Non-critical error - continue
    }

    // Step 4: Fetch updated order with subscription
    const { data: updatedOrder, error: fetchUpdatedOrderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (fetchUpdatedOrderError) {
      console.error('Error fetching updated order:', fetchUpdatedOrderError);
    }

    const finalOrder = updatedOrder || order;

    // Step 5: Send email to customer with subscription details
    try {
      const { sendApprovalEmail } = await import('@/utils/sendEmail');
      const subscriptionData = (finalOrder as any)?.assigned_subscription as any;
      const orderDisplayId = (finalOrder as any)?.order_number || finalOrder.id.slice(0, 8).toUpperCase();
      
      if (subscriptionData?.code) {
        await sendApprovalEmail({
          orderId: orderDisplayId,
          name: finalOrder.name,
          email: finalOrder.email,
          subscriptionCode: subscriptionData.code,
          subscriptionMeta: subscriptionData.meta,
        });
        console.log(`Approval email sent to ${finalOrder.email} for order ${orderDisplayId}`);
      }
    } catch (emailError) {
      console.error('Error sending approval email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث حالة الطلب إلى مدفوع وتعيين الاشتراك وإرسال التفاصيل للعميل',
      order: finalOrder,
      subscription: assignedSubscription,
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع', details: error.message },
      { status: 500 }
    );
  }
}

