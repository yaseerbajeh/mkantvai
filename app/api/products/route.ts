import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch all active products, ordered by section and display_order
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('section', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json(
        { error: 'فشل في جلب المنتجات' },
        { status: 500 }
      );
    }

    // Group products by section
    const productsBySection: { [key: number]: any[] } = {};
    const sectionTitles: { [key: number]: string } = {};

    data.forEach((product: any) => {
      if (!productsBySection[product.section]) {
        productsBySection[product.section] = [];
        sectionTitles[product.section] = product.section_title;
      }
      productsBySection[product.section].push(product);
    });

    // Prevent caching - return fresh data every time
    return NextResponse.json(
      {
        products: data,
        productsBySection,
        sectionTitles,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

