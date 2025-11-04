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

// POST - Set reminder timer for an order
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
    const { order_id, reminder_hours } = body;

    if (!order_id || reminder_hours === undefined) {
      return NextResponse.json(
        { error: 'معرف الطلب وعدد الساعات مطلوبان' },
        { status: 400 }
      );
    }

    // Validate reminder_hours is one of the allowed values
    const allowedHours = [6, 12, 24, 48];
    if (!allowedHours.includes(reminder_hours)) {
      return NextResponse.json(
        { error: 'عدد الساعات يجب أن يكون 6، 12، 24، أو 48' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update({ 
        reminder_hours: reminder_hours,
        reminder_sent_at: null, // Reset reminder sent status if changing timer
      })
      .eq('id', order_id)
      .select()
      .single();

    if (error) {
      console.error('Error setting reminder timer:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء تعيين مؤقت التذكير' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `تم تعيين تذكير بعد ${reminder_hours} ساعة`,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

