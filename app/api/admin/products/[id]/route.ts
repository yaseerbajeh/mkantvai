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

// PUT - Update product
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const updateData: any = {};

    // If category_id is being updated, validate it exists
    if (category_id !== undefined) {
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

      // Update section and section_title for backward compatibility
      if (!section) {
        updateData.section = category.display_order || 1;
      }
      if (!section_title) {
        updateData.section_title = category.name;
      }
    }
    if (product_code !== undefined) updateData.product_code = product_code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (discounted_price !== undefined) updateData.discounted_price = discounted_price !== null && discounted_price !== '' ? parseFloat(discounted_price) : null;
    if (promo_banner_text !== undefined) updateData.promo_banner_text = promo_banner_text || null;
    if (duration !== undefined) updateData.duration = duration;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (section !== undefined) updateData.section = parseInt(section);
    if (section_title !== undefined) updateData.section_title = section_title;
    if (image !== undefined) updateData.image = image;
    if (image2 !== undefined) updateData.image2 = image2;
    if (logos !== undefined) updateData.logos = logos;
    if (gradient !== undefined) updateData.gradient = gradient;
    if (badge_color !== undefined) updateData.badge_color = badge_color;
    if (icon_name !== undefined) updateData.icon_name = icon_name;
    if (is_package !== undefined) updateData.is_package = is_package;
    if (features !== undefined) updateData.features = features;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = parseInt(display_order);

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', params.id)
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
      console.error('Error updating product:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في تحديث المنتج' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, product: data });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Delete product
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
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول كمسؤول.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if there are active orders with this product_code
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('product_code')
      .eq('id', params.id)
      .single();

    if (product) {
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('product_code', product.product_code)
        .limit(1);

      if (orders && orders.length > 0) {
        return NextResponse.json(
          { error: 'لا يمكن حذف المنتج لأنه يحتوي على طلبات نشطة' },
          { status: 400 }
        );
      }
    }

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting product:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في حذف المنتج' },
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


