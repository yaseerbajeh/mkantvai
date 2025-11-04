import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendApprovalEmail, sendNewOrderEmail } from '@/utils/sendEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, payerID } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'معرف الطلب مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // First, try to find order by PayPal order ID (payment_id)
    let order: any = null;
    let orderError: any = null;

    // Try to find by payment_id (PayPal order ID)
    const { data: orderByPaymentId, error: errorByPaymentId } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('payment_id', orderId)
      .single();

    if (orderByPaymentId && !errorByPaymentId) {
      order = orderByPaymentId;
    } else {
      // Fallback: try to find by our database order ID
      const { data: orderById, error: errorById } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();
      
      order = orderById;
      orderError = errorById;
    }

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'الطلب غير موجود' },
        { status: 404 }
      );
    }

    // Get PayPal order ID - use the one from request or from order.payment_id
    const paypalOrderId = order.payment_id || orderId;
    
    // ⚠️ CRITICAL: Capture the payment from PayPal FIRST before updating database
    // DO NOT mark order as paid without capturing payment from PayPal!
    // This ensures the money actually arrives in your PayPal account.
    // The PayPal SDK only AUTHORIZES the payment - we must CAPTURE it server-side.
    const paypalMode = process.env.PAYPAL_MODE || 'sandbox';
    const paypalBaseUrl = paypalMode === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!paypalClientId || !paypalSecret) {
      console.error('PayPal credentials missing - cannot capture payment');
      return NextResponse.json(
        { error: 'إعدادات PayPal غير متوفرة - لا يمكن معالجة الدفع' },
        { status: 500 }
      );
    }

    let captureResult: any = null;
    
    try {
      // Get PayPal access token
      const authString = Buffer.from(`${paypalClientId}:${paypalSecret}`).toString('base64');
      const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authString}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (!tokenData.access_token) {
        console.error('Failed to get PayPal access token:', tokenData);
        return NextResponse.json(
          { error: 'فشل في الاتصال بـ PayPal' },
          { status: 500 }
        );
      }

      // Capture the PayPal order - THIS IS CRITICAL FOR PAYMENT TO ARRIVE
      const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Prefer': 'return=representation',
        },
      });

      captureResult = await captureResponse.json();
      
      // Check if capture was successful
      if (!captureResponse.ok || captureResult.status !== 'COMPLETED') {
        console.error('PayPal capture failed:', {
          status: captureResponse.status,
          statusText: captureResponse.statusText,
          response: captureResult,
          paypalOrderId,
        });
        
        // Log detailed error for debugging
        const errorDetails = captureResult.details || [];
        const errorMessage = captureResult.message || 'Unknown PayPal error';
        
        return NextResponse.json(
          { 
            error: `فشل في معالجة الدفع من PayPal: ${errorMessage}`,
            details: process.env.NODE_ENV === 'development' ? JSON.stringify(captureResult) : undefined,
          },
          { status: 500 }
        );
      }

      // Verify payment was actually captured
      const purchaseUnit = captureResult.purchase_units?.[0];
      const capture = purchaseUnit?.payments?.captures?.[0];
      
      if (!capture || capture.status !== 'COMPLETED') {
        console.error('Payment capture not completed:', captureResult);
        return NextResponse.json(
          { error: 'فشل في معالجة الدفع - لم يتم استلام الأموال' },
          { status: 500 }
        );
      }

      console.log('PayPal payment successfully captured:', {
        captureId: capture.id,
        amount: capture.amount,
        status: capture.status,
        paypalOrderId,
      });

    } catch (captureError: any) {
      console.error('Error capturing PayPal payment:', {
        error: captureError.message,
        stack: captureError.stack,
        paypalOrderId,
      });
      
      return NextResponse.json(
        { 
          error: 'فشل في معالجة الدفع من PayPal',
          details: process.env.NODE_ENV === 'development' ? captureError.message : undefined,
        },
        { status: 500 }
      );
    }

    // ONLY update database AFTER successful PayPal capture
    const captureId = captureResult?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    
    // Log capture ID for reference (can be stored in database if needed)
    console.log('Payment captured successfully:', {
      captureId,
      amount: captureResult?.purchase_units?.[0]?.payments?.captures?.[0]?.amount,
    });
    
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'paid',
        payment_status: 'COMPLETED',
        payment_id: paypalOrderId, // Keep PayPal order ID
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json(
        { error: 'فشل تحديث حالة الطلب' },
        { status: 500 }
      );
    }

    // Assign subscriptions for each item
    const orderItems = (order as any).order_items || [];
    const assignedSubscriptions: any[] = [];

    for (const item of orderItems) {
      // For each quantity unit, assign a subscription
      for (let i = 0; i < item.quantity; i++) {
        try {
          // Call assign_subscription_to_order for each quantity
          const { data: assigned, error: assignError } = await supabaseAdmin.rpc(
            'assign_subscription_to_order',
            {
              p_order_id: order.id,
              p_admin_id: null, // System assignment
            }
          );

          if (!assignError && assigned) {
            assignedSubscriptions.push({
              product_code: item.product_code,
              product_name: item.product_name,
              subscription: assigned,
            });
          } else if (assignError) {
            console.error(`Error assigning subscription for ${item.product_code}:`, assignError);
          }
        } catch (err) {
          console.error(`Error assigning subscription for ${item.product_code}:`, err);
        }
      }
    }

    // Update promo code usage
    if ((order as any).promo_code_id) {
      try {
        await supabaseAdmin.rpc('increment_promo_code_usage', {
          promo_code_id: (order as any).promo_code_id,
        });
      } catch (promoError) {
        console.error('Error incrementing promo code usage:', promoError);
        // Don't fail the request if promo code update fails
      }
    }

    // Fetch updated order
    const { data: updatedOrder } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order.id)
      .single();

    // Send emails after payment is approved
    try {
      const orderDisplayId = (updatedOrder as any)?.order_number || order.id.slice(0, 8).toUpperCase();
      
      // Send admin notification email (new order notification)
      try {
        await sendNewOrderEmail({
          orderId: orderDisplayId,
          name: order.name,
          email: order.email,
          whatsapp: order.whatsapp || undefined,
          productName: order.product_name,
          price: (updatedOrder as any)?.total_amount || order.total_amount || order.price,
          createdAt: (updatedOrder as any)?.created_at || order.created_at,
        });
      } catch (adminEmailError) {
        console.error('Error sending admin notification email:', adminEmailError);
        // Don't fail the request if admin email fails
      }
      
      // Send customer approval email with subscription details
      await sendApprovalEmail({
        orderId: orderDisplayId,
        name: order.name,
        email: order.email,
        subscriptionCode: assignedSubscriptions.length > 0 ? assignedSubscriptions[0].subscription.code : undefined,
        subscriptionMeta: assignedSubscriptions.length > 0 ? assignedSubscriptions[0].subscription.meta : undefined,
        // Note: We're sending the first subscription in the standard format
        // For cart orders with multiple subscriptions, you may want to customize the email
      });
    } catch (emailError) {
      console.error('Error sending emails:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      subscriptions: assignedSubscriptions,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

