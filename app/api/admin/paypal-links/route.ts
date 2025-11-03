import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// GET - List all PayPal payment links
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم: مفاتيح قاعدة البيانات غير متوفرة' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول كمسؤول.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('product_code');
    const environment = searchParams.get('environment');

    let query = supabaseAdmin
      .from('paypal_payment_links')
      .select('*')
      .order('created_at', { ascending: false });

    if (productCode) {
      query = query.eq('product_code', productCode);
    }
    if (environment) {
      query = query.eq('environment', environment);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching PayPal payment links:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في جلب روابط PayPal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentLinks: data || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Create or update PayPal payment link
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم: مفاتيح قاعدة البيانات غير متوفرة' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول كمسؤول.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { product_code, payment_link_id, environment } = body;

    if (!product_code || !payment_link_id || !environment) {
      return NextResponse.json(
        { error: 'يرجى إدخال جميع الحقول المطلوبة: product_code, payment_link_id, environment' },
        { status: 400 }
      );
    }

    if (environment !== 'sandbox' && environment !== 'live') {
      return NextResponse.json(
        { error: 'environment يجب أن يكون "sandbox" أو "live"' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert (insert or update) payment link
    const { data, error } = await supabaseAdmin
      .from('paypal_payment_links')
      .upsert(
        {
          product_code,
          payment_link_id,
          environment,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'product_code',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error upserting PayPal payment link:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في حفظ رابط PayPal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ paymentLink: data, success: true });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Remove PayPal payment link
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم: مفاتيح قاعدة البيانات غير متوفرة' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول كمسؤول.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('product_code');

    if (!productCode) {
      return NextResponse.json(
        { error: 'product_code مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabaseAdmin
      .from('paypal_payment_links')
      .delete()
      .eq('product_code', productCode);

    if (error) {
      console.error('Error deleting PayPal payment link:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في حذف رابط PayPal' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'تم حذف رابط PayPal بنجاح' });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

