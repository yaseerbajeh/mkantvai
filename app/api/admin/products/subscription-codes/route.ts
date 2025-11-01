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

// GET - Get subscription codes grouped by product_code
export async function GET(request: NextRequest) {
  // Apply rate limiting for admin endpoints
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('product_code');

    let query = supabaseAdmin
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching subscription codes:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في جلب رموز الاشتراكات' },
        { status: 500 }
      );
    }

    // Group by product_code and count
    const grouped: { [key: string]: any[] } = {};
    const counts: { [key: string]: number } = {};

    data.forEach((sub: any) => {
      const code = sub.product_code || 'UNASSIGNED';
      if (!grouped[code]) {
        grouped[code] = [];
        counts[code] = 0;
      }
      grouped[code].push(sub);
      counts[code]++;
    });

    return NextResponse.json({
      subscriptionCodes: data || [],
      grouped,
      counts,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Add subscription codes in bulk
export async function POST(request: NextRequest) {
  // Apply rate limiting for admin endpoints
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
    const { product_code, codes, subscription_meta } = body;

    if (!product_code) {
      return NextResponse.json(
        { error: 'product_code مطلوب' },
        { status: 400 }
      );
    }

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { error: 'يجب إدخال رموز اشتراك واحدة على الأقل' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Prepare insert data
    const insertData = codes.map((code: string) => ({
      subscription_code: code.trim(),
      product_code,
      subscription_meta: subscription_meta || {},
    }));

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert(insertData)
      .select();

    if (error) {
      console.error('Error adding subscription codes:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في إضافة رموز الاشتراكات' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      added: data.length,
      subscriptionCodes: data,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}


