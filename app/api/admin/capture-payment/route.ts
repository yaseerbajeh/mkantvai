import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول كمسؤول.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'رقم الطلب مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get order from database
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'الطلب غير موجود' },
        { status: 404 }
      );
    }

    // Check if order already paid
    if (order.status === 'paid') {
      return NextResponse.json(
        { 
          error: 'الطلب مدفوع بالفعل',
          order,
          warning: 'لا حاجة لمعالجة الدفع مرة أخرى',
        },
        { status: 400 }
      );
    }

    // Get PayPal order ID
    const paypalOrderId = order.payment_id;
    if (!paypalOrderId) {
      return NextResponse.json(
        { error: 'لا يوجد معرف PayPal للطلب. لا يمكن معالجة الدفع.' },
        { status: 400 }
      );
    }

    // Capture payment from PayPal
    const paypalMode = process.env.PAYPAL_MODE || 'sandbox';
    const paypalBaseUrl = paypalMode === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!paypalClientId || !paypalSecret) {
      return NextResponse.json(
        { error: 'إعدادات PayPal غير متوفرة' },
        { status: 500 }
      );
    }

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
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('Failed to get PayPal access token:', tokenData);
      return NextResponse.json(
        { error: 'فشل في الاتصال بـ PayPal', details: tokenData },
        { status: 500 }
      );
    }

    // Capture the payment
    console.log(`Attempting to capture PayPal order: ${paypalOrderId}`);
    const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Prefer': 'return=representation',
      },
    });

    const captureResult = await captureResponse.json();

    if (!captureResponse.ok || captureResult.status !== 'COMPLETED') {
      console.error('PayPal capture failed:', {
        status: captureResponse.status,
        statusText: captureResponse.statusText,
        response: captureResult,
        paypalOrderId,
      });

      // Check if authorization has expired
      if (captureResult.name === 'UNPROCESSABLE_ENTITY' || captureResult.status === 'EXPIRED') {
        return NextResponse.json(
          { 
            error: 'انتهت صلاحية التفويض. لا يمكن استلام الدفع الآن. المبلغ سيعود للعميل تلقائياً.',
            details: captureResult.message || 'Authorization expired',
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { 
          error: `فشل في معالجة الدفع: ${captureResult.message || 'خطأ غير معروف'}`,
          details: process.env.NODE_ENV === 'development' ? captureResult : undefined,
        },
        { status: 500 }
      );
    }

    // Verify capture was successful
    const purchaseUnit = captureResult.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    
    if (!capture || capture.status !== 'COMPLETED') {
      console.error('Payment capture not completed:', captureResult);
      return NextResponse.json(
        { 
          error: 'فشل في معالجة الدفع - لم يتم استلام الأموال',
          details: captureResult,
        },
        { status: 500 }
      );
    }

    console.log('PayPal payment successfully captured:', {
      captureId: capture.id,
      amount: capture.amount,
      status: capture.status,
      paypalOrderId,
    });

    // Update order status
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'paid',
        payment_status: 'COMPLETED',
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      // Payment was captured but database update failed - this is critical
      return NextResponse.json(
        { 
          error: 'تم استلام الدفع من PayPal ولكن فشل تحديث حالة الطلب في قاعدة البيانات',
          warning: 'يرجى تحديث حالة الطلب يدوياً',
          captureId: capture.id,
          amount: capture.amount,
          details: updateError,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم استلام الدفع بنجاح',
      captureId: capture.id,
      amount: capture.amount,
      orderId: order_id,
      paypalOrderId: paypalOrderId,
    });

  } catch (error: any) {
    console.error('Error capturing payment:', error);
    return NextResponse.json(
      { 
        error: 'حدث خطأ غير متوقع',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
