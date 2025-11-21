import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
}

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

// GET - List all products
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
    const categoryId = searchParams.get('category_id');
    const section = searchParams.get('section'); // Keep for backward compatibility
    const isActive = searchParams.get('is_active');

    let query = supabaseAdmin
      .from('products')
      .select(`
        *,
        categories (
          id,
          name,
          name_en,
          display_order,
          is_active
        )
      `)
      .order('category_id', { ascending: true })
      .order('display_order', { ascending: true });

    // Support both category_id (new) and section (backward compatibility)
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    } else if (section) {
      query = query.eq('section', parseInt(section));
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { 
          error: error.message || 'فشل في جلب المنتجات',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ products: data || [] });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { 
        error: 'حدث خطأ غير متوقع',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// POST - Create new product
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
      product_code,
      name,
      description,
      price,
      discounted_price,
      promo_banner_text,
      duration,
      category_id,
      section, // Keep for backward compatibility
      section_title, // Keep for backward compatibility
      image,
      image2,
      logos,
      gradient,
      badge_color,
      icon_name,
      is_package,
      features,
      is_active,
      display_order,
    } = body;

    // Validation
    if (!product_code || !name || !price || !category_id) {
      return NextResponse.json(
        { error: 'الحقول المطلوبة: product_code, name, price, category_id' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate category exists
    const { data: category, error: categoryError } = await supabaseAdmin
      .from('categories')
      .select('id, name, display_order')
      .eq('id', category_id)
      .single();

    if (categoryError || !category) {
      return NextResponse.json(
        { error: 'التصنيف المحدد غير موجود' },
        { status: 400 }
      );
    }

    // Get category name for section_title (backward compatibility)
    const categoryName = category.name;
    
    // Determine section number from category display_order (for backward compatibility)
    // This is a temporary mapping - can be removed in future
    const sectionNumber = category.display_order || 1;

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        product_code,
        name,
        description: description || '',
        price: parseFloat(price),
        discounted_price: discounted_price !== undefined && discounted_price !== null ? parseFloat(discounted_price) : null,
        promo_banner_text: promo_banner_text || null,
        duration: duration || '',
        category_id: category_id,
        section: section || sectionNumber, // Keep for backward compatibility
        section_title: section_title || categoryName, // Keep for backward compatibility
        image: image || '',
        image2: image2 || null,
        logos: logos || null,
        gradient: gradient || 'from-blue-500 to-cyan-500',
        badge_color: badge_color || 'bg-blue-500',
        icon_name: icon_name || 'sparkles',
        is_package: is_package || false,
        features: features || null,
        is_active: is_active !== undefined ? is_active : true,
        display_order: display_order || 0,
      })
      .select(`
        *,
        categories (
          id,
          name,
          name_en,
          display_order,
          is_active
        )
      `)
      .single();

    if (error) {
      console.error('Error creating product:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في إنشاء المنتج' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, product: data },
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

