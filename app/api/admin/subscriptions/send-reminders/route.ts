import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendRenewalReminder, normalizePhoneNumber } from '@/utils/sendWhatsApp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  if (!supabaseServiceKey) {
    return NextResponse.json(
      { error: 'خطأ في إعدادات الخادم' },
      { status: 500 }
    );
  }

  // Parse request body for optional force flag
  let forceMode = false;
  try {
    const body = await request.json();
    forceMode = body?.force === true;
  } catch {
    // No body or invalid JSON - default to normal mode
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  try {
    // Build subscription query based on mode
    let query = supabaseAdmin
      .from('active_subscriptions')
      .select('*')
      .not('customer_phone', 'is', null)
      .eq('whatsapp_opt_out', false)
      .order('expiration_date', { ascending: true });

    if (forceMode) {
      // Force mode: get ALL expired subscriptions regardless of stage
      query = query.lte('expiration_date', new Date().toISOString());
    } else {
      // Normal mode: only those not yet at stage 2
      query = query.lt('reminder_stage', 2);
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب الاشتراكات', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
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

    // Fetch active WhatsApp templates
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

    // Fetch categories with renewal_link for per-type links
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mkantvai.com';

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

    for (const sub of deduplicatedSubs) {
      try {
        const expirationDate = new Date(sub.expiration_date);
        const daysUntilExpiry = Math.ceil(
          (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const currentStage = sub.reminder_stage || 0;

        // Determine which stage to send
        let targetStage: 1 | 2 | null = null;

        if (forceMode) {
          // Force mode: always send stage 2 to all expired subs
          targetStage = 2;
        } else {
          if (daysUntilExpiry <= 0 && currentStage < 2) {
            targetStage = 2;
          } else if (daysUntilExpiry <= 2 && daysUntilExpiry > 0 && currentStage < 1) {
            targetStage = 1;
          }
        }

        if (!targetStage) {
          skipped++;
          continue;
        }

        // Cooldown check - skip in force mode
        if (!forceMode) {
          const stageTimestampField = targetStage === 1 ? 'stage1_sent_at' : 'stage2_sent_at';
          const lastSentAt = sub[stageTimestampField];
          if (lastSentAt) {
            const lastSent = new Date(lastSentAt);
            const hoursSinceSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
            if (hoursSinceSent < 23) {
              skipped++;
              continue;
            }
          }
        }

        const normalizedPhone = normalizePhoneNumber(sub.customer_phone);
        if (!normalizedPhone) {
          skipped++;
          continue;
        }

        const expiryDateFormatted = expirationDate.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        // Per-type renewal link: look up by category name, fall back to default
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

          if (targetStage === 2 && currentStage < 1) {
            updateData.stage1_sent_at = now.toISOString();
          }

          await supabaseAdmin
            .from('active_subscriptions')
            .update(updateData)
            .eq('id', sub.id);

          sent++;
        } else {
          await supabaseAdmin
            .from('active_subscriptions')
            .update({ last_reminder_error: result.error || 'Unknown error' })
            .eq('id', sub.id);

          errors++;
          errorDetails.push(`${sub.customer_name} (${sub.customer_phone}): ${result.error}`);
        }

        // Rate limiting: 3 second delay between messages
        if (sent + errors < deduplicatedSubs.length) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (error: any) {
        errors++;
        errorDetails.push(`${sub.customer_name}: ${error.message}`);
        console.error(`Error processing subscription ${sub.id}:`, error);
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
