import { NextRequest, NextResponse } from 'next/server';

/**
 * PayPal Order Creation API
 * Creates a PayPal order on the server side
 * 
 * Required Environment Variables:
 * - PAYPAL_CLIENT_ID (public, can be exposed)
 * - PAYPAL_CLIENT_SECRET (private, server-side only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productCode, productName, price, currency = 'SAR' } = body;

    // Validate required fields
    if (!productCode || !productName || price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: productCode, productName, price' },
        { status: 400 }
      );
    }

    // Get PayPal credentials from environment variables
    // Server-side routes need PAYPAL_CLIENT_ID (not NEXT_PUBLIC_PAYPAL_CLIENT_ID)
    const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const paypalMode = process.env.PAYPAL_MODE || 'sandbox';
    const paypalBaseUrl = paypalMode === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    console.log('PayPal Config:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      mode: paypalMode,
      baseUrl: paypalBaseUrl,
    });

    if (!clientId || !clientSecret) {
      console.error('PayPal credentials not configured:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
      });
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
      console.error('PayPal token error:', {
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

    // Create PayPal order
    const orderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
        'PayPal-Request-Id': `${productCode}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: productCode,
            description: productName,
            amount: {
              currency_code: currency,
              value: price.toString(),
            },
          },
        ],
        application_context: {
          brand_name: 'مكان TV',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/order-success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/order-cancelled`,
        },
      }),
    });

    if (!orderResponse.ok) {
      let errorData;
      try {
        errorData = await orderResponse.json();
      } catch {
        errorData = { message: 'Unknown error', status: orderResponse.status };
      }
      console.error('PayPal order creation error:', {
        status: orderResponse.status,
        statusText: orderResponse.statusText,
        error: errorData,
      });
      return NextResponse.json(
        { 
          error: 'Failed to create PayPal order',
          details: errorData.message || errorData.details || JSON.stringify(errorData),
          status: orderResponse.status
        },
        { status: 500 }
      );
    }

    const orderData = await orderResponse.json();

    return NextResponse.json({
      orderId: orderData.id,
      status: orderData.status,
    });
  } catch (error: any) {
    console.error('PayPal order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create order', message: error.message },
      { status: 500 }
    );
  }
}

