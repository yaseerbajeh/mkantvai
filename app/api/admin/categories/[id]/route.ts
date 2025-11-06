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

  const adminEmails = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

// PUT - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting for admin endpoints
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
    const {
      name,
      name_en,
      description,
      display_order,
      is_active,
    } = body;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if category exists
    const { data: existingCategory, error: fetchError } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingCategory) {
      return NextResponse.json(
        { error: 'التصنيف غير موجود' },
        { status: 404 }
      );
    }

    // If name is being updated, check for duplicates (excluding current category)
    if (name !== undefined && name.trim() !== existingCategory.name) {
      const { data: duplicateCategory } = await supabaseAdmin
        .from('categories')
        .select('id')
        .ilike('name', name.trim())
        .eq('is_active', true)
        .neq('id', params.id)
        .maybeSingle();

      if (duplicateCategory) {
        return NextResponse.json(
          { error: 'يوجد تصنيف بنفس الاسم بالفعل' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (name_en !== undefined) updateData.name_en = name_en?.trim() || null;
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (display_order !== undefined) updateData.display_order = parseInt(display_order);
    if (is_active !== undefined) updateData.is_active = is_active;

    // Update category
    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في تحديث التصنيف' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, category: data });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting for admin endpoints
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

    // Check if category exists
    const { data: category, error: fetchError } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .eq('id', params.id)
      .single();

    if (fetchError || !category) {
      return NextResponse.json(
        { error: 'التصنيف غير موجود' },
        { status: 404 }
      );
    }

    // Critical: Check if any products use this category
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .eq('category_id', params.id)
      .limit(1);

    if (productsError) {
      console.error('Error checking products:', productsError);
      return NextResponse.json(
        { error: 'فشل في التحقق من المنتجات المرتبطة' },
        { status: 500 }
      );
    }

    if (products && products.length > 0) {
      return NextResponse.json(
        { error: 'لا يمكن حذف التصنيف لأنه مستخدم في منتجات. يرجى نقل المنتجات إلى تصنيف آخر أولاً.' },
        { status: 400 }
      );
    }

    // Safe to delete - no products use this category
    const { error: deleteError } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('Error deleting category:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'فشل في حذف التصنيف' },
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

