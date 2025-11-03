import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendNewOrderEmail, sendApprovalEmail } from '@/utils/sendEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Product mapping for PayPal payment links
const PAYPAL_PAYMENT_LINKS: { [key: string]: { product_code: string; product_name: string; price: number } } = {
  '5ZMTA2LQS9UCN': {
    product_code: 'SUB-BASIC-1M',
    product_name: 'اشتراك IPTV - 1 شهر',
    price: 49,
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, whatsapp, product_code, payment_link_id } = body;

    // Validate required fields
    if (!name || !email || !whatsapp || !product_code) {
      return NextResponse.json(
        { error: 'يرجى ملء جميع الحقول المطلوبة' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني غير صحيح' },
        { status: 400 }
      );
    }

    // Get product details
    const productDetails = PAYPAL_PAYMENT_LINKS[payment_link_id] || {
      product_code: product_code,
      product_name: 'اشتراك IPTV - 1 شهر',
      price: 49,
    };

    // Create Supabase admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create order with paid status (since they already paid via PayPal link)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        name,
        whatsapp: whatsapp || null,
        email,
        product_name: productDetails.product_name,
        product_code: productDetails.product_code,
        price: productDetails.price,
        status: 'paid', // Already paid via PayPal link
        payment_method: 'paypal_link',
        payment_status: 'COMPLETED',
        payment_id: payment_link_id || `paypal_link_${Date.now()}`,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Failed to create order:', orderError);
      return NextResponse.json(
        {
          error: orderError?.message || 'حدث خطأ أثناء إنشاء الطلب',
          details: JSON.stringify(orderError),
        },
        { status: 500 }
      );
    }

    // Automatically assign subscription (no admin approval needed for PayPal link payments)
    try {
      const { data: assignedSubscription, error: assignError } = await supabaseAdmin.rpc(
        'assign_subscription_to_order',
        {
          p_order_id: order.id,
          p_admin_id: null, // No admin needed for automated assignment
        }
      );

      if (assignError) {
        console.error('Failed to assign subscription:', assignError);
        // Order was created but subscription assignment failed
        // Send email to admin about this issue
        try {
          const orderDisplayId = (order as any).order_number || order.id.slice(0, 8).toUpperCase();
          await sendNewOrderEmail({
            orderId: orderDisplayId,
            name: order.name,
            email: order.email,
            whatsapp: order.whatsapp || undefined,
            productName: order.product_name,
            price: parseFloat(order.price as any),
            createdAt: order.created_at,
          });
        } catch (emailErr) {
          console.error('Error sending admin email:', emailErr);
        }

        return NextResponse.json({
          success: true,
          order: {
            ...order,
            status: 'paid',
          },
          warning: 'Subscription assignment failed - please assign manually',
          subscriptionError: assignError.message,
        });
      }

      // Fetch updated order with subscription
      const { data: updatedOrder } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', order.id)
        .single();

      // Send email to admin about new PayPal link order
      try {
        const orderDisplayId = (updatedOrder as any)?.order_number || order.id.slice(0, 8).toUpperCase();
        await sendNewOrderEmail({
          orderId: orderDisplayId,
          name: order.name,
          email: order.email,
          whatsapp: order.whatsapp || undefined,
          productName: order.product_name,
          price: parseFloat(order.price as any),
          createdAt: order.created_at,
        });
      } catch (emailErr) {
        console.error('Error sending admin email:', emailErr);
      }

      // Send approval email to customer with subscription details
      try {
        const subscriptionData = (updatedOrder as any)?.assigned_subscription as any;
        const orderDisplayId = (updatedOrder as any)?.order_number || order.id.slice(0, 8).toUpperCase();
        
        if (subscriptionData?.code) {
          await sendApprovalEmail({
            orderId: orderDisplayId,
            name: order.name,
            email: order.email,
            subscriptionCode: subscriptionData.code,
            subscriptionMeta: subscriptionData.meta,
          });
        }
      } catch (emailErr) {
        console.error('Error sending customer email:', emailErr);
      }

      return NextResponse.json({
        success: true,
        order: updatedOrder,
        subscription: assignedSubscription,
      });
    } catch (assignErr: any) {
      console.error('Error in subscription assignment:', assignErr);
      
      // Still return success with order
      return NextResponse.json({
        success: true,
        order: order,
        warning: 'Subscription assignment encountered an error',
      });
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع', message: error.message },
      { status: 500 }
    );
  }
}

