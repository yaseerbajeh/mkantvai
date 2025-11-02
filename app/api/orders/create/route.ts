import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendNewOrderEmail } from '@/utils/sendEmail';
import { rateLimit, orderLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  // Apply rate limiting (strict for order creation)
  const rateLimitResult = await rateLimit(request, orderLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const body = await request.json();
    const { 
      name, 
      whatsapp, 
      email, 
      product_name, 
      product_code, 
      price,
      payment_method,
      payment_id,
      payment_status
    } = body;

    // Validate required fields
    if (!name || !email || !product_name || price === undefined || !whatsapp) {
      return NextResponse.json(
        { error: 'يرجى ملء جميع الحقول المطلوبة (بما في ذلك رقم الواتساب)' },
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

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Determine order status based on payment
    let orderStatus = 'pending';
    if (payment_status === 'paid' || payment_status === 'COMPLETED') {
      orderStatus = 'paid';
    }

    // Insert order with payment information if available
    const orderData: any = {
      name,
      whatsapp: whatsapp || null,
      email,
      product_name,
      product_code: product_code || null,
      price: parseFloat(price),
      status: orderStatus,
    };

    // Add payment information if provided
    if (payment_method) {
      orderData.payment_method = payment_method;
    }
    if (payment_id) {
      orderData.payment_id = payment_id;
    }
    if (payment_status) {
      orderData.payment_status = payment_status;
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: error.message || 'حدث خطأ أثناء إنشاء الطلب. يرجى المحاولة مرة أخرى.' },
        { status: 500 }
      );
    }

    // Send email notification to admin (non-blocking)
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
    } catch (emailError) {
      console.error('Error sending new order email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      { 
        success: true,
        order: {
          id: order.id,
          order_number: (order as any).order_number || null,
          name: order.name,
          email: order.email,
          product_name: order.product_name,
          price: order.price,
          status: order.status,
          created_at: order.created_at,
        }
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

