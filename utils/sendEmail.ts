import nodemailer from 'nodemailer';

// HTML escape function to prevent XSS in email templates
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Email configuration from environment variables
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

export interface OrderEmailData {
  orderId: string;
  name: string;
  email: string;
  whatsapp?: string;
  productName: string;
  price: number;
  createdAt: string;
}

export interface ApprovalEmailData {
  orderId: string;
  name: string;
  email: string;
  subscriptionCode: string;
  subscriptionMeta?: any;
}

export interface RejectionEmailData {
  orderId: string;
  name: string;
  email: string;
  productName: string;
}

export interface TrialCodeEmailData {
  email: string;
  trialCode: string;
  expiresAt: string;
  username?: string | null;
  password?: string | null;
  link?: string | null;
}

export interface AbandonedCartReminderData {
  email: string;
  name: string;
  orderId: string;
  productName: string;
  totalAmount: number;
  cartLink?: string;
  templateTitle: string;
  templateBody: string;
}

export interface NewTicketEmailData {
  ticketId: string;
  orderId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
}

export interface TicketResponseEmailData {
  ticketId: string;
  userName: string;
  userEmail: string;
  subject: string;
  adminMessage: string;
}

export interface SubscriptionRefreshEmailData {
  userName: string;
  userEmail: string;
  subscriptionCode: string;
  subscriptionMeta?: any;
  orderId?: string;
}

export interface TicketClosedEmailData {
  ticketId: string;
  userName: string;
  userEmail: string;
  subject: string;
}

/**
 * Send email notification to admin when a new order is created
 */
