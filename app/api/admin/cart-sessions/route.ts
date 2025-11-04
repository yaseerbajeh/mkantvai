import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Fetch all cart sessions for admin (uses service role)
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    // Check if user is admin (using environment variable)
    const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
    const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
    
    if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
      return NextResponse.json(
        { error: 'غير مصرح - يجب أن تكون مسؤولاً' },
        { status: 403 }
      );
    }

    // Fetch all cart sessions that haven't been converted to orders
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: cartSessions, error } = await supabaseAdmin
      .from('cart_sessions')
      .select('*')
      .is('converted_to_order_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cart sessions:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب السلات' },
        { status: 500 }
      );
    }

    return NextResponse.json({ cartSessions: cartSessions || [] });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

