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

    // Fetch all active products with category information
    // First, get active categories to filter products
    const { data: activeCategories } = await supabase
      .from('categories')
      .select('id')
      .eq('is_active', true);

    const activeCategoryIds = activeCategories?.map(c => c.id) || [];

    // Fetch all active products with category information
    let query = supabase
      .from('products')
      .select(`
        *,
        categories (
          id,
          name,
          name_en,
          display_order,
          is_active
        )
      `)
      .eq('is_active', true);

    // Filter by active categories if categories exist, but also include products without category_id (backward compatibility)
    // Note: We'll filter in memory to handle the OR condition properly

    const { data: productsData, error } = await query;
    
    // Filter products: only show products with active categories or no category (backward compatibility)
    let filteredProducts = (productsData || []).filter((product: any) => {
      // If product has no category_id, include it (backward compatibility)
      if (!product.category_id) {
        return true;
      }
      // If product has a category, only include if category is active
      if (product.categories) {
        return product.categories.is_active !== false;
      }
      // If category data is missing but category_id exists, check if it's in active categories
      return activeCategoryIds.includes(product.category_id);
    });
    
    // Sort products by category display_order and product display_order
    const data = filteredProducts.sort((a: any, b: any) => {
      // First sort by category display_order
      const aCategoryOrder = a.categories?.display_order || 999;
      const bCategoryOrder = b.categories?.display_order || 999;
      if (aCategoryOrder !== bCategoryOrder) {
        return aCategoryOrder - bCategoryOrder;
      }
      // Then by product display_order
      return (a.display_order || 0) - (b.display_order || 0);
    });

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json(
        { error: 'فشل في جلب المنتجات' },
        { status: 500 }
      );
    }

    // Calculate stock for each product
    // Get all product codes to fetch stock counts
    const productCodes = (data || []).map((p: any) => p.product_code).filter(Boolean);
    
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

    // Group products by category
    const productsByCategory: { [key: string]: any[] } = {};
    const categoryTitles: { [key: string]: string } = {};
    const categoryDisplayOrders: { [key: string]: number } = {};

    productsWithStock.forEach((product: any) => {
      // Use category_id if available, otherwise fall back to section for backward compatibility
      const categoryId = product.category_id || `section-${product.section}`;
      const categoryName = product.categories?.name || product.section_title || `القسم ${product.section}`;
      const categoryDisplayOrder = product.categories?.display_order || product.section || 999;

      if (!productsByCategory[categoryId]) {
        productsByCategory[categoryId] = [];
        categoryTitles[categoryId] = categoryName;
        categoryDisplayOrders[categoryId] = categoryDisplayOrder;
      }
      productsByCategory[categoryId].push(product);
    });

    // Sort categories by display_order
    const sortedCategoryIds = Object.keys(productsByCategory).sort((a, b) => {
      return (categoryDisplayOrders[a] || 999) - (categoryDisplayOrders[b] || 999);
    });

    // Create ordered productsByCategory object
    const orderedProductsByCategory: { [key: string]: any[] } = {};
    sortedCategoryIds.forEach(categoryId => {
      orderedProductsByCategory[categoryId] = productsByCategory[categoryId];
    });

    // Prevent caching - return fresh data every time
    return NextResponse.json(
      {
        products: productsWithStock,
        productsByCategory: orderedProductsByCategory,
        categoryTitles,
        // Keep backward compatibility
        productsBySection: productsByCategory,
        sectionTitles: categoryTitles,
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

