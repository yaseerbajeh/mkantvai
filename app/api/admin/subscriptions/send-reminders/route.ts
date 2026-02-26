import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendRenewalReminder, normalizePhoneNumber } from '@/utils/sendWhatsApp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Shared: fetch eligible subscriptions, deduplicate, and calculate stages
async function getEligibleSubscriptions(supabaseAdmin: any, forceMode: boolean) {
  let query = supabaseAdmin
    .from('active_subscriptions')
    .select('*')
    .not('customer_phone', 'is', null)
    .eq('whatsapp_opt_out', false)
    .order('expiration_date', { ascending: true });

  if (forceMode) {
    query = query.lte('expiration_date', new Date().toISOString());
  } else {
    query = query.lt('reminder_stage', 2);
  }

  const { data: subscriptions, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!subscriptions || subscriptions.length === 0) {
    return [];
  }

  const now = new Date();

  // Deduplicate by phone - keep the subscription with earliest expiry per phone
  const phoneMap = new Map<string, typeof subscriptions[0]>();
  for (const sub of subscriptions) {
    const phone = normalizePhoneNumber(sub.customer_phone);
    if (!phone) continue;
    const existing = phoneMap.get(phone);
    if (!existing || new Date(sub.expiration_date) < new Date(existing.expiration_date)) {
      phoneMap.set(phone, sub);
    }
  }
  const deduplicatedSubs = Array.from(phoneMap.values());

  // Calculate target stage for each subscription
  const eligible: Array<{
    id: string;
    customer_name: string;
    customer_phone: string;
    subscription_type: string;
    expiration_date: string;
    targetStage: 1 | 2;
  }> = [];

  for (const sub of deduplicatedSubs) {
    const expirationDate = new Date(sub.expiration_date);
    const daysUntilExpiry = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const currentStage = sub.reminder_stage || 0;

    let targetStage: 1 | 2 | null = null;

    if (forceMode) {
      targetStage = 2;
    } else {
      if (daysUntilExpiry <= 0 && currentStage < 2) {
        targetStage = 2;
      } else if (daysUntilExpiry <= 2 && daysUntilExpiry > 0 && currentStage < 1) {
        targetStage = 1;
      }
    }

    if (!targetStage) continue;

    // Cooldown check - skip in force mode
    if (!forceMode) {
      const stageTimestampField = targetStage === 1 ? 'stage1_sent_at' : 'stage2_sent_at';
      const lastSentAt = sub[stageTimestampField];
      if (lastSentAt) {
        const lastSent = new Date(lastSentAt);
        const hoursSinceSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        if (hoursSinceSent < 23) continue;
      }
    }

    const normalizedPhone = normalizePhoneNumber(sub.customer_phone);
    if (!normalizedPhone) continue;

    eligible.push({
      id: sub.id,
      customer_name: sub.customer_name || 'عزيزنا العميل',
      customer_phone: sub.customer_phone,
      subscription_type: sub.subscription_type || '',
      expiration_date: sub.expiration_date,
      targetStage,
    });
  }

  return eligible;
}

