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

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

// GET - Fetch current active template
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

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the active template
    const { data: template, error } = await supabaseAdmin
      .from('reminder_email_templates')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      // If no template exists, return default structure
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          title: 'لم تكمل عملية الشراء - {name}',
          body: '<div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;"><div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;"><h2 style="color: #333; margin-bottom: 20px;">مرحباً {name}</h2><p style="font-size: 16px; color: #333; margin-bottom: 20px;">لاحظنا أنك أضفت منتجات إلى سلة التسوق الخاصة بك ولكن لم تكمل عملية الشراء بعد.</p><div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;"><h3 style="color: #333; margin-bottom: 15px;">تفاصيل طلبك:</h3><div style="margin-bottom: 10px;"><strong>رقم الطلب:</strong> {order_id}</div><div style="margin-bottom: 10px;"><strong>المنتج:</strong> {product_name}</div><div style="margin-bottom: 10px;"><strong>المبلغ الإجمالي:</strong> {total_amount} ريال</div></div><div style="text-align: center; margin: 30px 0;"><a href="{cart_link}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">إكمال عملية الشراء</a></div><p style="font-size: 14px; color: #666; margin-top: 30px;">إذا كان لديك أي استفسارات، لا تتردد في التواصل معنا.</p><div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">مع تحيات فريق مكان TV</div></div></div>',
        });
      }
      
      console.error('Error fetching template:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب القالب' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: template.id,
      title: template.title,
      body: template.body,
      is_active: template.is_active,
      created_at: template.created_at,
      updated_at: template.updated_at,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Create or update template
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

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title, body: templateBody } = body;

    if (!title || !templateBody) {
      return NextResponse.json(
        { error: 'العنوان والمحتوى مطلوبان' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Deactivate all existing templates
    await supabaseAdmin
      .from('reminder_email_templates')
      .update({ is_active: false })
      .eq('is_active', true);

    // Create new active template
    const { data: newTemplate, error } = await supabaseAdmin
      .from('reminder_email_templates')
      .insert({
        title,
        body: templateBody,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء حفظ القالب' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template: {
        id: newTemplate.id,
        title: newTemplate.title,
        body: newTemplate.body,
        is_active: newTemplate.is_active,
        created_at: newTemplate.created_at,
        updated_at: newTemplate.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

