import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, authenticatedLimiter } from '@/lib/rateLimiter';
import { sendNewTicketEmail } from '@/utils/sendEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get authenticated user
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  return user;
}

// Helper to check if user is admin
function isAdmin(userEmail: string | undefined): boolean {
  if (!userEmail) return false;
  // Check both ADMIN_EMAILS and NEXT_PUBLIC_ADMIN_EMAILS for compatibility
  const adminEmailsEnv = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const adminEmails = adminEmailsEnv.split(',').map(e => e.trim()).filter(e => e.length > 0);
  if (adminEmails.length === 0) return false;
  return adminEmails.includes(userEmail.toLowerCase());
}

// POST - Create new ticket
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    // Handle both JSON and FormData (for file uploads)
    let order_id: string | null = null;
    let subject = '';
    let message = '';
    let imageFile: File | null = null;
    let imageUrl: string | null = null;
    
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData with file upload
      const formData = await request.formData();
      order_id = formData.get('order_id') as string || null;
      if (order_id === '') order_id = null; // Convert empty string to null
      subject = formData.get('subject') as string || '';
      message = formData.get('message') as string || '';
      imageFile = formData.get('image') as File | null;
      
      if (!subject || (!message && !imageFile)) {
        return NextResponse.json(
          { error: 'يرجى توفير subject و message أو صورة' },
          { status: 400 }
        );
      }
    } else {
      // Handle JSON (text only)
      const body = await request.json();
      order_id = body.order_id || null;
      subject = body.subject || '';
      message = body.message || '';
      
      if (!subject || !message) {
        return NextResponse.json(
          { error: 'يرجى توفير subject و message' },
          { status: 400 }
        );
      }
      
      // Allow image_url to be passed directly for compatibility
      imageUrl = body.image_url || null;
    }

    // Verify order belongs to user (if order_id is provided)
    if (order_id) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: request.headers.get('authorization') || '',
          },
        },
      });

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .eq('email', user.email)
        .single();

      if (orderError || !order) {
        return NextResponse.json(
          { error: 'الطلب غير موجود أو غير مملوك لك' },
          { status: 404 }
        );
      }

      // Check if order is approved or paid
      if (order.status !== 'approved' && order.status !== 'paid') {
        return NextResponse.json(
          { error: 'يمكن فتح تذكرة فقط للطلبات المعتمدة أو المدفوعة' },
          { status: 400 }
        );
      }
    }

    // Create ticket using service role to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert({
        order_id: order_id || null, // Allow null for general tickets
        user_email: user.email,
        subject,
        status: 'open',
      })
      .select()
      .single();

    if (ticketError || !ticket) {
      console.error('Error creating ticket:', ticketError);
      return NextResponse.json(
        { error: 'فشل في إنشاء التذكرة' },
        { status: 500 }
      );
    }

    // Upload image to Supabase Storage if provided (after ticket creation)
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Convert File to ArrayBuffer
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('ticket-images')
        .upload(fileName, buffer, {
          contentType: imageFile.type,
          upsert: false,
        });
      
      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        // Don't fail the ticket creation, just log the error
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('ticket-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }
    }

    // Add initial message
    const { data: ticketMessage, error: messageError } = await supabaseAdmin
      .from('ticket_messages')
      .insert({
        ticket_id: ticket.id,
        sender_email: user.email,
        sender_type: 'user',
        message: message || '', // Allow empty message if only image
        image_url: imageUrl,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating ticket message:', messageError);
      // Delete ticket if message creation failed
      await supabaseAdmin.from('tickets').delete().eq('id', ticket.id);
      return NextResponse.json(
        { error: 'فشل في إنشاء رسالة التذكرة' },
        { status: 500 }
      );
    }

    // Send email notification to admin
    try {
      // Get order details if order_id exists
      let orderName = user.email;
      let orderDisplayId = '';
      
      if (order_id) {
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('name, id')
          .eq('id', order_id)
          .single();
        
        if (order) {
          orderName = order.name;
          orderDisplayId = order.id;
        }
      }

      await sendNewTicketEmail({
        ticketId: ticket.id,
        orderId: orderDisplayId || ticket.id, // Use ticket ID as fallback
        userName: orderName,
        userEmail: user.email,
        subject,
        message,
      });
    } catch (emailError) {
      console.error('Error sending ticket notification email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      ticket: {
        ...ticket,
        messages: [ticketMessage],
      },
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// GET - List tickets (users see their own, admins see all)
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const userIsAdmin = isAdmin(user.email);

    // Build query
    let query = supabaseAdmin
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by user email if not admin
    if (!userIsAdmin) {
      query = query.eq('user_email', user.email);
    }

    const { data: tickets, error } = await query;

    if (error) {
      console.error('Error fetching tickets:', error);
      return NextResponse.json(
        { error: 'فشل في جلب التذاكر' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tickets: tickets || [],
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

