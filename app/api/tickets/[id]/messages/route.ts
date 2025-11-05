import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, authenticatedLimiter } from '@/lib/rateLimiter';
import { sendTicketResponseEmail, sendNewTicketEmail } from '@/utils/sendEmail';

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

// POST - Add message to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const ticketId = params.id;
    
    // Handle both JSON and FormData (for file uploads)
    let message = '';
    let imageUrl: string | null = null;
    
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData with file upload
      const formData = await request.formData();
      message = formData.get('message') as string || '';
      const imageFile = formData.get('image') as File | null;
      
      if (!message.trim() && !imageFile) {
        return NextResponse.json(
          { error: 'يجب توفير رسالة أو صورة' },
          { status: 400 }
        );
      }
      
      // Upload image to Supabase Storage if provided
      if (imageFile) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        // Generate unique filename
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
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
          return NextResponse.json(
            { error: 'فشل في رفع الصورة' },
            { status: 500 }
          );
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('ticket-images')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }
    } else {
      // Handle JSON (text only)
      const body = await request.json();
      message = body.message || '';
      
      if (!message || message.trim().length === 0) {
        return NextResponse.json(
          { error: 'يجب توفير رسالة' },
          { status: 400 }
        );
      }
      
      // Allow image_url to be passed directly for compatibility
      imageUrl = body.image_url || null;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get ticket first to check permissions
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'التذكرة غير موجودة' },
        { status: 404 }
      );
    }

    // Check permission: user can only message their own tickets, admin can message all
    const userIsAdmin = isAdmin(user.email);
    if (!userIsAdmin && ticket.user_email !== user.email) {
      return NextResponse.json(
        { error: 'غير مصرح لإرسال رسالة في هذه التذكرة' },
        { status: 403 }
      );
    }

    // Check if ticket is closed
    if (ticket.status === 'closed') {
      return NextResponse.json(
        { error: 'التذكرة مغلقة. لا يمكن إضافة رسائل جديدة' },
        { status: 400 }
      );
    }

    // Determine sender type
    const senderType = userIsAdmin ? 'admin' : 'user';

    // Add message
    const { data: ticketMessage, error: messageError } = await supabaseAdmin
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_email: user.email,
        sender_type: senderType,
        message: message.trim() || '', // Allow empty message if only image
        image_url: imageUrl,
      })
      .select()
      .single();

    if (messageError || !ticketMessage) {
      console.error('Error creating ticket message:', messageError);
      return NextResponse.json(
        { error: 'فشل في إرسال الرسالة' },
        { status: 500 }
      );
    }

    // Send email notification
    try {
      if (userIsAdmin) {
        // Admin responded - notify user
        // Get user name from order if available
        let userName = ticket.user_email;
        if (ticket.order_id) {
          const { data: order } = await supabaseAdmin
            .from('orders')
            .select('name')
            .eq('id', ticket.order_id)
            .single();
          if (order?.name) {
            userName = order.name;
          }
        }

        await sendTicketResponseEmail({
          ticketId: ticket.id,
          userName: userName,
          userEmail: ticket.user_email,
          adminMessage: message.trim(),
          subject: ticket.subject,
        });
      } else {
        // User responded - notify admin
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('name')
          .eq('id', ticket.order_id)
          .single();

        await sendNewTicketEmail({
          ticketId: ticket.id,
          orderId: ticket.order_id || '',
          userName: order?.name || ticket.user_email,
          userEmail: ticket.user_email,
          subject: ticket.subject,
          message: message.trim(),
        });
      }
    } catch (emailError) {
      console.error('Error sending ticket notification email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: ticketMessage,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

