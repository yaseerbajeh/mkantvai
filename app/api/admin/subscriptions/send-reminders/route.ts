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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  try {
    // Fetch all active subscriptions that might need reminders
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from('active_subscriptions')
      .select('*')
      .not('customer_phone', 'is', null)
      .eq('whatsapp_opt_out', false)
      .lt('reminder_stage', 2)
      .order('expiration_date', { ascending: true });

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
        message: 'لا توجد اشتراكات تحتاج إلى تذكير',
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

    const now = new Date();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mkantvai.com';

    for (const sub of subscriptions) {
      try {
        const expirationDate = new Date(sub.expiration_date);
        const daysUntilExpiry = Math.ceil(
          (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const currentStage = sub.reminder_stage || 0;

        // Determine which stage to send
        let targetStage: 1 | 2 | null = null;

        if (daysUntilExpiry <= 0 && currentStage < 2) {
          // Expired or expiring today -> stage 2
          targetStage = 2;
        } else if (daysUntilExpiry <= 2 && daysUntilExpiry > 0 && currentStage < 1) {
          // 2 days or less before expiry -> stage 1
          targetStage = 1;
        }

        if (!targetStage) {
          skipped++;
          continue;
        }

        // Check if this specific stage was already sent today (cooldown)
        const stageTimestampField = targetStage === 1 ? 'stage1_sent_at' : 'stage2_sent_at';
        const lastSentAt = sub[stageTimestampField];
        if (lastSentAt) {
          const lastSent = new Date(lastSentAt);
          const hoursSinceSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
          if (hoursSinceSent < 23) {
            // Already sent within the last 23 hours
            skipped++;
            continue;
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

        const renewalLink = `${baseUrl}/subscribe`;

        const result = await sendRenewalReminder({
          phone: normalizedPhone,
          customerName: sub.customer_name || 'عزيزنا العميل',
          productName: sub.subscription_type || 'الاشتراك',
          expiryDate: expiryDateFormatted,
          stage: targetStage,
          templateBody: templateMap[targetStage],
          renewalLink,
        });

        if (result.success) {
          // Update subscription with new stage
          const updateData: Record<string, any> = {
            reminder_stage: targetStage,
            [stageTimestampField]: now.toISOString(),
            last_contacted_at: now.toISOString(),
            reminder_sent: true,
            reminder_sent_at: now.toISOString(),
            last_reminder_error: null,
          };

          // If going from stage 1 to stage 2, also keep stage1 data
          if (targetStage === 2 && currentStage < 1) {
            updateData.stage1_sent_at = now.toISOString();
          }

          await supabaseAdmin
            .from('active_subscriptions')
            .update(updateData)
            .eq('id', sub.id);

          sent++;
        } else {
          // Store error but don't advance stage
          await supabaseAdmin
            .from('active_subscriptions')
            .update({ last_reminder_error: result.error || 'Unknown error' })
            .eq('id', sub.id);

          errors++;
          errorDetails.push(`${sub.customer_name} (${sub.customer_phone}): ${result.error}`);
        }

        // Rate limiting: 3 second delay between messages
        if (sent + errors < subscriptions.length) {
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
      message: `تم إرسال ${sent} تذكير، تم تخطي ${skipped}، أخطاء: ${errors}`,
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
