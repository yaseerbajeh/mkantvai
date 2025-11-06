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

// GET - List all promo codes
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
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching promo codes:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في جلب رموز الخصم' },
        { status: 500 }
      );
    }

    // Calculate effective status based on expiry date
    const now = new Date();
    const promoCodesWithEffectiveStatus = (data || []).map((code: any) => {
      const isExpired = code.valid_until && new Date(code.valid_until) < now;
      const isNotYetValid = code.valid_from && new Date(code.valid_from) > now;
      
      // Effective status: active only if is_active is true AND not expired AND valid from date has passed
      const effectiveIsActive = code.is_active && !isExpired && !isNotYetValid;
      
      return {
        ...code,
        effective_is_active: effectiveIsActive,
        is_expired: isExpired,
        is_not_yet_valid: isNotYetValid,
      };
    });

    return NextResponse.json({ promoCodes: promoCodesWithEffectiveStatus });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Create new promo code
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate required fields
    if (!body.code || !body.discount_type || !body.discount_value) {
      return NextResponse.json(
        { error: 'الرمز ونوع الخصم وقيمة الخصم مطلوبة' },
        { status: 400 }
      );
    }

    // Validate discount_type
    if (!['percentage', 'fixed'].includes(body.discount_type)) {
      return NextResponse.json(
        { error: 'نوع الخصم يجب أن يكون percentage أو fixed' },
        { status: 400 }
      );
    }

    // Validate discount_value
    if (parseFloat(body.discount_value) <= 0) {
      return NextResponse.json(
        { error: 'قيمة الخصم يجب أن تكون أكبر من صفر' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .insert({
        ...body,
        code: body.code.toUpperCase().trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating promo code:', error);
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'رمز الخصم موجود بالفعل' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'فشل في إنشاء رمز الخصم' },
        { status: 500 }
      );
    }

    return NextResponse.json({ promoCode: data });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// PUT - Update existing promo code
export async function PUT(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'معرف رمز الخصم مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate discount_type if provided
    if (updates.discount_type && !['percentage', 'fixed'].includes(updates.discount_type)) {
      return NextResponse.json(
        { error: 'نوع الخصم يجب أن يكون percentage أو fixed' },
        { status: 400 }
      );
    }

    // Validate discount_value if provided
    if (updates.discount_value && parseFloat(updates.discount_value) <= 0) {
      return NextResponse.json(
        { error: 'قيمة الخصم يجب أن تكون أكبر من صفر' },
        { status: 400 }
      );
    }

    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.code) {
      updateData.code = updates.code.toUpperCase().trim();
    }

    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating promo code:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'رمز الخصم موجود بالفعل' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'فشل في تحديث رمز الخصم' },
        { status: 500 }
      );
    }

    return NextResponse.json({ promoCode: data });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Delete promo code
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم' },
        { status: 500 }
      );
    }

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
        { error: 'معرف رمز الخصم مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if promo code is used in any orders
    const { data: ordersUsingPromo, error: checkError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('promo_code_id', id)
      .limit(1);

    if (checkError) {
      console.error('Error checking orders:', checkError);
      return NextResponse.json(
        { error: 'فشل في التحقق من استخدام رمز الخصم' },
        { status: 500 }
      );
    }

    if (ordersUsingPromo && ordersUsingPromo.length > 0) {
      // Cannot delete - promo code is used in orders
      // Instead, deactivate it
      const { data: updatedCode, error: updateError } = await supabaseAdmin
        .from('promo_codes')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error deactivating promo code:', updateError);
        return NextResponse.json(
          { error: 'فشل في تعطيل رمز الخصم' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'تم تعطيل رمز الخصم بدلاً من حذفه لأنه مستخدم في طلبات',
        deactivated: true,
        promoCode: updatedCode,
      });
    }

    // Safe to delete - no orders use this promo code
    const { error } = await supabaseAdmin
      .from('promo_codes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting promo code:', error);
      // Check if it's a foreign key constraint error
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'لا يمكن حذف رمز الخصم لأنه مستخدم في طلبات. تم تعطيله بدلاً من ذلك.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'فشل في حذف رمز الخصم' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

