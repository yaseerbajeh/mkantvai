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

// GET - Get single commissioner details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get commissioner with earnings and payouts
    const { data: commissioner, error } = await supabaseAdmin
      .from('commissioners')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !commissioner) {
      return NextResponse.json(
        { error: 'المفوض غير موجود' },
        { status: 404 }
      );
    }

    // Get earnings
    const { data: earnings } = await supabaseAdmin
      .from('commission_earnings')
      .select('*')
      .eq('commissioner_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get payouts
    const { data: payouts } = await supabaseAdmin
      .from('commission_payouts')
      .select('*')
      .eq('commissioner_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      commissioner,
      earnings: earnings || [],
      payouts: payouts || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/commissions/[id]:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// PUT - Update commissioner
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { email, commission_rate, name, is_active } = body;

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

    const { data: commissioner, error } = await supabaseAdmin
      .from('commissioners')
      .update(updateData)
      .eq('id', params.id)
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
    console.error('Error in PUT /api/admin/commissions/[id]:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Delete commissioner
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Soft delete by setting is_active to false
    const { data: commissioner, error } = await supabaseAdmin
      .from('commissioners')
      .update({ is_active: false })
      .eq('id', params.id)
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
    console.error('Error in DELETE /api/admin/commissions/[id]:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

