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

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return null;
  }

  const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
  
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

// PUT - Update expired subscription
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

    const { id } = params;
    const body = await request.json();
    const { customer_name, customer_email, customer_phone, subscription_type } = body;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const updateData: any = {};
    if (customer_name !== undefined) updateData.customer_name = customer_name;
    if (customer_email !== undefined) updateData.customer_email = customer_email;
    if (customer_phone !== undefined) updateData.customer_phone = customer_phone;
    if (subscription_type !== undefined) updateData.subscription_type = subscription_type;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('expired_subscriptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating expired subscription:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء تحديث الاشتراك', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ subscription: data });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Delete expired subscription
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

    const { id } = params;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabaseAdmin
      .from('expired_subscriptions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting expired subscription:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء حذف الاشتراك', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

