-- Create reminder email templates table
CREATE TABLE IF NOT EXISTS public.reminder_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for active template lookup
CREATE INDEX IF NOT EXISTS idx_reminder_email_templates_is_active ON public.reminder_email_templates(is_active);

-- Insert default email template with placeholder variables
INSERT INTO public.reminder_email_templates (title, body, is_active)
VALUES (
  'لم تكمل عملية الشراء - {name}',
  '<div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px;">
      <h2 style="color: #333; margin-bottom: 20px;">مرحباً {name}</h2>
      
      <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
        لاحظنا أنك أضفت منتجات إلى سلة التسوق الخاصة بك ولكن لم تكمل عملية الشراء بعد.
      </p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #333; margin-bottom: 15px;">تفاصيل طلبك:</h3>
        
        <div style="margin-bottom: 10px;">
          <strong>رقم الطلب:</strong> {order_id}
        </div>
        
        <div style="margin-bottom: 10px;">
          <strong>المنتج:</strong> {product_name}
        </div>
        
        <div style="margin-bottom: 10px;">
          <strong>المبلغ الإجمالي:</strong> {total_amount} ريال
        </div>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{cart_link}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
          إكمال عملية الشراء
        </a>
      </div>
      
      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        إذا كان لديك أي استفسارات، لا تتردد في التواصل معنا.
      </p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
        مع تحيات فريق مكان TV
      </div>
    </div>
  </div>',
  true
);

-- Enable Row Level Security
ALTER TABLE public.reminder_email_templates ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to manage templates
-- Note: This assumes admins can access through service role key
CREATE POLICY "Admins can manage email templates"
  ON public.reminder_email_templates
  FOR ALL
  USING (true);

