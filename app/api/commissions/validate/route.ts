import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Validate commission promo code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'رمز العمولة مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if code exists and is active
    const { data: commissioner, error } = await supabaseAdmin
      .from('commissioners')
      .select('id, email, name, promo_code, commission_rate, is_active')
      .eq('promo_code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !commissioner) {
      return NextResponse.json(
        { error: 'رمز العمولة غير صحيح أو غير متاح' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      commissioner: {
        id: commissioner.id,
        email: commissioner.email,
        name: commissioner.name,
        promo_code: commissioner.promo_code,
        commission_rate: commissioner.commission_rate,
      },
    });
  } catch (error: any) {
    console.error('Error validating commission code:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التحقق من رمز العمولة' },
      { status: 500 }
    );
  }
}

