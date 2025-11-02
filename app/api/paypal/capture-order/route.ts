import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendNewOrderEmail, sendApprovalEmail } from '@/utils/sendEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * PayPal Order Capture API
 * Captures payment after user approves on PayPal
 * Automatically creates order, assigns subscription, and sends emails
 * 
 * Required Environment Variables:
 * - PAYPAL_CLIENT_ID
 * - PAYPAL_CLIENT_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, orderDetails } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get PayPal credentials
    const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const paypalMode = process.env.PAYPAL_MODE || 'sandbox';
    const paypalBaseUrl = paypalMode === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    console.log('PayPal Capture Config:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      mode: paypalMode,
      baseUrl: paypalBaseUrl,
      orderId,
    });

    if (!clientId || !clientSecret) {
      console.error('PayPal credentials not configured for capture');
      return NextResponse.json(
        { 
          error: 'Payment service not configured',
          details: !clientId ? 'PAYPAL_CLIENT_ID is missing' : 'PAYPAL_CLIENT_SECRET is missing'
        },
        { status: 500 }
      );
    }

    // Get PayPal access token
    const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      let errorData;
      try {
        errorData = await tokenResponse.json();
      } catch {
        errorData = { message: 'Unknown error', status: tokenResponse.status };
      }
      console.error('PayPal token error during capture:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorData,
      });
      return NextResponse.json(
        { 
          error: 'Failed to authenticate with PayPal',
          details: errorData.error_description || errorData.message || 'Check your PayPal credentials',
          status: tokenResponse.status
        },
        { status: 500 }
      );
    }

    const { access_token } = await tokenResponse.json();

    // Capture the order
    const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!captureResponse.ok) {
      let errorData;
      try {
        errorData = await captureResponse.json();
      } catch {
        errorData = { message: 'Unknown error', status: captureResponse.status };
      }
      console.error('PayPal capture error:', {
        status: captureResponse.status,
        statusText: captureResponse.statusText,
        error: errorData,
      });
      return NextResponse.json(
        { 
          error: 'Failed to capture payment',
          details: errorData.message || errorData.details || JSON.stringify(errorData),
          status: captureResponse.status
        },
        { status: 500 }
      );
    }

    const captureData = await captureResponse.json();

    // If payment is not completed, return without creating order
    if (captureData.status !== 'COMPLETED') {
      return NextResponse.json({
        success: false,
        capture: captureData,
        error: 'Payment was not completed',
      });
    }

    // If order details provided, create order and auto-assign subscription
    if (orderDetails) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Create order with paid status
        const { data: order, error: orderError } = await supabaseAdmin
          .from('orders')
          .insert({
            name: orderDetails.name,
            email: orderDetails.email,
            whatsapp: orderDetails.whatsapp || null,
            product_name: orderDetails.product_name,
            product_code: orderDetails.product_code || null,
            price: parseFloat(orderDetails.price),
            status: 'paid', // Set status to paid immediately
            payment_method: 'paypal',
            payment_id: captureData.id,
            payment_status: 'COMPLETED',
          })
          .select()
          .single();

        if (orderError || !order) {
          console.error('Failed to create order:', orderError);
          return NextResponse.json({
            success: true,
            capture: captureData,
            warning: 'Payment successful but order creation failed',
            error: orderError?.message || 'Database error',
          });
        }

        // Automatically assign subscription (no admin approval needed for PayPal)
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
            // Keep status as 'paid' (don't change to approved since no subscription assigned)

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
              capture: captureData,
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

          // Send email to admin about new PayPal order
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
            capture: captureData,
            order: updatedOrder,
            subscription: assignedSubscription,
          });
        } catch (assignErr: any) {
          console.error('Error in subscription assignment:', assignErr);
          
          // Still return success with order
          return NextResponse.json({
            success: true,
            capture: captureData,
            order: order,
            warning: 'Subscription assignment encountered an error',
          });
        }
      } catch (dbError: any) {
        console.error('Failed to create order in database:', dbError);
        // Still return success since payment was captured
        return NextResponse.json({
          success: true,
          capture: captureData,
          warning: 'Payment successful but order creation failed',
          error: dbError.message || 'Database error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      capture: captureData,
    });
  } catch (error: any) {
    console.error('PayPal capture error:', error);
    return NextResponse.json(
      { error: 'Failed to capture payment', message: error.message },
      { status: 500 }
    );
  }
}

