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
  customer_name: string;
  customer_email: string;
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
  const requiredHeaders = ['customer_name', 'customer_email', 'subscription_code', 'subscription_type', 'subscription_duration', 'expiration_date', 'start_date'];
  
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
    if (!row.customer_name || !row.customer_email || !row.subscription_code) {
      throw new Error(`Row ${i + 1} is missing required fields`);
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

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Validate subscription type
        const validTypes = ['iptv', 'shahid', 'netflix', 'package'];
        if (!validTypes.includes(row.subscription_type.toLowerCase())) {
          throw new Error(`Invalid subscription_type: ${row.subscription_type}`);
        }

        // Parse dates
        const startDate = new Date(row.start_date);
        const expirationDate = new Date(row.expiration_date);

        if (isNaN(startDate.getTime()) || isNaN(expirationDate.getTime())) {
          throw new Error('Invalid date format');
        }

        // Determine subscription type if not provided correctly
        const subType = determineSubscriptionType(
          row.product_code,
          row.subscription_type
        );

        subscriptions.push({
          customer_name: row.customer_name,
          customer_email: row.customer_email,
          customer_phone: row.customer_phone || null,
          subscription_code: row.subscription_code,
          subscription_type: subType,
          subscription_duration: row.subscription_duration,
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

