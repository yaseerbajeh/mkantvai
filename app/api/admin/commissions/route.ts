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

  const adminEmails = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

// Generate unique promo code
function generatePromoCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'COMM-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET - List all commissioners with stats
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get all commissioners with their stats
    const { data: commissioners, error } = await supabaseAdmin
      .from('commissioners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commissioners:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب البيانات' },
        { status: 500 }
      );
    }

    // Calculate summary stats
    const totalWorkers = commissioners?.length || 0;
    const avgCommissionRate = commissioners && commissioners.length > 0
      ? commissioners.reduce((sum, c) => sum + parseFloat(c.commission_rate as any), 0) / commissioners.length * 100
      : 0;
    const pendingPayouts = commissioners?.reduce((sum, c) => sum + parseFloat(c.pending_payouts as any || 0), 0) || 0;

    return NextResponse.json({
      commissioners: commissioners || [],
      stats: {
        totalWorkers,
        avgCommissionRate: Math.round(avgCommissionRate * 100) / 100,
        pendingPayouts: Math.round(pendingPayouts * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/commissions:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Create new commissioner
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, commission_rate, name, promo_code } = body;

    if (!email || !commission_rate) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني ومعدل العمولة مطلوبان' },
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

    // Validate commission rate (should be between 0 and 100, convert to decimal)
    const rate = parseFloat(commission_rate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return NextResponse.json(
        { error: 'معدل العمولة يجب أن يكون بين 0 و 100' },
        { status: 400 }
      );
    }

    // Convert percentage to decimal (e.g., 10 -> 0.10)
    const commissionRateDecimal = rate / 100;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('commissioners')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني مستخدم بالفعل' },
        { status: 400 }
      );
    }

    // Use custom promo code or generate one
    let promoCode = promo_code?.trim().toUpperCase() || '';
    
    if (!promoCode) {
      // Generate unique promo code if not provided
      promoCode = generatePromoCode();
      let attempts = 0;
      while (attempts < 10) {
        const { data: existingCode } = await supabaseAdmin
          .from('commissioners')
          .select('id')
          .eq('promo_code', promoCode)
          .single();

        if (!existingCode) {
          break;
        }
        promoCode = generatePromoCode();
        attempts++;
      }

      if (attempts >= 10) {
        return NextResponse.json(
          { error: 'فشل إنشاء رمز ترويجي فريد' },
          { status: 500 }
        );
      }
    } else {
      // Validate custom promo code is unique
      const { data: existingCode } = await supabaseAdmin
        .from('commissioners')
        .select('id')
        .eq('promo_code', promoCode)
        .single();

      if (existingCode) {
        return NextResponse.json(
          { error: 'الرمز الترويجي مستخدم بالفعل' },
          { status: 400 }
        );
      }
    }

    // Create commissioner
    const { data: commissioner, error } = await supabaseAdmin
      .from('commissioners')
      .insert({
        email: email.trim(),
        name: name?.trim() || null,
        promo_code: promoCode,
        commission_rate: commissionRateDecimal,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating commissioner:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء إنشاء المفوض' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      commissioner,
      message: 'تم إنشاء المفوض بنجاح',
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/commissions:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// PUT - Update commissioner
export async function PUT(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, email, commission_rate, name, is_active, promo_code } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'معرف المفوض مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const updateData: any = {};
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'البريد الإلكتروني غير صحيح' },
          { status: 400 }
        );
      }
      updateData.email = email.trim();
    }
    if (name !== undefined) {
      updateData.name = name?.trim() || null;
    }
    if (commission_rate !== undefined) {
      const rate = parseFloat(commission_rate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return NextResponse.json(
          { error: 'معدل العمولة يجب أن يكون بين 0 و 100' },
          { status: 400 }
        );
      }
      updateData.commission_rate = rate / 100;
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }
    if (promo_code !== undefined) {
      const code = promo_code.trim().toUpperCase();
      if (!code) {
        return NextResponse.json(
          { error: 'الرمز الترويجي مطلوب' },
          { status: 400 }
        );
      }
      
      // Check if promo code is already used by another commissioner
      const { data: existingCode } = await supabaseAdmin
        .from('commissioners')
        .select('id')
        .eq('promo_code', code)
        .neq('id', id)
        .single();

      if (existingCode) {
        return NextResponse.json(
          { error: 'الرمز الترويجي مستخدم بالفعل' },
          { status: 400 }
        );
      }
      
      updateData.promo_code = code;
    }

    const { data: commissioner, error } = await supabaseAdmin
      .from('commissioners')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating commissioner:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء تحديث المفوض' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      commissioner,
      message: 'تم تحديث المفوض بنجاح',
    });
  } catch (error: any) {
    console.error('Error in PUT /api/admin/commissions:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate commissioner
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'معرف المفوض مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Soft delete by setting is_active to false
    const { data: commissioner, error } = await supabaseAdmin
      .from('commissioners')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deactivating commissioner:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء إلغاء تفعيل المفوض' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      commissioner,
      message: 'تم إلغاء تفعيل المفوض بنجاح',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/commissions:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

