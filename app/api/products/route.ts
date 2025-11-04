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

    // Calculate stock for each product
    // Get all product codes to fetch stock counts
    const productCodes = data.map((p: any) => p.product_code).filter(Boolean);
    
    // Count available subscriptions per product_code
    const stockCounts: { [key: string]: number } = {};
    if (productCodes.length > 0) {
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('product_code')
        .in('product_code', productCodes);
      
      if (!subsError && subscriptions) {
        subscriptions.forEach((sub: any) => {
          if (sub.product_code) {
            stockCounts[sub.product_code] = (stockCounts[sub.product_code] || 0) + 1;
          }
        });
      }
    }

    // Count purchases per product_code from orders table
    const purchaseCounts: { [key: string]: number } = {};
    if (productCodes.length > 0) {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('product_code')
        .in('product_code', productCodes)
        .not('product_code', 'is', null);
      
      if (!ordersError && orders) {
        orders.forEach((order: any) => {
          if (order.product_code) {
            purchaseCounts[order.product_code] = (purchaseCounts[order.product_code] || 0) + 1;
          }
        });
      }
    }

    // Add available_stock and purchase_count to each product
    const productsWithStock = data.map((product: any) => {
      let availableStock = 0;
      
      if (product.quantity_auto !== false) {
        // Auto-calculate from subscriptions
        availableStock = stockCounts[product.product_code] || 0;
      } else {
        // Use manual quantity
        availableStock = product.quantity || 0;
      }
      
      return {
        ...product,
        available_stock: availableStock,
        purchase_count: purchaseCounts[product.product_code] || 0,
      };
    });

    // Group products by section
    const productsBySection: { [key: number]: any[] } = {};
    const sectionTitles: { [key: number]: string } = {};

    productsWithStock.forEach((product: any) => {
      if (!productsBySection[product.section]) {
        productsBySection[product.section] = [];
        sectionTitles[product.section] = product.section_title;
      }
      productsBySection[product.section].push(product);
    });

    // Prevent caching - return fresh data every time
    return NextResponse.json(
      {
        products: productsWithStock,
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

