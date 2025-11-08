import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Helper to get admin user from auth token
async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

// GET - List all user trial requests with purchase status
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم: مفاتيح قاعدة البيانات غير متوفرة' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active', 'expired', 'purchased', 'not_purchased', 'all'
    const search = searchParams.get('search'); // Search by email or trial code

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get all user trial assignments
    let query = supabaseAdmin
      .from('user_trial_assignments')
      .select('*')
      .order('assigned_at', { ascending: false });

    // Apply search filter
    if (search) {
      query = query.or(`user_email.ilike.%${search}%,trial_code.ilike.%${search}%`);
    }

    const { data: assignments, error } = await query;

    if (error) {
      console.error('Error fetching user trial assignments:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في جلب طلبات التجربة' },
        { status: 500 }
      );
    }

    // Get purchase status for each user
    const now = new Date();
    const usersWithStatus = await Promise.all((assignments || []).map(async (assignment: any) => {
      const isExpired = new Date(assignment.expires_at) < now;
      
      // Check if user has purchased
      let hasPurchased = false;
      if (assignment.user_email) {
        const { data: orders } = await supabaseAdmin
          .from('orders')
          .select('id')
          .eq('email', assignment.user_email)
          .in('status', ['paid', 'approved', 'complete'])
          .limit(1);
        
        hasPurchased = (orders && orders.length > 0) || false;
      }

      // Determine status
      let userStatus = 'active';
      if (hasPurchased) {
        userStatus = 'purchased';
      } else if (isExpired) {
        userStatus = 'expired';
      } else {
        userStatus = 'not_purchased';
      }

      return {
        ...assignment,
        is_expired: isExpired,
        has_purchased: hasPurchased,
        status: userStatus,
      };
    }));

    // Filter by status if provided
    let filteredUsers = usersWithStatus;
    if (status && status !== 'all') {
      filteredUsers = usersWithStatus.filter((u: any) => {
        if (status === 'active') return !u.is_expired && !u.has_purchased;
        if (status === 'expired') return u.is_expired;
        if (status === 'purchased') return u.has_purchased;
        if (status === 'not_purchased') return !u.has_purchased;
        return true;
      });
    }

    // Get counts
    const totalCount = usersWithStatus.length;
    const activeCount = usersWithStatus.filter((u: any) => !u.is_expired && !u.has_purchased).length;
    const expiredCount = usersWithStatus.filter((u: any) => u.is_expired).length;
    const purchasedCount = usersWithStatus.filter((u: any) => u.has_purchased).length;
    const notPurchasedCount = usersWithStatus.filter((u: any) => !u.has_purchased).length;

    return NextResponse.json({ 
      users: filteredUsers,
      counts: {
        total: totalCount,
        active: activeCount,
        expired: expiredCount,
        purchased: purchasedCount,
        not_purchased: notPurchasedCount,
      }
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

