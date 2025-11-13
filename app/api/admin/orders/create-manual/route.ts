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
    const { 
      customer_name, 
      customer_email, 
      customer_whatsapp,
      product_code,
      product_name,
      price,
      payment_status, // 'paid' or 'unpaid'
      selected_subscription_code // Optional: specific subscription code to assign
    } = body;

    // Validation
    if (!customer_name || !customer_email || !product_name || !price) {
      return NextResponse.json(
        { error: 'يرجى ملء جميع الحقول المطلوبة' },
        { status: 400 }
      );
    }

    if (!payment_status || !['paid', 'unpaid'].includes(payment_status)) {
      return NextResponse.json(
        { error: 'حالة الدفع غير صحيحة' },
        { status: 400 }
      );
    }

    // Use service role key for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if the email exists in authentication system
    // Required for both paid and unpaid orders - user must be signed up
    try {
      // Use listUsers with filter to check if user exists by email
      // This is more efficient than listing all users
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error checking user existence:', authError);
        return NextResponse.json(
          { error: 'فشل التحقق من وجود المستخدم. يرجى المحاولة مرة أخرى.' },
          { status: 500 }
        );
      }

      const userExists = authUsers?.users?.some(user => 
        user.email?.toLowerCase() === customer_email.toLowerCase()
      );

      if (!userExists) {
        return NextResponse.json(
          { error: `البريد الإلكتروني ${customer_email} غير مسجل في النظام. يجب أن يكون العميل مسجلاً أولاً قبل إنشاء طلب.` },
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

    // Prepare order data
    const orderData: any = {
      name: customer_name,
      email: customer_email,
      whatsapp: customer_whatsapp || null,
      product_name: product_name,
      product_code: product_code || null,
      price: parseFloat(price),
      total_amount: parseFloat(price), // Set total_amount to price for consistency
      status: payment_status === 'paid' ? 'paid' : 'pending',
      is_cart_order: false, // Manual orders are not cart orders
    };

    // Add payment information if paid
    if (payment_status === 'paid') {
      orderData.payment_method = 'manual';
      orderData.payment_status = 'COMPLETED';
    }

    // Create order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json(
        { error: orderError.message || 'حدث خطأ أثناء إنشاء الطلب' },
        { status: 500 }
      );
    }

    // If paid, assign subscription and create active subscription
    if (payment_status === 'paid') {
      try {
        let assignedSubscription: any = null;
        let assignError: any = null;

        // Step 1: Assign subscription from inventory
        if (selected_subscription_code) {
          // Manually assign specific subscription code
          // First, find the subscription with this code
          const { data: subscription, error: findError } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('subscription_code', selected_subscription_code)
            .eq('product_code', product_code || '')
            .maybeSingle();

          if (findError || !subscription) {
            assignError = findError || new Error('رمز الاشتراك المحدد غير موجود أو غير متطابق مع المنتج');
            console.error('Error finding subscription:', assignError);
          } else {
            // Delete the subscription from available pool
            const { error: deleteError } = await supabaseAdmin
              .from('subscriptions')
              .delete()
              .eq('id', subscription.id);

            if (deleteError) {
              assignError = deleteError;
              console.error('Error deleting subscription:', deleteError);
            } else {
              // Record in used_subscriptions for audit
              const { error: usedSubError } = await supabaseAdmin
                .from('used_subscriptions')
                .insert({
                  order_id: order.id,
                  subscription_code: subscription.subscription_code,
                  subscription_meta: subscription.subscription_meta,
                  assigned_by: adminUser.id,
                });

              if (usedSubError) {
                console.error('Error recording used subscription:', usedSubError);
                // Non-critical error - continue
              }

              // Build assigned subscription JSONB
              assignedSubscription = {
                code: subscription.subscription_code,
                meta: subscription.subscription_meta || {},
              };

              // Update order with assigned subscription
              const { error: updateOrderError } = await supabaseAdmin
                .from('orders')
                .update({
                  status: 'approved',
                  assigned_subscription: assignedSubscription,
                })
                .eq('id', order.id);

              if (updateOrderError) {
                assignError = updateOrderError;
                console.error('Error updating order with subscription:', updateOrderError);
              }
            }
          }
        } else {
          // Use RPC function for automatic assignment
          const result = await supabaseAdmin.rpc(
            'assign_subscription_to_order',
            {
              p_order_id: order.id,
              p_admin_id: adminUser.id,
            }
          );
          assignedSubscription = result.data;
          assignError = result.error;
        }

        if (assignError) {
          console.error('Error assigning subscription:', assignError);
          // Order was created but subscription assignment failed
          // Return success but with warning
          return NextResponse.json({
            success: true,
            order: order,
            warning: 'تم إنشاء الطلب بنجاح ولكن فشل تعيين الاشتراك. يرجى تعيينه يدوياً.',
            subscriptionError: assignError.message,
          }, { status: 200 });
        }

        // Step 2: Update order status to 'approved' so auto_create_subscription_from_order can work
        // The function checks for status = 'approved', but we created it with 'paid'
        // Update it to 'approved' temporarily if needed, or create subscription manually
        try {
          // First, update order status to 'approved' if it's 'paid'
          // (The function requires status = 'approved')
          const { error: updateStatusError } = await supabaseAdmin
            .from('orders')
            .update({ status: 'approved' })
            .eq('id', order.id);

          if (updateStatusError) {
            console.error('Error updating order status to approved:', updateStatusError);
          }

          // Now create active subscription entry
          const { data: activeSubscription, error: createSubError } = await supabaseAdmin.rpc(
            'auto_create_subscription_from_order',
            {
              p_order_id: order.id,
              p_subscription_type: null, // Will be determined by product category
            }
          );

          if (createSubError) {
            console.error('Error creating active subscription:', createSubError);
            // Subscription was assigned but active subscription creation failed
            // This is not critical - subscription is still assigned to order
            console.warn('Subscription assigned but active subscription creation failed:', createSubError.message);
          }

          // Update back to 'paid' status after creating subscription
          // This ensures the order has the correct final status
          const { error: updateToPaidError } = await supabaseAdmin
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', order.id);

          if (updateToPaidError) {
            console.error('Error updating order status back to paid:', updateToPaidError);
            // If this fails, the order might remain in 'approved' status
            // This is OK as 'approved' is also in the allowed statuses for the orders list
          }
        } catch (createSubErr: any) {
          console.error('Error in auto_create_subscription_from_order:', createSubErr);
          // Non-critical error - continue
          // Try to ensure order has correct status even if subscription creation fails
          try {
            await supabaseAdmin
              .from('orders')
              .update({ status: 'paid' })
              .eq('id', order.id);
          } catch (statusErr) {
            console.error('Error updating order status after subscription creation error:', statusErr);
          }
        }

        // Step 3: Fetch updated order with subscription
        const { data: updatedOrder, error: fetchError } = await supabaseAdmin
          .from('orders')
          .select('*')
          .eq('id', order.id)
          .single();

        if (fetchError) {
          console.error('Error fetching updated order:', fetchError);
        }

        const finalOrder = updatedOrder || order;

        // Log the final order status for debugging
        console.log('🔍 Final order status after processing:', {
          order_id: finalOrder.id,
          status: finalOrder.status,
          payment_method: (finalOrder as any).payment_method,
          payment_status: (finalOrder as any).payment_status,
          has_assigned_subscription: !!(finalOrder as any).assigned_subscription,
          name: finalOrder.name,
          email: finalOrder.email,
          product_name: finalOrder.product_name,
          price: finalOrder.price,
          total_amount: (finalOrder as any).total_amount,
          is_cart_order: (finalOrder as any).is_cart_order,
        });

        // Step 4: Send email to customer with subscription details
        try {
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
            console.log(`Approval email sent to ${finalOrder.email} for manual order ${orderDisplayId}`);
          }
        } catch (emailError) {
          console.error('Error sending approval email:', emailError);
          // Don't fail the request if email fails
        }

        return NextResponse.json({
          success: true,
          order: finalOrder,
          subscription: assignedSubscription,
          message: 'تم إنشاء الطلب وتعيين الاشتراك وإرسال التفاصيل للعميل',
        });

      } catch (error: any) {
        console.error('Error in paid order processing:', error);
        // Order was created but subscription processing failed
        return NextResponse.json({
          success: true,
          order: order,
          warning: 'تم إنشاء الطلب ولكن حدث خطأ أثناء معالجة الاشتراك',
          error: error.message,
        }, { status: 200 });
      }
    }

    // If unpaid, just return the created order
    return NextResponse.json({
      success: true,
      order: order,
      message: 'تم إنشاء الطلب بنجاح',
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع', details: error.message },
      { status: 500 }
    );
  }
}

