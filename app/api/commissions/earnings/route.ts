import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, authenticatedLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get authenticated commissioner
async function getCommissioner(request: NextRequest) {
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
  if (error || !user || !user.email) {
    return null;
  }

  // Check if user is a commissioner
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: commissioner, error: commissionerError } = await supabaseAdmin
    .from('commissioners')
    .select('*')
    .eq('email', user.email)
    .eq('is_active', true)
    .single();

  if (commissionerError || !commissioner) {
    return null;
  }

  return { user, commissioner };
}

// GET - Get earnings for authenticated commissioner
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const commissionerData = await getCommissioner(request);
    if (!commissionerData) {
      return NextResponse.json(
        { error: 'غير مصرح. يجب أن تكون مفوضاً نشطاً' },
        { status: 401 }
      );
    }

    const { commissioner } = commissionerData;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get earnings
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('commission_earnings')
      .select('*')
      .eq('commissioner_id', commissioner.id)
      .order('created_at', { ascending: false });

    if (earningsError) {
      console.error('Error fetching earnings:', earningsError);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب البيانات' },
        { status: 500 }
      );
    }

    // Get payouts
    const { data: payouts, error: payoutsError } = await supabaseAdmin
      .from('commission_payouts')
      .select('*')
      .eq('commissioner_id', commissioner.id)
      .order('created_at', { ascending: false });

    if (payoutsError) {
      console.error('Error fetching payouts:', payoutsError);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب البيانات' },
        { status: 500 }
      );
    }

    // Calculate daily commissions for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyCommissions: { [key: string]: number } = {};
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Initialize all days to 0
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayKey = days[date.getDay() === 0 ? 6 : date.getDay() - 1];
      dailyCommissions[dayKey] = 0;
    }

    // Sum commissions by day
    earnings?.forEach((earning: any) => {
      const earningDate = new Date(earning.created_at);
      if (earningDate >= sevenDaysAgo) {
        const dayKey = days[earningDate.getDay() === 0 ? 6 : earningDate.getDay() - 1];
        dailyCommissions[dayKey] = (dailyCommissions[dayKey] || 0) + parseFloat(earning.commission_amount || 0);
      }
    });

    // Get next payout (pending payouts)
    const nextPayoutAmount = parseFloat(commissioner.pending_payouts as any || 0);

    return NextResponse.json({
      commissioner: {
        id: commissioner.id,
        email: commissioner.email,
        name: commissioner.name,
        promo_code: commissioner.promo_code,
        commission_rate: commissioner.commission_rate,
        total_earnings: commissioner.total_earnings,
        pending_payouts: commissioner.pending_payouts,
        paid_out: commissioner.paid_out,
      },
      earnings: earnings || [],
      payouts: payouts || [],
      dailyCommissions,
      nextPayoutAmount,
    });
  } catch (error: any) {
    console.error('Error in GET /api/commissions/earnings:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

