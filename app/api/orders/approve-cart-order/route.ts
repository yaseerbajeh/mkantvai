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

      // FIRST: Check the current status of the PayPal order before attempting capture
      console.log(`Checking PayPal order status before capture: ${paypalOrderId}`);
      const checkOrderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${paypalOrderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      const orderStatus = await checkOrderResponse.json();
      
      if (!checkOrderResponse.ok) {
        console.error('Failed to check PayPal order status:', orderStatus);
        return NextResponse.json(
          { 
            error: `فشل في التحقق من حالة الطلب: ${orderStatus.message || 'خطأ غير معروف'}`,
            details: process.env.NODE_ENV === 'development' ? orderStatus : undefined,
          },
          { status: 500 }
        );
      }

      // Check if order is already completed/captured
      if (orderStatus.status === 'COMPLETED') {
        const purchaseUnit = orderStatus.purchase_units?.[0];
        const capture = purchaseUnit?.payments?.captures?.[0];
        
        if (capture && capture.status === 'COMPLETED') {
          // Payment was already captured - update database and continue
          console.log('PayPal order already captured:', {
            captureId: capture.id,
            amount: capture.amount,
            captureStatus: capture.status,
          });

          // Use the capture result from the order status check
          captureResult = orderStatus;
          
          // Update database to reflect that payment was already captured
          const { error: updateError } = await supabaseAdmin
            .from('orders')
            .update({
              status: 'paid',
              payment_status: 'COMPLETED',
              payment_id: paypalOrderId,
            })
            .eq('id', order.id);

          if (updateError) {
            console.error('Error updating order status:', updateError);
            // Continue anyway since payment was captured
          }

          // Skip to subscription assignment since payment is already captured
          console.log('Payment was already captured, proceeding with subscription assignment');
        } else {
          // Order marked as COMPLETED but no capture found - this shouldn't happen
          console.error('Order status is COMPLETED but no capture found:', orderStatus);
          return NextResponse.json(
            { 
              error: 'حالة الطلب غير صحيحة في PayPal. يرجى المحاولة مرة أخرى أو الاتصال بالدعم.',
              details: process.env.NODE_ENV === 'development' ? orderStatus : undefined,
            },
            { status: 500 }
          );
        }
      } else if (orderStatus.status === 'APPROVED' || orderStatus.status === 'CREATED') {
        // Order is in a capturable state - proceed with capture
        console.log(`PayPal order status: ${orderStatus.status}, attempting capture...`);
        
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
          
          // Handle specific PayPal errors
          if (captureResult.name === 'UNPROCESSABLE_ENTITY') {
            const errorMessage = captureResult.message || 'لا يمكن معالجة الطلب';
            const errorDetails = captureResult.details || [];
            
            // Check if order was already captured (sometimes PayPal returns this error even if captured)
            // Try to get order status again to check
            const recheckResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${paypalOrderId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenData.access_token}`,
              },
            });
            
            const recheckStatus = await recheckResponse.json();
            if (recheckStatus.status === 'COMPLETED') {
              const purchaseUnit = recheckStatus.purchase_units?.[0];
              const capture = purchaseUnit?.payments?.captures?.[0];
              
              if (capture && capture.status === 'COMPLETED') {
                // Order was actually captured - update database
                captureResult = recheckStatus;
                
                const { error: updateError } = await supabaseAdmin
                  .from('orders')
                  .update({
                    status: 'paid',
                    payment_status: 'COMPLETED',
                    payment_id: paypalOrderId,
                  })
                  .eq('id', order.id);

                if (!updateError) {
                  // Continue with subscription assignment
                  console.log('Payment was captured (verified after error), proceeding with subscription assignment');
                } else {
                  return NextResponse.json(
                    { 
                      error: 'تم استلام الدفع ولكن فشل تحديث حالة الطلب. يرجى تحديثها يدوياً.',
                      captureId: capture.id,
                    },
                    { status: 500 }
                  );
                }
              } else {
                return NextResponse.json(
                  { 
                    error: `فشل في معالجة الدفع: ${errorMessage}`,
                    details: process.env.NODE_ENV === 'development' ? {
                      errorName: captureResult.name,
                      message: captureResult.message,
                      details: errorDetails,
                      debug_id: captureResult.debug_id,
                    } : undefined,
                  },
                  { status: 400 }
                );
              }
            } else {
              // Order is not completed - return error
              return NextResponse.json(
                { 
                  error: `فشل في معالجة الدفع: ${errorMessage}`,
                  details: process.env.NODE_ENV === 'development' ? {
                    errorName: captureResult.name,
                    message: captureResult.message,
                    details: errorDetails,
                    debug_id: captureResult.debug_id,
                    paypalStatus: recheckStatus.status,
                  } : undefined,
                },
                { status: 400 }
              );
            }
          } else if (orderStatus.status === 'EXPIRED' || captureResult.status === 'EXPIRED') {
            return NextResponse.json(
              { 
                error: 'انتهت صلاحية التفويض. لا يمكن استلام الدفع الآن. المبلغ سيعود للعميل تلقائياً.',
                details: captureResult.message || 'Authorization expired',
              },
              { status: 400 }
            );
          } else {
            // Other error
            const errorDetails = captureResult.details || [];
            const errorMessage = captureResult.message || 'خطأ غير معروف من PayPal';
            
            return NextResponse.json(
              { 
                error: `فشل في معالجة الدفع: ${errorMessage}`,
                details: process.env.NODE_ENV === 'development' ? JSON.stringify(captureResult) : undefined,
              },
              { status: 500 }
            );
          }
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
      } else {
        // Order is in an invalid state (CANCELLED, etc.)
        return NextResponse.json(
          { 
            error: `لا يمكن استلام الدفع. حالة الطلب في PayPal: ${orderStatus.status}`,
            details: {
              paypalStatus: orderStatus.status,
              message: orderStatus.status === 'EXPIRED' 
                ? 'انتهت صلاحية التفويض. المبلغ سيعود للعميل تلقائياً.'
                : orderStatus.status === 'CANCELLED'
                ? 'تم إلغاء الطلب.'
                : 'حالة الطلب لا تسمح بالاستلام.',
            },
          },
          { status: 400 }
        );
      }

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

    // ONLY update database AFTER successful PayPal capture (if not already updated)
    // Check if order is already paid to avoid duplicate updates
    if (order.status !== 'paid') {
      const captureId = captureResult?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      
      // Log capture ID for reference (can be stored in database if needed)
      console.log('Payment captured successfully, updating database:', {
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
    } else {
      console.log('Order already marked as paid, skipping database update');
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

