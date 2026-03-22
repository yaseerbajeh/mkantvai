import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Get campaign details with all message records
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { id } = params;

  // Get campaign
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'حملة غير موجودة' }, { status: 404 });
  }

  // Get all messages for this campaign
  const { data: messages, error: messagesError } = await supabaseAdmin
    .from('whatsapp_campaign_messages')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  return NextResponse.json({ campaign, messages });
}

// DELETE - Delete a campaign and its messages
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { id } = params;

  const { error } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
