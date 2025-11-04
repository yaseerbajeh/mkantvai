import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const amount = parseFloat(searchParams.get('amount') || '0');

    if (!code) {
      return NextResponse.json(
        { error: 'رمز الخصم مطلوب' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: promoCode, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !promoCode) {
      return NextResponse.json(
        { error: 'رمز الخصم غير صحيح أو غير متاح' },
        { status: 404 }
      );
    }

    // Check validity dates
    const now = new Date();
    if (promoCode.valid_from && new Date(promoCode.valid_from) > now) {
      return NextResponse.json(
        { error: 'رمز الخصم غير متاح بعد' },
        { status: 400 }
      );
    }

    if (promoCode.valid_until && new Date(promoCode.valid_until) < now) {
      return NextResponse.json(
        { error: 'رمز الخصم منتهي الصلاحية' },
        { status: 400 }
      );
    }

    // Check minimum purchase amount
    if (promoCode.min_purchase_amount && amount < promoCode.min_purchase_amount) {
      return NextResponse.json(
        { error: `الحد الأدنى للشراء: ${promoCode.min_purchase_amount} ريال` },
        { status: 400 }
      );
    }

    // Check usage limit
    if (promoCode.usage_limit && promoCode.used_count >= promoCode.usage_limit) {
      return NextResponse.json(
        { error: 'تم استنفاد استخدام رمز الخصم' },
        { status: 400 }
      );
    }

    return NextResponse.json({ promoCode });
  } catch (error: any) {
    console.error('Error validating promo code:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التحقق من رمز الخصم' },
      { status: 500 }
    );
  }
}

