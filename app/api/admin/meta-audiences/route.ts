import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Normalize a single phone number: strip everything except digits
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

// Parse a raw textarea string into a deduplicated array of normalized numbers
function parsePhoneNumbers(raw: string): string[] {
  const numbers = raw
    .split(/[\n,;]+/)
    .map((n) => normalizePhone(n.trim()))
    .filter((n) => n.length >= 7);
  return [...new Set(numbers)];
}

// GET - List all audiences
export async function GET() {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: audiences, error } = await supabaseAdmin
    .from('meta_audiences')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ audiences });
}

// POST - Create audience
export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { name, source_tag, phone_numbers_raw } = await request.json();

  if (!name || !phone_numbers_raw) {
    return NextResponse.json({ error: 'الاسم وأرقام الهواتف مطلوبة' }, { status: 400 });
  }

  const phone_numbers = parsePhoneNumbers(phone_numbers_raw);

  if (phone_numbers.length === 0) {
    return NextResponse.json({ error: 'لم يتم إدخال أرقام صالحة' }, { status: 400 });
  }

  const { data: audience, error } = await supabaseAdmin
    .from('meta_audiences')
    .insert({ name, source_tag: source_tag || null, phone_numbers })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ audience });
}

// PUT - Update audience
export async function PUT(request: NextRequest) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { id, name, source_tag, phone_numbers_raw } = await request.json();

  if (!id || !name || !phone_numbers_raw) {
    return NextResponse.json({ error: 'المعرف والاسم والأرقام مطلوبة' }, { status: 400 });
  }

  const phone_numbers = parsePhoneNumbers(phone_numbers_raw);

  if (phone_numbers.length === 0) {
    return NextResponse.json({ error: 'لم يتم إدخال أرقام صالحة' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('meta_audiences')
    .update({ name, source_tag: source_tag || null, phone_numbers })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE - Delete audience
export async function DELETE(request: NextRequest) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('meta_audiences')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
