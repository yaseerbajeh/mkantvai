import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage, normalizePhoneNumber } from '@/utils/sendWhatsApp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - List all campaigns
export async function GET() {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: campaigns, error } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaigns });
}

// POST - Create campaign and optionally send a single message
export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const body = await request.json();

  // Mode 1: Create a new campaign
  if (body.action === 'create') {
    const { name, message, phoneNumbers, scheduledAt } = body;

    if (!name || !message || !phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json({ error: 'اسم الحملة والرسالة وأرقام الهواتف مطلوبة' }, { status: 400 });
    }

    // Normalize and deduplicate phone numbers
    const normalizedNumbers = [...new Set(
      phoneNumbers
        .map((p: string) => normalizePhoneNumber(p.trim()))
        .filter((p: string | null): p is string => !!p)
    )];

    if (normalizedNumbers.length === 0) {
      return NextResponse.json({ error: 'لا توجد أرقام هواتف صالحة' }, { status: 400 });
    }

    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    // Create campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .insert({
        name,
        message,
        status: isScheduled ? 'scheduled' : 'pending',
        total_count: normalizedNumbers.length,
        sent_count: 0,
        error_count: 0,
        scheduled_at: scheduledAt || null,
      })
      .select()
      .single();

    if (campaignError) {
      return NextResponse.json({ error: campaignError.message }, { status: 500 });
    }

    // Create message records
    const messageRecords = normalizedNumbers.map((phone: string) => ({
      campaign_id: campaign.id,
      phone_number: phone,
      status: 'pending',
    }));

    const { error: messagesError } = await supabaseAdmin
      .from('whatsapp_campaign_messages')
      .insert(messageRecords);

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    return NextResponse.json({ campaign });
  }

  // Mode 2: Send a single message in a campaign
  if (body.action === 'send_one') {
    const { campaignId, messageId } = body;

    // Get the message record
    const { data: msg, error: msgError } = await supabaseAdmin
      .from('whatsapp_campaign_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (msgError || !msg) {
      return NextResponse.json({ error: 'رسالة غير موجودة' }, { status: 404 });
    }

    // Get campaign for the message text
    const { data: campaign, error: campError } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .select('message')
      .eq('id', campaignId)
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: 'حملة غير موجودة' }, { status: 404 });
    }

    // Send WhatsApp message
    const result = await sendWhatsAppMessage(msg.phone_number, campaign.message);

    if (result.success) {
      // Update message as sent
      await supabaseAdmin
        .from('whatsapp_campaign_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', messageId);

      // Increment sent_count
      const { data: campData } = await supabaseAdmin
        .from('whatsapp_campaigns')
        .select('sent_count')
        .eq('id', campaignId)
        .single();

      if (campData) {
        await supabaseAdmin
          .from('whatsapp_campaigns')
          .update({ sent_count: (campData.sent_count || 0) + 1, status: 'sending' })
          .eq('id', campaignId);
      }

      return NextResponse.json({ success: true });
    } else {
      // Update message as failed
      await supabaseAdmin
        .from('whatsapp_campaign_messages')
        .update({ status: 'failed', error: result.error })
        .eq('id', messageId);

      // Increment error_count (fallback approach)
      const { data: camp } = await supabaseAdmin
        .from('whatsapp_campaigns')
        .select('error_count')
        .eq('id', campaignId)
        .single();

      if (camp) {
        await supabaseAdmin
          .from('whatsapp_campaigns')
          .update({ error_count: (camp.error_count || 0) + 1, status: 'sending' })
          .eq('id', campaignId);
      }

      return NextResponse.json({ success: false, error: result.error });
    }
  }

  // Mode 3: Mark campaign as completed
  if (body.action === 'complete') {
    const { campaignId, status } = body;
    await supabaseAdmin
      .from('whatsapp_campaigns')
      .update({
        status: status || 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
}