export async function sendNewOrderEmail(orderData: OrderEmailData): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'maakantv@gmail.com';

  const mailOptions = {
    from: `"مكان TV" <${emailConfig.auth.user}>`,
    to: adminEmail,
    subject: `طلب اشتراك جديد - ${escapeHtml(String(orderData.orderId))}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
          <h2 style="color: #333; margin-bottom: 20px;">طلب اشتراك جديد</h2>
          
          <div style="margin-bottom: 15px;">
            <strong>رقم الطلب:</strong> ${escapeHtml(String(orderData.orderId))}
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>الاسم الكامل:</strong> ${escapeHtml(orderData.name)}
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>البريد الإلكتروني:</strong> ${escapeHtml(orderData.email)}
          </div>
          
          ${orderData.whatsapp ? `
          <div style="margin-bottom: 15px;">
            <strong>رقم الواتساب:</strong> ${escapeHtml(orderData.whatsapp)}
          </div>
          ` : ''}
          
          <div style="margin-bottom: 15px;">
            <strong>اسم المنتج:</strong> ${escapeHtml(orderData.productName)}
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>السعر:</strong> ${escapeHtml(String(orderData.price))} ريال
          </div>
          
          <div style="margin-bottom: 20px;">
            <strong>تاريخ الطلب:</strong> ${new Date(orderData.createdAt).toLocaleString('ar-SA')}
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            يرجى مراجعة الطلب والتحقق من الدفع عبر واتساب قبل الموافقة عليه.
          </div>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`New order email sent to admin for order ${orderData.orderId}`);
  } catch (error) {
    console.error('Error sending new order email:', error);
    throw error;
  }
}

/**
 * Send email to customer when their order is approved
 */
export async function sendApprovalEmail(approvalData: ApprovalEmailData): Promise<void> {
  const mailOptions = {
    from: `"مكان TV" <${emailConfig.auth.user}>`,
    to: approvalData.email,
    subject: `تم قبول طلبك - ${escapeHtml(String(approvalData.orderId))}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">✅ تم قبول طلبك بنجاح!</h2>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            مرحباً ${escapeHtml(approvalData.name)}،
          </p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            نود إعلامك بأن طلبك رقم <strong>${escapeHtml(String(approvalData.orderId))}</strong> قد تم قبوله وتم تفعيل اشتراكك.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">تفاصيل الاشتراك:</h3>
            
            <div style="margin-bottom: 10px;">
              <strong>رمز الاشتراك:</strong> 
              <span style="font-family: monospace; background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-right: 10px;">
                ${escapeHtml(approvalData.subscriptionCode)}
              </span>
            </div>
            
            ${approvalData.subscriptionMeta && approvalData.subscriptionMeta.duration ? `
            <div style="margin-bottom: 10px;">
              <strong>مدة الاشتراك:</strong> ${escapeHtml(String(approvalData.subscriptionMeta.duration))}
            </div>
            ` : ''}
            
            ${approvalData.subscriptionMeta && approvalData.subscriptionMeta.type ? `
            <div style="margin-bottom: 10px;">
              <strong>نوع الاشتراك:</strong> ${escapeHtml(String(approvalData.subscriptionMeta.type))}
            </div>
            ` : ''}
          </div>
          
          <p style="font-size: 16px; color: #333; margin-top: 30px;">
            يمكنك الآن استخدام رمز الاشتراك للوصول إلى جميع المحتويات المتاحة.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            شكراً لثقتك بنا!
          </div>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Approval email sent to ${approvalData.email} for order ${approvalData.orderId}`);
  } catch (error) {
    console.error('Error sending approval email:', error);
    throw error;
  }
}

/**
 * Send email to customer when their order is rejected
 */
export async function sendRejectionEmail(rejectionData: RejectionEmailData): Promise<void> {
  const mailOptions = {
    from: `"مكان TV" <${emailConfig.auth.user}>`,
    to: rejectionData.email,
    subject: `تم رفض طلبك - ${escapeHtml(String(rejectionData.orderId))}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
          <h2 style="color: #dc3545; margin-bottom: 20px;">تم رفض طلبك</h2>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            مرحباً ${escapeHtml(rejectionData.name)}،
          </p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            نأسف لإعلامك بأن طلبك رقم <strong>${escapeHtml(String(rejectionData.orderId))}</strong> للمنتج <strong>${escapeHtml(rejectionData.productName)}</strong> قد تم رفضه.
          </p>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #ffc107;">
            <p style="color: #856404; margin: 0;">
              <strong>ملاحظة:</strong> إذا كان لديك أي استفسارات أو ترغب في إعادة تقديم الطلب، يرجى التواصل معنا عبر واتساب.
            </p>
          </div>
          
          <p style="font-size: 16px; color: #333; margin-top: 30px;">
            نشكرك لاهتمامك بخدماتنا ونأمل أن نتمكن من خدمتك في المستقبل.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            مع تحيات فريق مكان TV
          </div>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Rejection email sent to ${rejectionData.email} for order ${rejectionData.orderId}`);
  } catch (error) {
    console.error('Error sending rejection email:', error);
    throw error;
  }
}

/**
 * Send trial code email to user
 */
export async function sendTrialCodeEmail(trialData: TrialCodeEmailData): Promise<void> {
  const expiresAtDate = new Date(trialData.expiresAt);
  const formattedExpiresAt = expiresAtDate.toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Build credentials section if available
  let credentialsSection = '';
  if (trialData.username || trialData.password || trialData.link) {
    credentialsSection = `
      <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #2196F3;">
        <h3 style="color: #1976D2; margin-top: 0; margin-bottom: 15px;">معلومات الدخول:</h3>
        ${trialData.username ? `
          <div style="margin-bottom: 12px;">
            <strong style="color: #333; display: block; margin-bottom: 5px;">اسم المستخدم:</strong>
            <span style="font-family: monospace; font-size: 16px; background-color: white; padding: 8px 12px; border-radius: 4px; display: inline-block; color: #1976D2;">
              ${escapeHtml(trialData.username)}
            </span>
          </div>
        ` : ''}
        ${trialData.password ? `
          <div style="margin-bottom: 12px;">
            <strong style="color: #333; display: block; margin-bottom: 5px;">كلمة المرور:</strong>
            <span style="font-family: monospace; font-size: 16px; background-color: white; padding: 8px 12px; border-radius: 4px; display: inline-block; color: #1976D2;">
              ${escapeHtml(trialData.password)}
            </span>
          </div>
        ` : ''}
        ${trialData.link ? `
          <div style="margin-bottom: 12px;">
            <strong style="color: #333; display: block; margin-bottom: 5px;">الرابط:</strong>
            <a href="${escapeHtml(trialData.link)}" style="font-size: 16px; color: #1976D2; text-decoration: underline; word-break: break-all;">
              ${escapeHtml(trialData.link)}
            </a>
          </div>
        ` : ''}
      </div>
    `;
  }

  const mailOptions = {
    from: `"مكان TV" <${emailConfig.auth.user}>`,
    to: trialData.email,
    subject: 'رمز التجربة المجانية الخاص بك',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">✅ رمز التجربة المجانية</h2>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            مرحباً،
          </p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            شكراً لاهتمامك بخدماتنا! إليك رمز التجربة المجانية الخاص بك:
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <div style="margin-bottom: 15px;">
              <strong style="display: block; margin-bottom: 10px; color: #333;">رمز التجربة:</strong>
              <span style="font-family: monospace; font-size: 24px; font-weight: bold; background-color: #e9ecef; padding: 15px 20px; border-radius: 8px; display: inline-block; color: #28a745; letter-spacing: 2px;">
                ${escapeHtml(trialData.trialCode)}
              </span>
            </div>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <div style="margin-bottom: 10px;">
                <strong>مدة التجربة:</strong> 3 ساعات
              </div>
              <div style="margin-bottom: 10px;">
                <strong>تاريخ الانتهاء:</strong> ${escapeHtml(formattedExpiresAt)}
              </div>
            </div>
          </div>
          
          ${credentialsSection}
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #ffc107;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>ملاحظة مهمة:</strong> يمكنك استخدام هذا الرمز لمدة 3 ساعات من تاريخ الطلب. بعد انتهاء المدة، لن يكون الرمز صالحاً للاستخدام.
            </p>
          </div>
          
          <p style="font-size: 16px; color: #333; margin-top: 30px;">
            نتمنى لك تجربة ممتعة مع خدماتنا!
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            مع تحيات فريق مكان TV
          </div>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Trial code email sent to ${trialData.email}`);
  } catch (error) {
    console.error('Error sending trial code email:', error);
    throw error;
  }
}

