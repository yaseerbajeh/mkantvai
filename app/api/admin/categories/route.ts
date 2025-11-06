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

// GET - List all categories
export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('is_active');

    let query = supabaseAdmin
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في جلب التصنيفات' },
        { status: 500 }
      );
    }

    return NextResponse.json({ categories: data || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Create new category
export async function POST(request: NextRequest) {
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

    // Validation
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'اسم التصنيف مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check for duplicate name (case-insensitive, only active categories)
    const { data: existingCategory } = await supabaseAdmin
      .from('categories')
      .select('id')
      .ilike('name', name.trim())
      .eq('is_active', true)
      .maybeSingle();

    if (existingCategory) {
      return NextResponse.json(
        { error: 'يوجد تصنيف بنفس الاسم بالفعل' },
        { status: 400 }
      );
    }

    // Create category
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name: name.trim(),
        name_en: name_en?.trim() || null,
        description: description?.trim() || null,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في إنشاء التصنيف' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, category: data },
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

