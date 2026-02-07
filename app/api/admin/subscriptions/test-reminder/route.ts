import { NextRequest, NextResponse } from 'next/server';
import { sendRenewalReminder } from '@/utils/sendWhatsApp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, customerName, subscriptionType, expiryDate, renewalLink, templateBody } = body;

    if (!phone) {
      return NextResponse.json({ error: 'يرجى إدخال رقم الهاتف' }, { status: 400 });
    }

    const result = await sendRenewalReminder({
      phone,
      customerName: customerName || 'عميل تجريبي',
      productName: subscriptionType || 'اشتراكات IPTV',
      expiryDate: expiryDate || new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
      stage: 2,
      templateBody: templateBody || undefined,
      renewalLink: renewalLink || 'https://mkantvai.com/subscribe',
      subscriptionType: subscriptionType || 'اشتراكات IPTV',
    });

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