/**
 * Send abandoned cart reminder email to customer
 * Replaces template variables in title and body
 */
export async function sendAbandonedCartReminderEmail(data: AbandonedCartReminderData): Promise<void> {
  // Replace template variables in title and body
  let emailTitle = data.templateTitle;
  let emailBody = data.templateBody;

  // Replace variables
  emailTitle = emailTitle.replace(/{name}/g, escapeHtml(data.name));
  emailTitle = emailTitle.replace(/{order_id}/g, escapeHtml(data.orderId));
  emailTitle = emailTitle.replace(/{product_name}/g, escapeHtml(data.productName));
  emailTitle = emailTitle.replace(/{total_amount}/g, escapeHtml(String(data.totalAmount)));
  emailTitle = emailTitle.replace(/{cart_link}/g, data.cartLink || '#');

  emailBody = emailBody.replace(/{name}/g, escapeHtml(data.name));
  emailBody = emailBody.replace(/{order_id}/g, escapeHtml(data.orderId));
  emailBody = emailBody.replace(/{product_name}/g, escapeHtml(data.productName));
  emailBody = emailBody.replace(/{total_amount}/g, escapeHtml(String(data.totalAmount)));
  emailBody = emailBody.replace(/{cart_link}/g, data.cartLink || '#');

  const mailOptions = {
    from: `"مكان TV" <${emailConfig.auth.user}>`,
    to: data.email,
    subject: emailTitle,
    html: emailBody,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Abandoned cart reminder email sent to ${data.email} for order ${data.orderId}`);
  } catch (error) {
    console.error('Error sending abandoned cart reminder email:', error);
    throw error;
  }
}

/**
 * Send email notification to admin when a new ticket is created
 */
export async function sendNewTicketEmail(data: NewTicketEmailData): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'maakantv@gmail.com';
  
  console.log('[sendNewTicketEmail] Starting email send...');
  console.log('[sendNewTicketEmail] Admin email:', adminEmail);
  console.log('[sendNewTicketEmail] SMTP_USER:', emailConfig.auth.user ? 'Set' : 'NOT SET');
  console.log('[sendNewTicketEmail] SMTP_PASSWORD:', emailConfig.auth.pass ? 'Set' : 'NOT SET');
  console.log('[sendNewTicketEmail] SMTP_HOST:', emailConfig.host);
  console.log('[sendNewTicketEmail] SMTP_PORT:', emailConfig.port);

  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    const error = new Error('SMTP credentials not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables.');
    console.error('[sendNewTicketEmail] Configuration error:', error.message);
    throw error;
  }

  const mailOptions = {
    from: `"مكان TV" <${emailConfig.auth.user}>`,
    to: adminEmail,
    subject: `تذكرة دعم جديدة - ${escapeHtml(data.subject)}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
          <h2 style="color: #333; margin-bottom: 20px;">تذكرة دعم جديدة</h2>
          
          <div style="margin-bottom: 15px;">
            <strong>رقم التذكرة:</strong> ${escapeHtml(data.ticketId.slice(0, 8).toUpperCase())}
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>رقم الطلب:</strong> ${escapeHtml(data.orderId.slice(0, 8).toUpperCase())}
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>اسم العميل:</strong> ${escapeHtml(data.userName)}
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>البريد الإلكتروني:</strong> ${escapeHtml(data.userEmail)}
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong>الموضوع:</strong> ${escapeHtml(data.subject)}
          </div>
          
          <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-right: 4px solid #007bff;">
            <strong>الرسالة:</strong>
            <p style="margin-top: 10px; color: #333; white-space: pre-wrap;">${escapeHtml(data.message || 'لا توجد رسالة نصية')}</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            يرجى الرد على التذكرة من خلال لوحة الإدارة.
          </div>
        </div>
      </div>
    `,
  };

  try {
    console.log('[sendNewTicketEmail] Attempting to send email...');
    const result = await transporter.sendMail(mailOptions);
    console.log('[sendNewTicketEmail] Email sent successfully!');
    console.log('[sendNewTicketEmail] Message ID:', result.messageId);
    console.log(`[sendNewTicketEmail] New ticket email sent to admin (${adminEmail}) for ticket ${data.ticketId}`);
  } catch (error: any) {
    console.error('[sendNewTicketEmail] Error sending email:', error);
    console.error('[sendNewTicketEmail] Error code:', error.code);
    console.error('[sendNewTicketEmail] Error response:', error.response);
    console.error('[sendNewTicketEmail] Error command:', error.command);
    throw error;
  }
}

/**
 * Send email notification to user when admin responds to their ticket
 */
export async function sendTicketResponseEmail(data: TicketResponseEmailData): Promise<void> {
  const mailOptions = {
    from: `"مكان TV" <${emailConfig.auth.user}>`,
    to: data.userEmail,
    subject: `رد على تذكرة الدعم - ${escapeHtml(data.subject)}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">تم الرد على تذكرة الدعم</h2>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            مرحباً ${escapeHtml(data.userName)}،
          </p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            تم الرد على تذكرة الدعم الخاصة بك بخصوص: <strong>${escapeHtml(data.subject)}</strong>
          </p>
          
          <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-right: 4px solid #28a745;">
            <strong>الرد:</strong>
            <p style="margin-top: 10px; color: #333; white-space: pre-wrap;">${escapeHtml(data.adminMessage)}</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            يمكنك متابعة المحادثة من خلال صفحة طلباتي.
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            مع تحيات فريق مكان TV
          </div>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Ticket response email sent to ${data.userEmail} for ticket ${data.ticketId}`);
  } catch (error) {
    console.error('Error sending ticket response email:', error);
    throw error;
  }
}

/**
 * Send email notification to user when their subscription is refreshed
 */
export async function sendSubscriptionRefreshEmail(data: SubscriptionRefreshEmailData): Promise<void> {
  const mailOptions = {
    from: `"مكان TV" <${emailConfig.auth.user}>`,
    to: data.userEmail,
    subject: 'تم تحديث اشتراكك',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">✅ تم تحديث اشتراكك</h2>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            مرحباً ${escapeHtml(data.userName)}،
          </p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            تم تحديث اشتراكك بنجاح. إليك رمز الاشتراك الجديد:
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <div style="margin-bottom: 15px;">
              <strong style="display: block; margin-bottom: 10px; color: #333;">رمز الاشتراك الجديد:</strong>
              <span style="font-family: monospace; font-size: 24px; font-weight: bold; background-color: #e9ecef; padding: 15px 20px; border-radius: 8px; display: inline-block; color: #28a745; letter-spacing: 2px;">
                ${escapeHtml(data.subscriptionCode)}
              </span>
            </div>
          </div>
          
          ${data.subscriptionMeta && data.subscriptionMeta.duration ? `
          <div style="margin-bottom: 15px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
            <strong>مدة الاشتراك:</strong> ${escapeHtml(String(data.subscriptionMeta.duration))}
          </div>
          ` : ''}
          
          ${data.subscriptionMeta && data.subscriptionMeta.type ? `
          <div style="margin-bottom: 15px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
            <strong>نوع الاشتراك:</strong> ${escapeHtml(String(data.subscriptionMeta.type))}
          </div>
          ` : ''}
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #ffc107;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>ملاحظة مهمة:</strong> يرجى استخدام رمز الاشتراك الجديد. الرمز القديم لم يعد صالحاً.
            </p>
          </div>
          
          <p style="font-size: 16px; color: #333; margin-top: 30px;">
            يمكنك الآن استخدام رمز الاشتراك الجديد للوصول إلى جميع المحتويات المتاحة.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            شكراً لثقتك بنا!
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            مع تحيات فريق مكان TV
          </div>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Subscription refresh email sent to ${data.userEmail}`);
  } catch (error) {
    console.error('Error sending subscription refresh email:', error);
    throw error;
  }
}

/**
 * Send email notification to user when their ticket is closed
 */
export async function sendTicketClosedEmail(data: TicketClosedEmailData): Promise<void> {
  const mailOptions = {
    from: `"مكان TV" <${emailConfig.auth.user}>`,
    to: data.userEmail,
    subject: `تم إغلاق تذكرة الدعم - ${escapeHtml(data.subject)}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
          <h2 style="color: #6c757d; margin-bottom: 20px;">تم إغلاق تذكرة الدعم</h2>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            مرحباً ${escapeHtml(data.userName)}،
          </p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            تم إغلاق تذكرة الدعم الخاصة بك بخصوص: <strong>${escapeHtml(data.subject)}</strong>
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #6c757d;">
            <p style="color: #333; margin: 0;">
              إذا كان لديك أي استفسارات إضافية، يمكنك فتح تذكرة دعم جديدة من خلال صفحة طلباتك.
            </p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            شكراً لاستخدامك خدماتنا!
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            مع تحيات فريق مكان TV
          </div>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Ticket closed email sent to ${data.userEmail} for ticket ${data.ticketId}`);
  } catch (error) {
    console.error('Error sending ticket closed email:', error);
    throw error;
  }
}

