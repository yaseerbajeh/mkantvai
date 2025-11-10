import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { determineSubscriptionType, calculateExpirationDate } from '@/lib/subscription-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface CSVRow {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  subscription_code: string;
  subscription_type: string;
  subscription_duration: string;
  expiration_date: string;
  start_date: string;
  product_code?: string;
}

function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const requiredHeaders = ['subscription_code', 'subscription_type', 'subscription_duration', 'expiration_date', 'start_date'];
  
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Missing required header: ${header}`);
    }
  }

  // Parse rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) {
      throw new Error(`Row ${i + 1} has ${values.length} columns but expected ${headers.length}`);
    }

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || null;
    });

    // Validate required fields
    if (!row.subscription_code) {
      throw new Error(`Row ${i + 1} is missing required field: subscription_code`);
    }

    rows.push(row as CSVRow);
  }

  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { csvText } = body;

    if (!csvText) {
      return NextResponse.json(
        { error: 'CSV text is required' },
        { status: 400 }
      );
    }

    // Parse CSV
    let rows: CSVRow[];
    try {
      rows = parseCSV(csvText);
    } catch (error: any) {
      return NextResponse.json(
        { error: 'Invalid CSV format', details: error.message },
        { status: 400 }
      );
    }

    // Validate and prepare data for insertion
    const subscriptions = [];
    const errors = [];

    // Fetch all products to get durations (for product_code lookup)
    const { data: productsData } = await supabaseAdmin
      .from('products')
      .select('product_code, duration, category_id, categories(name, name_en)');
    
    const productsMap = new Map();
    (productsData || []).forEach((product: any) => {
      productsMap.set(product.product_code, product);
    });

    // Fetch categories for subscription_type validation
    const { data: categoriesData } = await supabaseAdmin
      .from('categories')
      .select('id, name, name_en')
      .eq('is_active', true);
    
    const categoryNames = new Set<string>();
    (categoriesData || []).forEach((cat: any) => {
      if (cat.name) categoryNames.add(cat.name);
      if (cat.name_en) categoryNames.add(cat.name_en);
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        let subscriptionDuration = row.subscription_duration;
        let subscriptionType = row.subscription_type;
        let startDate: Date;
        let expirationDate: Date;

        // If product_code is provided, try to fetch product details
        if (row.product_code && row.product_code.trim() !== '') {
          const product = productsMap.get(row.product_code.trim());
          if (product) {
            // Use product duration if available
            if (product.duration) {
              subscriptionDuration = product.duration;
            }
            
            // Use category name as subscription_type if product has category
            if (product.categories) {
              subscriptionType = product.categories.name || product.categories.name_en || subscriptionType;
            }
          }
        }

        // Parse dates
        // If product_code was used and duration changed, recalculate expiration_date
        if (row.product_code && row.product_code.trim() !== '' && productsMap.has(row.product_code.trim())) {
          startDate = new Date(row.start_date);
          if (isNaN(startDate.getTime())) {
            throw new Error('Invalid start_date format');
          }
          // Recalculate expiration_date based on product duration
          expirationDate = calculateExpirationDate(startDate, subscriptionDuration);
        } else {
          // Use provided dates
          startDate = new Date(row.start_date);
          expirationDate = new Date(row.expiration_date);
          if (isNaN(startDate.getTime()) || isNaN(expirationDate.getTime())) {
            throw new Error('Invalid date format');
          }
        }

        // Validate subscription type (now accepts category names or legacy types)
        const validLegacyTypes = ['iptv', 'shahid', 'netflix', 'package'];
        const isValidLegacyType = validLegacyTypes.includes(subscriptionType.toLowerCase());
        const isValidCategoryName = categoryNames.has(subscriptionType);
        
        if (!isValidLegacyType && !isValidCategoryName && subscriptionType) {
          // If not a valid category name or legacy type, use it anyway (might be a new category)
          console.warn(`Subscription type "${subscriptionType}" not found in categories, using as-is`);
        }

        subscriptions.push({
          customer_name: row.customer_name || null,
          customer_email: row.customer_email || null,
          customer_phone: row.customer_phone || null,
          subscription_code: row.subscription_code,
          subscription_type: subscriptionType,
          subscription_duration: subscriptionDuration,
          expiration_date: expirationDate.toISOString(),
          start_date: startDate.toISOString(),
          product_code: row.product_code || null,
        });
      } catch (error: any) {
        errors.push({
          row: i + 2, // +2 because header is row 1, and we're 0-indexed
          error: error.message,
        });
      }
    }

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'No valid subscriptions to import', errors },
        { status: 400 }
      );
    }

    // Bulk insert
    const { data, error } = await supabaseAdmin
      .from('active_subscriptions')
      .insert(subscriptions)
      .select();

    if (error) {
      console.error('Error importing subscriptions:', error);
      return NextResponse.json(
        { error: 'Failed to import subscriptions', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imported: data?.length || 0,
      totalRows: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error in CSV import:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

