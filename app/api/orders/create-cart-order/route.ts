import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, orderLimiter } from '@/lib/rateLimiter';
import { sendApprovalEmail, sendNewOrderEmail } from '@/utils/sendEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(request, orderLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const body = await request.json();
    const { items, customerInfo, promoCodeId, discountAmount, totalAmount, totalAmountUsd } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'السلة فارغة' },
        { status: 400 }
      );
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.email) {
      return NextResponse.json(
        { error: 'معلومات العميل مطلوبة' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني غير صحيح' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create order with pending status (will be updated to paid after PayPal approval)
    const productName = items.length === 1 
      ? items[0].product_name 
      : `${items.length} منتجات`;

    // Find cart session for this user (if exists) to mark it as converted
    // Note: We'll update it after order is created successfully

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        name: customerInfo.name,
        email: customerInfo.email,
        whatsapp: customerInfo.whatsapp || null,
        product_name: productName,
        product_code: items[0].product_code, // Primary product code for compatibility
        price: totalAmount,
        total_amount: totalAmount,
        discount_amount: discountAmount || 0,
        promo_code_id: promoCodeId || null,
        status: 'pending', // Will be updated to 'paid' after PayPal approval
        payment_method: 'paypal_cart',
        payment_status: 'PENDING',
        is_cart_order: true,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Error creating order:', orderError);
      return NextResponse.json(
        { error: 'فشل إنشاء الطلب' },
        { status: 500 }
      );
    }

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_code: item.product_code,
      product_name: item.product_name,
      price: item.price,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Delete order if items failed
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return NextResponse.json(
        { error: 'فشل إنشاء عناصر الطلب' },
        { status: 500 }
      );
    }

    // Mark cart session as converted (if exists)
    try {
      // Try to find user by email in auth.users
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const matchingUser = authUsers?.users?.find(u => u.email === customerInfo.email);
      
      if (matchingUser) {
        await supabaseAdmin
          .from('cart_sessions')
          .update({ converted_to_order_id: order.id })
          .eq('user_id', matchingUser.id)
          .is('converted_to_order_id', null);
      }
    } catch (error) {
      // Silently fail - cart session conversion is optional
      console.error('Error marking cart session as converted:', error);
    }

    // Check if this is a 100% discount order (totalAmount = 0)
    // If so, skip PayPal and auto-complete the order
    if (totalAmount === 0 || totalAmount <= 0.01) {
      // Auto-complete order for 100% discount
      const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'paid',
          payment_status: 'COMPLETED',
          payment_method: 'promo_code_100',
        })
        .eq('id', order.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating order status:', updateError);
        return NextResponse.json(
          { error: 'فشل تحديث حالة الطلب' },
          { status: 500 }
        );
      }

      // Assign subscriptions for each item
      const assignedSubscriptions: any[] = [];
      for (const item of orderItems) {
        for (let i = 0; i < item.quantity; i++) {
          try {
            const { data: assigned, error: assignError } = await supabaseAdmin.rpc(
              'assign_subscription_to_order',
              {
                p_order_id: order.id,
                p_admin_id: null,
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
      if (promoCodeId) {
        try {
          await supabaseAdmin.rpc('increment_promo_code_usage', {
            promo_code_id: promoCodeId,
          });
        } catch (promoError) {
          console.error('Error incrementing promo code usage:', promoError);
        }
      }

      // Fetch final order with subscription
      const { data: finalOrder } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', order.id)
        .single();

      // Send emails
      try {
        const orderDisplayId = (finalOrder as any)?.order_number || order.id.slice(0, 8).toUpperCase();
        
        // Send admin notification
        try {
          await sendNewOrderEmail({
            orderId: orderDisplayId,
            name: order.name,
            email: order.email,
            whatsapp: order.whatsapp || undefined,
            productName: order.product_name,
            price: 0,
            createdAt: order.created_at,
          });
        } catch (adminEmailError) {
          console.error('Error sending admin notification email:', adminEmailError);
        }

        // Send customer approval email
        await sendApprovalEmail({
          orderId: orderDisplayId,
          name: order.name,
          email: order.email,
          subscriptionCode: assignedSubscriptions.length > 0 ? assignedSubscriptions[0].subscription.code : undefined,
          subscriptionMeta: assignedSubscriptions.length > 0 ? assignedSubscriptions[0].subscription.meta : undefined,
        });
      } catch (emailError) {
        console.error('Error sending emails:', emailError);
      }

      return NextResponse.json({
        orderId: order.id,
        dbOrderId: order.id,
        success: true,
        isFreeOrder: true,
        subscriptions: assignedSubscriptions,
      });
    }

    // Note: Email will be sent after payment approval in approve-cart-order route
    // Do not send email here as order is still pending

    // Create PayPal order
    try {
      const paypalMode = process.env.PAYPAL_MODE || 'sandbox';
      const paypalBaseUrl = paypalMode === 'live' 
        ? 'https://api-m.paypal.com' 
        : 'https://api-m.sandbox.paypal.com';
      
      const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
      const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;

      if (!paypalClientId || !paypalSecret) {
        console.error('PayPal credentials missing');
        // Return database order ID as fallback
        return NextResponse.json({
          orderId: order.id,
          success: true,
          warning: 'PayPal credentials not configured',
        });
      }

      // Get access token from PayPal
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
        console.error('PayPal token response:', tokenData);
        throw new Error(`Failed to get PayPal access token: ${JSON.stringify(tokenData)}`);
      }

      // Create PayPal order
      // Use USD amount for PayPal (convert from SAR)
      const paypalAmount = totalAmountUsd || (totalAmount / 3.75); // Fallback to conversion if not provided
      const amountValue = parseFloat(paypalAmount.toFixed(2));
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error(`Invalid amount: ${paypalAmount}`);
      }

      const paypalOrderPayload = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: amountValue.toFixed(2),
          },
          // Use a shorter custom_id format - PayPal might not accept full UUIDs
          custom_id: order.id.substring(0, 127), // PayPal custom_id max length is 127
          description: (productName || 'Cart Order').substring(0, 127), // PayPal description max length is 127
        }],
      };

      console.log('PayPal order payload:', JSON.stringify(paypalOrderPayload, null, 2));

      const paypalOrderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
          'PayPal-Request-Id': order.id,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(paypalOrderPayload),
      });

      const paypalOrder = await paypalOrderResponse.json();
      
      // Check for PayPal API errors
      if (!paypalOrderResponse.ok || paypalOrder.error || paypalOrder.name === 'UNPROCESSABLE_ENTITY') {
        // Log full error details for debugging
        const errorDetails = paypalOrder.details || [];
        console.error('PayPal API error details:', {
          status: paypalOrderResponse.status,
          statusText: paypalOrderResponse.statusText,
          name: paypalOrder.name,
          message: paypalOrder.message,
          debug_id: paypalOrder.debug_id,
          details: errorDetails,
          fullResponse: paypalOrder,
        });
        
        // Extract detailed error message
        let errorMessage = paypalOrder.message || paypalOrder.name || 'Unknown error';
        if (errorDetails.length > 0) {
          const detailMessages = errorDetails.map((d: any) => {
            const field = d.field || '';
            const issue = d.issue || d.description || '';
            const location = d.location || '';
            return `${field}${location ? ` (${location})` : ''}: ${issue}`;
          }).filter(Boolean);
          if (detailMessages.length > 0) {
            errorMessage += ` - ${detailMessages.join('; ')}`;
          }
        }
        
        // Check if it's a currency issue
        const currencyIssue = errorDetails.find((d: any) => 
          d.field?.toLowerCase().includes('currency') || 
          d.issue?.toLowerCase().includes('currency') ||
          d.description?.toLowerCase().includes('currency')
        );
        
        if (currencyIssue) {
          errorMessage += ' - Note: SAR currency might not be supported by your PayPal account. Try using USD for testing.';
        }
        
        throw new Error(`PayPal API error: ${errorMessage}. Status: ${paypalOrderResponse.status}. Debug ID: ${paypalOrder.debug_id || 'N/A'}`);
      }
      
      if (paypalOrder.id) {
        // Verify PayPal order ID format (should be a string, not UUID)
        if (typeof paypalOrder.id !== 'string' || paypalOrder.id.length < 10) {
          console.error('Invalid PayPal order ID format:', paypalOrder.id);
          throw new Error('Invalid PayPal order ID format received');
        }

        // Update our order with PayPal order ID
        await supabaseAdmin
          .from('orders')
          .update({ payment_id: paypalOrder.id })
          .eq('id', order.id);

        return NextResponse.json({
          orderId: paypalOrder.id, // Return PayPal order ID for SDK
          dbOrderId: order.id, // Also return our database order ID
          success: true,
        });
      } else {
        console.error('PayPal order response missing ID:', paypalOrder);
        throw new Error('Failed to create PayPal order: No order ID in response');
      }
    } catch (paypalError: any) {
      console.error('Error creating PayPal order:', {
        error: paypalError.message,
        stack: paypalError.stack,
        orderId: order.id,
      });
      // Do NOT return database order ID as fallback - PayPal SDK won't accept it
      // Instead, throw the error so the client can handle it properly
      return NextResponse.json(
        { 
          error: `فشل في إنشاء طلب PayPal: ${paypalError.message || 'خطأ غير معروف'}. يرجى التحقق من إعدادات PayPal.`,
          details: process.env.NODE_ENV === 'development' ? paypalError.message : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

