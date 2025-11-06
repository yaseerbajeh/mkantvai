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

// PUT - Update subscription code
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
    const { product_code, subscription_code, subscription_meta } = body;

    // Validate at least one field is provided
    if (product_code === undefined && subscription_code === undefined && subscription_meta === undefined) {
      return NextResponse.json(
        { error: 'يجب توفير حقل واحد على الأقل للتحديث' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if subscription exists
    const { data: existingSubscription, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingSubscription) {
      return NextResponse.json(
        { error: 'رمز الاشتراك غير موجود' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    
    // Validate and update product_code if provided
    if (product_code !== undefined) {
      if (!product_code || product_code.trim().length === 0) {
        return NextResponse.json(
          { error: 'رمز المنتج لا يمكن أن يكون فارغاً' },
          { status: 400 }
        );
      }

      // Validate product_code exists in products table
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('product_code')
        .eq('product_code', product_code.trim())
        .single();

      if (productError || !product) {
        return NextResponse.json(
          { error: 'رمز المنتج المحدد غير موجود' },
          { status: 400 }
        );
      }

      updateData.product_code = product_code.trim();
    }

    // Validate and update subscription_code if provided
    if (subscription_code !== undefined) {
      if (!subscription_code || subscription_code.trim().length === 0) {
        return NextResponse.json(
          { error: 'رمز الاشتراك لا يمكن أن يكون فارغاً' },
          { status: 400 }
        );
      }

      // Check uniqueness (excluding current record)
      const { data: duplicateSubscription } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('subscription_code', subscription_code.trim())
        .neq('id', params.id)
        .maybeSingle();

      if (duplicateSubscription) {
        return NextResponse.json(
          { error: 'رمز الاشتراك موجود بالفعل' },
          { status: 400 }
        );
      }

      updateData.subscription_code = subscription_code.trim();
    }

    // Update subscription_meta if provided
    if (subscription_meta !== undefined) {
      updateData.subscription_meta = subscription_meta;
    }

    // Update subscription
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating subscription code:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في تحديث رمز الاشتراك' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscriptionCode: data,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Delete subscription code
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

    const { error } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting subscription code:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في حذف رمز الاشتراك' },
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


