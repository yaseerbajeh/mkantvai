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
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const paypalBaseUrl = process.env.PAYPAL_MODE === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    if (!clientId || !clientSecret) {
      console.error('PayPal credentials not configured');
      return NextResponse.json(
        { error: 'Payment service not configured' },
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
      const errorData = await tokenResponse.json();
      console.error('PayPal token error:', errorData);
      return NextResponse.json(
        { error: 'Failed to authenticate with PayPal' },
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
      const errorData = await orderResponse.json();
      console.error('PayPal order creation error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create PayPal order', details: errorData },
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

