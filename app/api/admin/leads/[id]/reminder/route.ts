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

// POST - Set/update reminder date
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
    const { reminder_date } = body;

    // Validate date if provided
    if (reminder_date && isNaN(Date.parse(reminder_date))) {
      return NextResponse.json(
        { error: 'تاريخ التذكير غير صحيح' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: updatedLead, error } = await supabaseAdmin
      .from('crm_leads')
      .update({
        reminder_date: reminder_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating reminder:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء تحديث التذكير' },
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

// GET - Get leads with upcoming reminders (optional utility endpoint)
export async function GET(request: NextRequest) {
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();
    
    // Get leads with reminders in the next 7 days
    const { data: leads, error } = await supabaseAdmin
      .from('crm_leads')
      .select('*')
      .not('reminder_date', 'is', null)
      .gte('reminder_date', now)
      .lte('reminder_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('reminder_date', { ascending: true });

    if (error) {
      console.error('Error fetching reminders:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب التذكيرات' },
        { status: 500 }
      );
    }

    return NextResponse.json({ leads: leads || [] });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

