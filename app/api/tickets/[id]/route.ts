import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, authenticatedLimiter } from '@/lib/rateLimiter';
import { sendTicketClosedEmail } from '@/utils/sendEmail';

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

// GET - Get ticket details with messages
export async function GET(
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
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get ticket
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

    // Check permission: user can only see their own tickets, admin can see all
    const userIsAdmin = isAdmin(user.email);
    if (!userIsAdmin && ticket.user_email !== user.email) {
      return NextResponse.json(
        { error: 'غير مصرح للوصول إلى هذه التذكرة' },
        { status: 403 }
      );
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching ticket messages:', messagesError);
      return NextResponse.json(
        { error: 'فشل في جلب رسائل التذكرة' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ticket: {
        ...ticket,
        messages: messages || [],
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

// PATCH - Update ticket status (close/reopen)
export async function PATCH(
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
    const body = await request.json();
    const { status } = body;

    if (!status || !['open', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: 'حالة غير صحيحة. يجب أن تكون open أو closed' },
        { status: 400 }
      );
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

    // Check permission: only admin can close tickets, users can close their own
    const userIsAdmin = isAdmin(user.email);
    if (!userIsAdmin && ticket.user_email !== user.email) {
      return NextResponse.json(
        { error: 'غير مصرح لتحديث هذه التذكرة' },
        { status: 403 }
      );
    }

    // Update ticket status
    const { data: updatedTicket, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({ status })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating ticket:', updateError);
      return NextResponse.json(
        { error: 'فشل في تحديث التذكرة' },
        { status: 500 }
      );
    }

    // Send email notification if ticket was closed by admin
    if (status === 'closed' && userIsAdmin) {
      try {
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

        await sendTicketClosedEmail({
          ticketId: ticket.id,
          userName: userName,
          userEmail: ticket.user_email,
          subject: ticket.subject,
        });
      } catch (emailError) {
        console.error('Error sending ticket closed email:', emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

