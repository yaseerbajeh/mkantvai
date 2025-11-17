import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get admin user from auth token
async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return null;
  }

  const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
  
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

// POST - Update lead status with timestamp tracking
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !['new', 'contacted', 'client thinking about it', 'converted', 'lost', 'non_converted'].includes(status)) {
      return NextResponse.json(
        { error: 'حالة غير صحيحة' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get current lead to check importance
    const { data: currentLead } = await supabaseAdmin
      .from('crm_leads')
      .select('importance')
      .eq('id', params.id)
      .single();

    // Build update object with timestamp tracking
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Auto-downgrade urgent to medium when status changes to contacted
    if (status === 'contacted' && currentLead?.importance === 'urgent') {
      updateData.importance = 'medium';
    }

    // Set appropriate timestamp based on status
    if (status === 'converted') {
      updateData.converted_at = new Date().toISOString();
      // Clear non_converted_at if it was set
      updateData.non_converted_at = null;
    } else if (status === 'non_converted') {
      updateData.non_converted_at = new Date().toISOString();
      // Clear converted_at if it was set
      updateData.converted_at = null;
    } else {
      // For other statuses, clear both timestamps
      updateData.converted_at = null;
      updateData.non_converted_at = null;
    }

    const { data: updatedLead, error } = await supabaseAdmin
      .from('crm_leads')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead status:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء تحديث حالة العميل المحتمل' },
        { status: 500 }
      );
    }

    return NextResponse.json({ lead: updatedLead });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

