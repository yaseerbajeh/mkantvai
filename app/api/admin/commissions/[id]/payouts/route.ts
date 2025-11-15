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

// GET - Get payout history for commissioner
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

    const { data: payouts, error } = await supabaseAdmin
      .from('commission_payouts')
      .select('*')
      .eq('commissioner_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payouts:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب البيانات' },
        { status: 500 }
      );
    }

    return NextResponse.json({ payouts: payouts || [] });
  } catch (error: any) {
    console.error('Error in GET /api/admin/commissions/[id]/payouts:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Process payout for commissioner
export async function POST(
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
    const { amount, notes } = body;

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'المبلغ يجب أن يكون أكبر من صفر' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check commissioner exists and get pending amount
    const { data: commissioner, error: commissionerError } = await supabaseAdmin
      .from('commissioners')
      .select('pending_payouts')
      .eq('id', params.id)
      .single();

    if (commissionerError || !commissioner) {
      return NextResponse.json(
        { error: 'المفوض غير موجود' },
        { status: 404 }
      );
    }

    const payoutAmount = parseFloat(amount);
    const pendingAmount = parseFloat(commissioner.pending_payouts as any || 0);

    if (payoutAmount > pendingAmount) {
      return NextResponse.json(
        { error: `المبلغ المطلوب (${payoutAmount}) أكبر من المبلغ المعلق (${pendingAmount})` },
        { status: 400 }
      );
    }

    // Create payout record
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('commission_payouts')
      .insert({
        commissioner_id: params.id,
        amount: payoutAmount,
        status: 'completed',
        processed_by: adminUser.id,
        processed_at: new Date().toISOString(),
        notes: notes || null,
      })
      .select()
      .single();

    if (payoutError) {
      console.error('Error creating payout:', payoutError);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء معالجة الدفع' },
        { status: 500 }
      );
    }

    // The trigger will automatically update commissioner totals

    return NextResponse.json({
      payout,
      message: 'تم معالجة الدفع بنجاح',
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/commissions/[id]/payouts:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

