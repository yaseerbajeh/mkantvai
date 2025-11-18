import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const normalizeExpirationDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (!value.includes('T')) {
    date.setHours(23, 59, 59, 999);
  }
  return date.toISOString();
};

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

// GET - Fetch current promotional banner
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
    
    // Get banner type from query params
    const { searchParams } = new URL(request.url);
    const bannerType = searchParams.get('type') || 'default';
    
    // Validate banner type
    if (bannerType !== 'default' && bannerType !== 'blackfriday') {
      return NextResponse.json(
        { error: 'نوع البانر غير صحيح' },
        { status: 400 }
      );
    }
    
    // Fetch the most recent banner of the specified type (enabled or disabled)
    const { data, error } = await supabaseAdmin
      .from('promotional_banners')
      .select('*')
      .eq('banner_type', bannerType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching promotional banner:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في جلب البانر الترويجي' },
        { status: 500 }
      );
    }

    return NextResponse.json({ banner: data || null });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// PUT - Create or update promotional banner
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
    const normalizedExpiration = normalizeExpirationDate(updates.expiration_date);
    if (normalizedExpiration) {
      updates.expiration_date = normalizedExpiration;
    }

    // Get banner type, default to 'default' if not provided
    const bannerType = updates.banner_type || 'default';
    
    // Validate banner type
    if (bannerType !== 'default' && bannerType !== 'blackfriday') {
      return NextResponse.json(
        { error: 'نوع البانر غير صحيح' },
        { status: 400 }
      );
    }

    // Validate required fields if enabling
    if (updates.is_enabled) {
      if (!updates.title || !updates.subtitle) {
        return NextResponse.json(
          { error: 'العنوان والوصف مطلوبان عند تفعيل البانر' },
          { status: 400 }
        );
      }
      if (updates.discount_percentage === undefined || updates.discount_percentage < 0 || updates.discount_percentage > 100) {
        return NextResponse.json(
          { error: 'نسبة الخصم يجب أن تكون بين 0 و 100' },
          { status: 400 }
        );
      }
      if (!normalizedExpiration) {
        return NextResponse.json(
          { error: 'تاريخ الانتهاء مطلوب' },
          { status: 400 }
        );
      }
      // Validate expiration date is in the future
      const expirationDate = new Date(normalizedExpiration);
      if (expirationDate <= new Date()) {
        return NextResponse.json(
          { error: 'تاريخ الانتهاء يجب أن يكون في المستقبل' },
          { status: 400 }
        );
      }
      // For blackfriday, validate image URL
      if (bannerType === 'blackfriday' && !updates.banner_image_url) {
        return NextResponse.json(
          { error: 'صورة البانر مطلوبة لبانر الجمعة البيضاء' },
          { status: 400 }
        );
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // CRITICAL: If enabling a banner, disable the other type's enabled banner FIRST
    // This must happen before any updates to ensure proper state
    if (updates.is_enabled === true) {
      const otherType = bannerType === 'default' ? 'blackfriday' : 'default';
      const { error: disableError } = await supabaseAdmin
        .from('promotional_banners')
        .update({ is_enabled: false })
        .eq('banner_type', otherType)
        .eq('is_enabled', true);

      if (disableError) {
        console.error('Error disabling other banner type:', disableError);
        // Don't continue if we can't disable the other banner
        return NextResponse.json(
          { error: 'فشل في تعطيل البانر الآخر' },
          { status: 500 }
        );
      }
    }

    // Prepare update data
    const bannerData: any = {
      banner_type: bannerType,
      title: updates.title || '',
      subtitle: updates.subtitle || '',
      discount_percentage: updates.discount_percentage || 0,
      expiration_date: normalizedExpiration || updates.expiration_date || (() => {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 30);
        fallback.setHours(23, 59, 59, 999);
        return fallback.toISOString();
      })(),
      cta_link: updates.cta_link || '/subscribe',
      is_enabled: updates.is_enabled || false,
      updated_at: new Date().toISOString(),
    };

    // Add banner_image_url for blackfriday type
    if (bannerType === 'blackfriday') {
      bannerData.banner_image_url = updates.banner_image_url || null;
    }

    let result;

    if (id) {
      // Update existing banner
      const { data, error } = await supabaseAdmin
        .from('promotional_banners')
        .update(bannerData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating promotional banner:', error);
        // Handle unique constraint violation
        if (error.code === '23505') {
          // Try to disable all other banners and retry
          await supabaseAdmin
            .from('promotional_banners')
            .update({ is_enabled: false })
            .neq('id', id);
          
          const { data: retryData, error: retryError } = await supabaseAdmin
            .from('promotional_banners')
            .update(bannerData)
            .eq('id', id)
            .select()
            .single();

          if (retryError) {
            return NextResponse.json(
              { error: retryError.message || 'فشل في تحديث البانر الترويجي' },
              { status: 500 }
            );
          }
          result = retryData;
        } else {
          return NextResponse.json(
            { error: error.message || 'فشل في تحديث البانر الترويجي' },
            { status: 500 }
          );
        }
      } else {
        result = data;
      }
    } else {
      // Create new banner
      // First, disable the other type's enabled banner if enabling this one
      if (bannerData.is_enabled) {
        const otherType = bannerType === 'default' ? 'blackfriday' : 'default';
        await supabaseAdmin
          .from('promotional_banners')
          .update({ is_enabled: false })
          .eq('banner_type', otherType)
          .eq('is_enabled', true);
      }

      const { data, error } = await supabaseAdmin
        .from('promotional_banners')
        .insert(bannerData)
        .select()
        .single();

      if (error) {
        console.error('Error creating promotional banner:', error);
        if (error.code === '23505') {
          // Unique constraint violation - try to update existing enabled banner of same type
          const { data: existingBanner } = await supabaseAdmin
            .from('promotional_banners')
            .select('id')
            .eq('banner_type', bannerType)
            .eq('is_enabled', true)
            .limit(1)
            .single();

          if (existingBanner) {
            const { data: updatedBanner, error: updateError } = await supabaseAdmin
              .from('promotional_banners')
              .update(bannerData)
              .eq('id', existingBanner.id)
              .select()
              .single();

            if (updateError) {
              return NextResponse.json(
                { error: updateError.message || 'فشل في إنشاء البانر الترويجي' },
                { status: 500 }
              );
            }
            result = updatedBanner;
          } else {
            return NextResponse.json(
              { error: 'فشل في إنشاء البانر الترويجي' },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            { error: error.message || 'فشل في إنشاء البانر الترويجي' },
            { status: 500 }
          );
        }
      } else {
        result = data;
      }
    }

    return NextResponse.json({ banner: result });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

