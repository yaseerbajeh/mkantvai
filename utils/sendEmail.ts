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

