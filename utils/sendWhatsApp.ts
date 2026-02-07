/**
 * WhatsApp messaging utility via Evolution API
 * Mirrors the pattern of sendEmail.ts
 */

// Evolution API configuration from environment variables
const evolutionConfig = {
  apiUrl: process.env.EVOLUTION_API_URL,
  apiKey: process.env.EVOLUTION_API_KEY,
  instanceName: process.env.EVOLUTION_INSTANCE_NAME,
};

/**
 * Normalize phone number - remove all non-digit characters
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/[^0-9]/g, '');
  return normalized || null;
}

export interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface RenewalReminderParams {
  phone: string;
  customerName: string;
  productName: string;
  expiryDate: string;
  stage: 1 | 2;
  templateBody?: string;
  renewalLink?: string;
}

/**
 * Send a WhatsApp text message via Evolution API
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<WhatsAppMessageResult> {
  const { apiUrl, apiKey, instanceName } = evolutionConfig;

  if (!apiUrl || !apiKey || !instanceName) {
    return {
      success: false,
      error: 'Evolution API not configured. Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME.',
    };
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    return { success: false, error: 'Invalid phone number' };
  }

  try {
    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Evolution API error:', response.status, errorBody);
      return {
        success: false,
        error: `Evolution API returned ${response.status}: ${errorBody}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data?.key?.id || data?.messageId || undefined,
    };
  } catch (error: any) {
    console.error('Failed to send WhatsApp message:', error);
    return {
      success: false,
      error: error.message || 'Network error sending WhatsApp message',
    };
  }
}

/**
 * Replace template variables with actual values
 */
function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Send a subscription renewal reminder via WhatsApp
 */
export async function sendRenewalReminder(
  params: RenewalReminderParams
): Promise<WhatsAppMessageResult> {
  const { phone, customerName, productName, expiryDate, stage, templateBody, renewalLink } = params;

  // Default templates if none provided from DB
  const defaultTemplates: Record<1 | 2, string> = {
    1: `مرحباً ${customerName} 👋\nاشتراكك في ${productName} سينتهي خلال يومين (${expiryDate}).\nجدد الآن لتستمر بالاستمتاع بالخدمة بدون انقطاع ✨${renewalLink ? `\nللتجديد: ${renewalLink}` : ''}`,
    2: `مرحباً ${customerName}\nنود إعلامك بأن اشتراكك في ${productName} قد انتهى اليوم (${expiryDate}).\n${renewalLink ? `يمكنك تجديد اشتراكك من هنا: ${renewalLink}\n` : ''}نتمنى عودتك قريباً! 🙏`,
  };

  let message: string;

  if (templateBody) {
    message = replaceTemplateVariables(templateBody, {
      name: customerName,
      product: productName,
      expiry_date: expiryDate,
      renewal_link: renewalLink || '',
    });
  } else {
    message = defaultTemplates[stage];
  }

  return sendWhatsAppMessage(phone, message);
}
