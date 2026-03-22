import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - List all templates
export async function GET() {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: templates, error } = await supabaseAdmin
    .from('campaign_message_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates });
}

// POST - Create a new template
export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { name, body } = await request.json();

  if (!name || !body) {
    return NextResponse.json({ error: 'الاسم والنص مطلوبان' }, { status: 400 });
  }

  const { data: template, error } = await supabaseAdmin
    .from('campaign_message_templates')
    .insert({ name, body })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template });
}

// PUT - Update a template
export async function PUT(request: NextRequest) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { id, name, body } = await request.json();

  if (!id || !name || !body) {
    return NextResponse.json({ error: 'المعرف والاسم والنص مطلوبان' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('campaign_message_templates')
    .update({ name, body, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE - Delete a template
export async function DELETE(request: NextRequest) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('campaign_message_templates')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
