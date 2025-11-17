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

// GET - Fetch all expired subscriptions grouped by subscription_type
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
    
    // Fetch all expired subscriptions
    const { data: expiredSubscriptions, error } = await supabaseAdmin
      .from('expired_subscriptions')
      .select('*')
      .order('expired_at', { ascending: false });

    if (error) {
      console.error('Error fetching expired subscriptions:', error);
      return NextResponse.json(
        { 
          error: 'حدث خطأ أثناء جلب الاشتراكات المنتهية',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Group by subscription_type
    const groupedByType: { [key: string]: any[] } = {};
    
    (expiredSubscriptions || []).forEach((subscription: any) => {
      const type = subscription.subscription_type || 'غير محدد';
      if (!groupedByType[type]) {
        groupedByType[type] = [];
      }
      groupedByType[type].push(subscription);
    });

    return NextResponse.json({ 
      subscriptions: expiredSubscriptions || [],
      groupedByType 
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

