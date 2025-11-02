import { NextRequest, NextResponse } from 'next/server';

/**
 * PayPal Order Capture API
 * Captures payment after user approves on PayPal
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

    // If order details provided, create order in database
    if (orderDetails) {
      try {
        const orderResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/orders/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: orderDetails.name,
            email: orderDetails.email,
            whatsapp: orderDetails.whatsapp,
            product_name: orderDetails.product_name,
            product_code: orderDetails.product_code,
            price: orderDetails.price,
            payment_method: 'paypal',
            payment_id: captureData.id,
            payment_status: captureData.status === 'COMPLETED' ? 'COMPLETED' : 'pending',
          }),
        });

        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          return NextResponse.json({
            success: true,
            capture: captureData,
            order: orderData.order,
          });
        } else {
          let errorData;
          try {
            errorData = await orderResponse.json();
          } catch {
            errorData = { error: 'Unknown error' };
          }
          console.error('Failed to create order in database:', errorData);
          // Still return success since payment was captured, but log the error
          return NextResponse.json({
            success: true,
            capture: captureData,
            warning: 'Payment successful but order creation failed',
            error: errorData.error || 'Unknown error',
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

