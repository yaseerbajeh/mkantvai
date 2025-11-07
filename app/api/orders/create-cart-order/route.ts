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

    // Check if this is a 100% discount order (free order) before creating
    const isFreeOrder = totalAmount === 0 || totalAmount <= 0.01;
    
    // Calculate original subtotal before discount for order price
    const originalSubtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        name: customerInfo.name,
        email: customerInfo.email,
        whatsapp: customerInfo.whatsapp || null,
        product_name: productName,
        product_code: items[0].product_code, // Primary product code for compatibility
        price: originalSubtotal, // Store original price before discount
        total_amount: totalAmount, // Store final amount after discount (can be 0 for 100% discount)
        discount_amount: discountAmount || 0,
        promo_code_id: promoCodeId || null,
        status: isFreeOrder ? 'paid' : 'pending', // Set to 'paid' immediately for free orders
        payment_method: isFreeOrder ? 'promo_code_100' : 'paypal_cart',
        payment_status: isFreeOrder ? 'COMPLETED' : 'PENDING',
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
    if (isFreeOrder) {
      console.log('🎁 Processing 100% discount order (free order)');
      console.log('Order details:', {
        orderId: order.id,
        customerEmail: order.email,
        productName: order.product_name,
        totalAmount,
        originalSubtotal,
        discountAmount,
        promoCodeId,
        itemsCount: orderItems.length,
        orderStatus: order.status,
        paymentMethod: order.payment_method,
      });

      // Order is already set to 'paid' status and 'promo_code_100' payment_method during creation
      // But we should verify it's correct
      if (order.status !== 'paid' || order.payment_method !== 'promo_code_100') {
        console.warn('⚠ Order status or payment_method not set correctly, updating...');
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
          console.error('✗ Error updating order status to paid:', updateError);
          return NextResponse.json(
            { error: 'فشل تحديث حالة الطلب' },
            { status: 500 }
          );
        }

        console.log('✓ Order status updated to paid:', {
          orderId: updatedOrder?.id,
          status: updatedOrder?.status,
          payment_method: updatedOrder?.payment_method,
        });
      } else {
        console.log('✓ Order already has correct status (paid) and payment_method (promo_code_100)');
      }

      // Assign subscriptions for each item
      // For cart orders, we need to update the order's product_code for each item
      // so that assign_subscription_to_order can find the correct subscription
      const assignedSubscriptions: any[] = [];
      let hasSubscriptionAssignmentErrors = false;

      for (const item of orderItems) {
        for (let i = 0; i < item.quantity; i++) {
          try {
            // Update order's product_code to match current item before calling assign_subscription_to_order
            // This ensures the function finds subscriptions for the correct product
            await supabaseAdmin
              .from('orders')
              .update({ product_code: item.product_code })
              .eq('id', order.id);

            console.log(`🔄 Temporarily setting order product_code to ${item.product_code} for subscription assignment`);

            // Now assign subscription - it will use the updated product_code
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
              console.log(`✓ Successfully assigned subscription for ${item.product_code}:`, assigned.code);
            } else if (assignError) {
              console.error(`✗ Error assigning subscription for ${item.product_code}:`, assignError);
              hasSubscriptionAssignmentErrors = true;
              // Continue processing other items even if one fails
            }
          } catch (err: any) {
            console.error(`✗ Exception assigning subscription for ${item.product_code}:`, err);
            hasSubscriptionAssignmentErrors = true;
          }
        }
      }

      // Restore order's product_code to first item (for compatibility)
      // Update order status back to 'paid' (assign_subscription_to_order sets it to 'approved')
      // Also ensure assigned_subscription is properly set
      const updateData: any = {
        status: 'paid',
        payment_status: 'COMPLETED',
        payment_method: 'promo_code_100',
        product_code: items[0].product_code, // Restore to first item's product_code
      };

      if (assignedSubscriptions.length > 0) {
        const firstSubscription = assignedSubscriptions[0].subscription;
        updateData.assigned_subscription = firstSubscription;
        console.log('✓ Setting assigned_subscription on order:', firstSubscription.code);
      } else {
        console.warn('⚠ No subscriptions were assigned, but order will still be created as paid');
      }

      const { error: updateStatusError } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (updateStatusError) {
        console.error('✗ Error updating order status:', updateStatusError);
        // Continue anyway - order is already created
      } else {
        console.log('✓ Order status updated to paid with payment_method: promo_code_100');
      }

      // Create active subscriptions for each assigned subscription
      for (const assignedSub of assignedSubscriptions) {
        try {
          // Call auto_create_subscription_from_order function
          // Pass null for p_subscription_type to let the function determine it from product category
          // First, temporarily set status to 'approved' for the function to work
          await supabaseAdmin
            .from('orders')
            .update({ status: 'approved' })
            .eq('id', order.id);

          const { data: subscriptionId, error: createSubError } = await supabaseAdmin.rpc(
            'auto_create_subscription_from_order',
            {
              p_order_id: order.id,
              p_subscription_type: null, // Let function determine from product category
            }
          );

          // Set status back to 'paid'
          await supabaseAdmin
            .from('orders')
            .update({ status: 'paid' })
            .eq('id', order.id);

          if (createSubError) {
            console.error('Error creating active subscription:', createSubError);
            // Try manual insert as fallback
            try {
              const { data: product } = await supabaseAdmin
                .from('products')
                .select('duration')
                .eq('product_code', assignedSub.product_code)
                .single();

              const durationText = product?.duration || assignedSub.subscription.meta?.duration || '1 شهر';
              const startDate = new Date(order.created_at);
              const expirationDate = new Date(startDate);
              
              // Parse duration to days (simplified - you may need to use parseDurationToDays utility)
              const durationMatch = durationText.match(/(\d+)/);
              const durationMonths = durationMatch ? parseInt(durationMatch[1]) : 1;
              expirationDate.setMonth(expirationDate.getMonth() + durationMonths);

              await supabaseAdmin
                .from('active_subscriptions')
                .insert({
                  order_id: order.id,
                  customer_name: order.name,
                  customer_email: order.email,
                  customer_phone: order.whatsapp || null,
                  subscription_code: assignedSub.subscription.code,
                  subscription_type: subscriptionType,
                  subscription_duration: durationText,
                  expiration_date: expirationDate.toISOString(),
                  start_date: startDate.toISOString(),
                  product_code: assignedSub.product_code || null,
                });
            } catch (manualInsertError) {
              console.error('Error in manual subscription insert fallback:', manualInsertError);
            }
          }
        } catch (err) {
          console.error('Error creating active subscription:', err);
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

      // Fetch final order with subscription to ensure we have the latest data
      const { data: finalOrder, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', order.id)
        .single();

      if (fetchError) {
        console.error('✗ Error fetching final order:', fetchError);
      } else {
        console.log('✓ Final order fetched:', {
          id: finalOrder?.id,
          status: finalOrder?.status,
          payment_method: finalOrder?.payment_method,
          has_subscription: !!finalOrder?.assigned_subscription,
        });
      }

      // Send emails - ensure emails are sent even if subscription assignment had errors
      const orderDisplayId = (finalOrder as any)?.order_number || order.id.slice(0, 8).toUpperCase();
      
      // Get subscription code from finalOrder or assignedSubscriptions
      const subscriptionCode = (finalOrder as any)?.assigned_subscription?.code || 
                               (assignedSubscriptions.length > 0 ? assignedSubscriptions[0].subscription.code : undefined);
      const subscriptionMeta = (finalOrder as any)?.assigned_subscription?.meta || 
                               (assignedSubscriptions.length > 0 ? assignedSubscriptions[0].subscription.meta : undefined);
      
      console.log('Email sending preparation:', {
        orderDisplayId,
        hasSubscriptionCode: !!subscriptionCode,
        subscriptionCode: subscriptionCode?.substring(0, 20) + '...',
        customerEmail: order.email,
      });

      // Send admin notification email (always send, even if no subscription)
      try {
        console.log('📧 Sending admin notification email...');
        await sendNewOrderEmail({
          orderId: orderDisplayId,
          name: order.name,
          email: order.email,
          whatsapp: order.whatsapp || undefined,
          productName: order.product_name,
          price: totalAmount || 0,
          createdAt: order.created_at,
        });
        console.log('✓ Admin notification email sent successfully');
      } catch (adminEmailError: any) {
        console.error('✗ Error sending admin notification email:', adminEmailError?.message || adminEmailError);
        // Don't fail the request if email fails, but log it
      }

      // Send customer approval email with subscription details (only if subscription exists)
      if (subscriptionCode) {
        try {
          console.log('📧 Sending customer approval email with subscription...');
          await sendApprovalEmail({
            orderId: orderDisplayId,
            name: order.name,
            email: order.email,
            subscriptionCode: subscriptionCode,
            subscriptionMeta: subscriptionMeta,
          });
          console.log('✓ Customer approval email sent successfully');
        } catch (customerEmailError: any) {
          console.error('✗ Error sending customer approval email:', customerEmailError?.message || customerEmailError);
          // Don't fail the request if email fails, but log it
        }
      } else {
        console.warn('⚠ No subscription code available - customer approval email not sent');
        // Still send a basic confirmation email if possible
        try {
          console.log('📧 Sending basic order confirmation email...');
          await sendNewOrderEmail({
            orderId: orderDisplayId,
            name: order.name,
            email: order.email,
            whatsapp: order.whatsapp || undefined,
            productName: order.product_name,
            price: totalAmount || 0,
            createdAt: order.created_at,
          });
          console.log('✓ Basic order confirmation email sent');
        } catch (basicEmailError: any) {
          console.error('✗ Error sending basic confirmation email:', basicEmailError?.message || basicEmailError);
        }
      }

      // Log final order status for debugging - verify order was created correctly
      const { data: verifyOrder } = await supabaseAdmin
        .from('orders')
        .select('id, status, payment_method, payment_status, assigned_subscription, order_number')
        .eq('id', order.id)
        .single();

      console.log('📦 Final order verification:', {
        orderId: verifyOrder?.id,
        orderNumber: verifyOrder?.order_number,
        status: verifyOrder?.status,
        payment_method: verifyOrder?.payment_method,
        payment_status: verifyOrder?.payment_status,
        has_assigned_subscription: !!verifyOrder?.assigned_subscription,
        subscription_code: verifyOrder?.assigned_subscription?.code,
      });

      if (!verifyOrder) {
        console.error('✗ CRITICAL: Order was not found in database after creation!');
      } else if (verifyOrder.status !== 'paid') {
        console.warn('⚠ WARNING: Order status is not "paid":', verifyOrder.status);
      } else if (verifyOrder.payment_method !== 'promo_code_100') {
        console.warn('⚠ WARNING: Order payment_method is not "promo_code_100":', verifyOrder.payment_method);
      } else {
        console.log('✓ Order verified: Status=paid, Payment Method=promo_code_100');
      }

      return NextResponse.json({
        orderId: order.id,
        dbOrderId: order.id,
        success: true,
        isFreeOrder: true,
        subscriptions: assignedSubscriptions,
        orderStatus: verifyOrder?.status,
        paymentMethod: verifyOrder?.payment_method,
        hasSubscription: !!verifyOrder?.assigned_subscription,
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
      
      const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
      const paypalSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();

      if (!paypalClientId || !paypalSecret) {
        console.error('PayPal credentials missing:', {
          hasClientId: !!paypalClientId,
          hasSecret: !!paypalSecret,
          mode: paypalMode,
        });
        // Return database order ID as fallback
        return NextResponse.json({
          orderId: order.id,
          success: true,
          warning: 'PayPal credentials not configured',
        });
      }

      // Validate credentials format (basic check)
      if (paypalClientId.length < 10 || paypalSecret.length < 10) {
        console.error('PayPal credentials appear to be invalid format:', {
          clientIdLength: paypalClientId.length,
          secretLength: paypalSecret.length,
          mode: paypalMode,
        });
        throw new Error(`PayPal credentials appear to be invalid. Please check your environment variables. Mode: ${paypalMode}`);
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
        console.error('PayPal authentication failed:', {
          error: tokenData.error,
          errorDescription: tokenData.error_description,
          mode: paypalMode,
          baseUrl: paypalBaseUrl,
          clientIdPrefix: paypalClientId.substring(0, 10) + '...',
          hasSecret: !!paypalSecret,
        });

        // Provide helpful error message
        if (tokenData.error === 'invalid_client') {
          throw new Error(
            `PayPal authentication failed: Client ID and Secret do not match or are incorrect. ` +
            `Please verify:\n` +
            `1. NEXT_PUBLIC_PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are from the same PayPal app\n` +
            `2. PAYPAL_MODE (${paypalMode}) matches your credentials (sandbox credentials need PAYPAL_MODE=sandbox, live credentials need PAYPAL_MODE=live)\n` +
            `3. Credentials are correct and not expired\n` +
            `4. No extra spaces or characters in environment variables`
          );
        }

        throw new Error(`Failed to get PayPal access token: ${tokenData.error || 'Unknown error'} - ${tokenData.error_description || ''}`);
      }

      // Create PayPal order
      // Use USD amount for PayPal (convert from SAR)
      const paypalAmount = totalAmountUsd || (totalAmount / 3.75); // Fallback to conversion if not provided
      let amountValue = parseFloat(paypalAmount.toFixed(2));
      
      // Validate amount
      if (isNaN(amountValue) || amountValue <= 0) {
        throw new Error(`Invalid amount: ${paypalAmount}`);
      }

      // PayPal requires minimum $0.01 USD
      if (amountValue < 0.01) {
        console.warn(`Amount ${amountValue} is too small, setting to minimum $0.01`);
        amountValue = 0.01;
      }

      // PayPal has maximum limits - check if amount exceeds reasonable limit
      if (amountValue > 100000) {
        throw new Error(`Amount ${amountValue} USD exceeds PayPal maximum limit`);
      }

      // Ensure amount has exactly 2 decimal places
      const formattedAmount = amountValue.toFixed(2);
      
      // Minimal payload with ABSOLUTELY NO database references
      // PayPal order creation should be completely independent of our database
      // No custom_id, no reference_id, no description, no application_context
      const paypalOrderPayload = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: formattedAmount,
          },
        }],
      };

      console.log('PayPal order payload (no DB references):', JSON.stringify(paypalOrderPayload, null, 2));

      // Create PayPal order with minimal headers - no PayPal-Request-Id or any DB references
      const paypalOrderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`,
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
          payload: paypalOrderPayload,
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
        
        // Check for specific common issues
        const currencyIssue = errorDetails.find((d: any) => 
          d.field?.toLowerCase().includes('currency') || 
          d.issue?.toLowerCase().includes('currency') ||
          d.description?.toLowerCase().includes('currency')
        );
        
        const amountIssue = errorDetails.find((d: any) => 
          d.field?.toLowerCase().includes('amount') || 
          d.field?.toLowerCase().includes('value') ||
          d.issue?.toLowerCase().includes('amount') ||
          d.issue?.toLowerCase().includes('minimum') ||
          d.issue?.toLowerCase().includes('maximum')
        );

        const businessIssue = errorDetails.find((d: any) => 
          d.issue?.toLowerCase().includes('business') ||
          d.issue?.toLowerCase().includes('account') ||
          d.issue?.toLowerCase().includes('restriction') ||
          d.issue?.toLowerCase().includes('verification')
        );
        
        // Provide helpful hints based on error type
        let helpfulHint = '';
        if (currencyIssue) {
          helpfulHint = ' - Note: Make sure your PayPal account supports USD currency.';
        } else if (amountIssue) {
          helpfulHint = ' - Note: Amount might be too small (minimum $0.01) or too large, or your account has limits.';
        } else if (businessIssue) {
          helpfulHint = ' - Note: Your PayPal account might have restrictions. Check your PayPal account status, verification level, and ensure your business account is properly set up.';
        } else if (paypalOrder.message?.toLowerCase().includes('semantically incorrect') || 
                   paypalOrder.message?.toLowerCase().includes('business validation')) {
          helpfulHint = ' - Note: This usually means your PayPal account has restrictions or the order structure is invalid. Check: 1) Account verification status, 2) Business account setup, 3) Currency support, 4) Account limits.';
        }
        
        throw new Error(`PayPal API error: ${errorMessage}${helpfulHint} Status: ${paypalOrderResponse.status}. Debug ID: ${paypalOrder.debug_id || 'N/A'}`);
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

