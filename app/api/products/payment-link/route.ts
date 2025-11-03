import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('product_code');
    const environment = searchParams.get('environment') || 'live';

    if (!productCode) {
      return NextResponse.json(
        { error: 'product_code is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch payment link from database
    const { data: paymentLink, error } = await supabase
      .from('paypal_payment_links')
      .select('payment_link_id')
      .eq('product_code', productCode)
      .eq('environment', environment)
      .single();

    if (error || !paymentLink) {
      // No payment link found - return null (not an error)
      return NextResponse.json({ paymentLink: null });
    }

    // Construct PayPal URL based on environment
    const paypalBaseUrl = environment === 'live' 
      ? 'https://www.paypal.com'
      : 'https://www.sandbox.paypal.com';
    
    const fullPaymentLink = `${paypalBaseUrl}/ncp/payment/${paymentLink.payment_link_id}`;

    return NextResponse.json({ paymentLink: fullPaymentLink });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع', paymentLink: null },
      { status: 500 }
    );
  }
}

