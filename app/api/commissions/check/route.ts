import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, authenticatedLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Check if user is a commissioner
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
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
    if (error || !user || !user.email) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    // Check if user is a commissioner
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: commissioner, error: commissionerError } = await supabaseAdmin
      .from('commissioners')
      .select('id, promo_code')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    return NextResponse.json({
      isCommissioner: !commissionerError && !!commissioner,
      commissioner: commissioner || null,
    });
  } catch (error: any) {
    console.error('Error checking commissioner status:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع', isCommissioner: false },
      { status: 500 }
    );
  }
}

