import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, authenticatedLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PUT(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const body = await request.json();
    const { phone } = body as { phone?: string };

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 });
    }

    // Normalize to 9 digits and then prefix with 966
    let cleaned = phone.replace(/\D/g, '').replace(/^0+/, '');
    if (cleaned.startsWith('966')) cleaned = cleaned.slice(3);
    if (cleaned.length !== 9) {
      return NextResponse.json(
        { error: 'يجب أن يتكون الرقم من 9 أرقام فقط. مثال: 542668201' },
        { status: 400 }
      );
    }
    const formattedPhone = `966${cleaned}`;

    // Get auth token and user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    // Upsert into user_credentials using admin key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existing } = await supabaseAdmin
      .from('user_credentials')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from('user_credentials')
        .update({
          email: user.email || '',
          phone: formattedPhone,
        })
        .eq('user_id', user.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from('user_credentials')
        .insert({
          user_id: user.id,
          email: user.email || '',
          phone: formattedPhone,
        });
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, phone: formattedPhone });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}


