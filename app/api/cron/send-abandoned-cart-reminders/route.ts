import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAbandonedCartReminderEmail } from '@/utils/sendEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Optional: Add authorization header check for cron services
// For Vercel Cron, you can use a secret token
function verifyCronRequest(request: NextRequest): boolean {
  // Check for authorization header (optional security)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  
  // If no secret is set, allow (for development)
  return true;
}

// GET or POST - Send pending reminder emails
export async function GET(request: NextRequest) {
  return handleReminderSending(request);
}

export async function POST(request: NextRequest) {
  return handleReminderSending(request);
}

async function handleReminderSending(request: NextRequest) {
  // Verify request (optional security)
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { error: 'غير مصرح' },
      { status: 401 }
    );
  }

  if (!supabaseServiceKey) {
    return NextResponse.json(
      { error: 'خطأ في إعدادات الخادم' },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  try {
    // Fetch orders that need reminders:
    // - status = 'pending'
    // - contact_status = 'not_contacted' OR NULL (for new orders)
    // - reminder_hours IS NOT NULL
    // - reminder_sent_at IS NULL
    // We'll check the time in JavaScript since Supabase doesn't support complex date arithmetic easily
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .not('reminder_hours', 'is', null)
      .is('reminder_sent_at', null)
      .or('contact_status.is.null,contact_status.eq.not_contacted');

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب الطلبات', details: ordersError.message },
        { status: 500 }
      );
    }

    console.log(`Found ${orders?.length || 0} orders with reminder_hours set`);

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        skipped: 0,
        errors: 0,
        message: 'لا توجد طلبات تحتاج إلى تذكير',
      });
    }

    // Get active email template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('reminder_email_templates')
      .select('*')
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('Error fetching email template:', templateError);
      return NextResponse.json(
        { error: 'لا يوجد قالب بريد إلكتروني نشط. يرجى إنشاء قالب أولاً.' },
        { status: 500 }
      );
    }

    // Process each order
    for (const order of orders) {
      try {
        // Calculate reminder time
        const createdAt = new Date(order.created_at);
        const reminderHours = order.reminder_hours as number;
        const reminderTime = new Date(createdAt.getTime() + reminderHours * 60 * 60 * 1000);
        const now = new Date();

        console.log(`Order ${order.id}: created_at=${order.created_at}, reminder_hours=${reminderHours}, reminder_time=${reminderTime.toISOString()}, now=${now.toISOString()}`);

        // Check if reminder time has passed
        if (now < reminderTime) {
          const timeUntilReminder = Math.ceil((reminderTime.getTime() - now.getTime()) / (1000 * 60 * 60)); // hours
          console.log(`Order ${order.id}: Skipped - reminder time not yet reached (${timeUntilReminder} hours remaining)`);
          skipped++;
          continue;
        }

        // Get order items if it's a cart order
        let productName = order.product_name;
        let cartLink: string | undefined;
        
        if (order.is_cart_order) {
          const { data: orderItems } = await supabaseAdmin
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);
          
          if (orderItems && orderItems.length > 0) {
            productName = orderItems.map((item: any) => item.product_name).join(', ');
            // Generate cart link (you can customize this based on your cart page URL)
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            cartLink = `${baseUrl}/cart`;
          }
        }

        const orderDisplayId = (order as any).order_number || order.id.slice(0, 8).toUpperCase();
        const totalAmount = order.total_amount || order.price;

        console.log(`Sending reminder email for order ${order.id} to ${order.email}`);
        
        // Send reminder email
        await sendAbandonedCartReminderEmail({
          email: order.email,
          name: order.name,
          orderId: orderDisplayId,
          productName: productName,
          totalAmount: parseFloat(totalAmount as any),
          cartLink: cartLink,
          templateTitle: template.title,
          templateBody: template.body,
        });

        console.log(`Email sent successfully for order ${order.id}`);

        // Update reminder_sent_at
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Error updating reminder_sent_at for order ${order.id}:`, updateError);
          throw new Error(`Failed to update reminder_sent_at: ${updateError.message}`);
        }

        console.log(`Successfully updated reminder_sent_at for order ${order.id}`);
        sent++;
      } catch (error: any) {
        errors++;
        errorDetails.push(`Order ${order.id}: ${error.message}`);
        console.error(`Error processing order ${order.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      errors,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      message: `تم إرسال ${sent} تذكير، تم تخطي ${skipped}، وحدثت ${errors} أخطاء`,
    });
  } catch (error: any) {
    console.error('Unexpected error in reminder cron:', error);
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