export async function POST(request: NextRequest) {
  if (!supabaseServiceKey) {
    return NextResponse.json(
      { error: 'خطأ في إعدادات الخادم' },
      { status: 500 }
    );
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // No body or invalid JSON - default to normal mode
  }

  const forceMode = body?.force === true;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Mode 1: List only (no sending) ──
  if (body?.listOnly === true) {
    try {
      const eligible = await getEligibleSubscriptions(supabaseAdmin, forceMode);
      return NextResponse.json({
        success: true,
        eligible,
        total: eligible.length,
      });
    } catch (error: any) {
      console.error('Error fetching eligible subscriptions:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب الاشتراكات', details: error.message },
        { status: 500 }
      );
    }
  }

  // ── Mode 2: Send to a single subscription ──
  if (body?.subscriptionId) {
    try {
      const { subscriptionId, targetStage } = body;

      if (!targetStage || (targetStage !== 1 && targetStage !== 2)) {
        return NextResponse.json(
          { error: 'targetStage مطلوب (1 أو 2)' },
          { status: 400 }
        );
      }

      // Fetch the specific subscription
      const { data: sub, error: fetchError } = await supabaseAdmin
        .from('active_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (fetchError || !sub) {
        return NextResponse.json(
          { error: 'الاشتراك غير موجود', details: fetchError?.message },
          { status: 404 }
        );
      }

      const normalizedPhone = normalizePhoneNumber(sub.customer_phone);
      if (!normalizedPhone) {
        return NextResponse.json({
          success: true,
          sent: 0,
          skipped: 1,
          errors: 0,
          message: 'تم تخطي - رقم هاتف غير صالح',
        });
      }

      // Fetch templates
      const { data: templates } = await supabaseAdmin
        .from('whatsapp_reminder_templates')
        .select('*')
        .eq('is_active', true);

      const templateMap: Record<number, string> = {};
      if (templates) {
        for (const t of templates) {
          templateMap[t.stage] = t.template_body;
        }
      }

      // Fetch category renewal link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mkantvai.com';
      const { data: categoriesData } = await supabaseAdmin
        .from('categories')
        .select('name, renewal_link')
        .eq('is_active', true);

      const categoryRenewalLinks: Record<string, string> = {};
      if (categoriesData) {
        for (const cat of categoriesData) {
          if (cat.renewal_link) {
            categoryRenewalLinks[cat.name] = cat.renewal_link;
          }
        }
      }

      const expirationDate = new Date(sub.expiration_date);
      const expiryDateFormatted = expirationDate.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const renewalLink = categoryRenewalLinks[sub.subscription_type] || `${baseUrl}/subscribe`;

      const result = await sendRenewalReminder({
        phone: normalizedPhone,
        customerName: sub.customer_name || 'عزيزنا العميل',
        productName: sub.subscription_type || 'الاشتراك',
        expiryDate: expiryDateFormatted,
        stage: targetStage,
        templateBody: templateMap[targetStage],
        renewalLink,
        subscriptionType: sub.subscription_type || '',
      });

      const now = new Date();

      if (result.success) {
        const stageTimestampField = targetStage === 1 ? 'stage1_sent_at' : 'stage2_sent_at';
        const updateData: Record<string, any> = {
          reminder_stage: targetStage,
          [stageTimestampField]: now.toISOString(),
          last_contacted_at: now.toISOString(),
          reminder_sent: true,
          reminder_sent_at: now.toISOString(),
          last_reminder_error: null,
        };

        const currentStage = sub.reminder_stage || 0;
        if (targetStage === 2 && currentStage < 1) {
          updateData.stage1_sent_at = now.toISOString();
        }

        await supabaseAdmin
          .from('active_subscriptions')
          .update(updateData)
          .eq('id', sub.id);

        return NextResponse.json({
          success: true,
          sent: 1,
          skipped: 0,
          errors: 0,
          message: `تم إرسال تذكير إلى ${sub.customer_name}`,
        });
      } else {
        await supabaseAdmin
          .from('active_subscriptions')
          .update({ last_reminder_error: result.error || 'Unknown error' })
          .eq('id', sub.id);

        return NextResponse.json({
          success: false,
          sent: 0,
          skipped: 0,
          errors: 1,
          errorDetails: [`${sub.customer_name} (${sub.customer_phone}): ${result.error}`],
          message: `فشل إرسال تذكير إلى ${sub.customer_name}`,
        });
      }
    } catch (error: any) {
      console.error('Error sending single reminder:', error);
      return NextResponse.json(
        { error: 'حدث خطأ غير متوقع', details: error.message },
        { status: 500 }
      );
    }
  }

  // ── Mode 3: Legacy bulk send (fallback) ──
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  try {
    const eligible = await getEligibleSubscriptions(supabaseAdmin, forceMode);

    if (eligible.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        skipped: 0,
        errors: 0,
        message: forceMode
          ? 'لا توجد اشتراكات منتهية لإرسال تذكير لها'
          : 'لا توجد اشتراكات تحتاج إلى تذكير',
      });
    }

    // Fetch templates
    const { data: templates } = await supabaseAdmin
      .from('whatsapp_reminder_templates')
      .select('*')
      .eq('is_active', true);

    const templateMap: Record<number, string> = {};
    if (templates) {
      for (const t of templates) {
        templateMap[t.stage] = t.template_body;
      }
    }

    // Fetch categories
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mkantvai.com';
    const { data: categoriesData } = await supabaseAdmin
      .from('categories')
      .select('name, renewal_link')
      .eq('is_active', true);

    const categoryRenewalLinks: Record<string, string> = {};
    if (categoriesData) {
      for (const cat of categoriesData) {
        if (cat.renewal_link) {
          categoryRenewalLinks[cat.name] = cat.renewal_link;
        }
      }
    }

    const now = new Date();

    for (const item of eligible) {
      try {
        const sub = await supabaseAdmin
          .from('active_subscriptions')
          .select('*')
          .eq('id', item.id)
          .single();

        if (!sub.data) {
          skipped++;
          continue;
        }

        const expirationDate = new Date(sub.data.expiration_date);
        const expiryDateFormatted = expirationDate.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        const renewalLink = categoryRenewalLinks[sub.data.subscription_type] || `${baseUrl}/subscribe`;

        const normalizedPhone = normalizePhoneNumber(sub.data.customer_phone);
        if (!normalizedPhone) {
          skipped++;
          continue;
        }

        const result = await sendRenewalReminder({
          phone: normalizedPhone,
          customerName: sub.data.customer_name || 'عزيزنا العميل',
          productName: sub.data.subscription_type || 'الاشتراك',
          expiryDate: expiryDateFormatted,
          stage: item.targetStage,
          templateBody: templateMap[item.targetStage],
          renewalLink,
          subscriptionType: sub.data.subscription_type || '',
        });

        if (result.success) {
          const stageTimestampField = item.targetStage === 1 ? 'stage1_sent_at' : 'stage2_sent_at';
          const updateData: Record<string, any> = {
            reminder_stage: item.targetStage,
            [stageTimestampField]: now.toISOString(),
            last_contacted_at: now.toISOString(),
            reminder_sent: true,
            reminder_sent_at: now.toISOString(),
            last_reminder_error: null,
          };

          const currentStage = sub.data.reminder_stage || 0;
          if (item.targetStage === 2 && currentStage < 1) {
            updateData.stage1_sent_at = now.toISOString();
          }

          await supabaseAdmin
            .from('active_subscriptions')
            .update(updateData)
            .eq('id', sub.data.id);

          sent++;
        } else {
          await supabaseAdmin
            .from('active_subscriptions')
            .update({ last_reminder_error: result.error || 'Unknown error' })
            .eq('id', sub.data.id);

          errors++;
          errorDetails.push(`${sub.data.customer_name} (${sub.data.customer_phone}): ${result.error}`);
        }

        // Rate limiting: 3 second delay between messages (legacy mode)
        if (sent + errors < eligible.length) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (error: any) {
        errors++;
        errorDetails.push(`${item.customer_name}: ${error.message}`);
        console.error(`Error processing subscription ${item.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      errors,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      message: forceMode
        ? `[إرسال جماعي] تم إرسال ${sent} تذكير للمنتهين، أخطاء: ${errors}`
        : `تم إرسال ${sent} تذكير، تم تخطي ${skipped}، أخطاء: ${errors}`,
    });
  } catch (error: any) {
    console.error('Unexpected error in send-reminders:', error);
    return NextResponse.json(
      {
        error: 'حدث خطأ غير متوقع',
        details: error.message,
        sent,
        skipped,
        errors,
      },
      { status: 500 }
    );
  }
}
