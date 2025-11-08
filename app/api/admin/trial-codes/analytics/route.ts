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

// GET - Get analytics data
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get all user trial assignments
    let query = supabaseAdmin
      .from('user_trial_assignments')
      .select('*');

    // Apply date filter if provided
    if (startDate) {
      query = query.gte('assigned_at', startDate);
    }
    if (endDate) {
      query = query.lte('assigned_at', endDate);
    }

    const { data: assignments, error } = await query;

    if (error) {
      console.error('Error fetching trial assignments:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في جلب بيانات التحليلات' },
        { status: 500 }
      );
    }

    const now = new Date();

    // Calculate statistics
    const totalRequests = assignments?.length || 0;
    let purchasedCount = 0;
    let notPurchasedCount = 0;

    // Check purchase status for each user
    const purchaseChecks = await Promise.all((assignments || []).map(async (assignment: any) => {
      if (!assignment.user_email) return false;
      
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('email', assignment.user_email)
        .in('status', ['paid', 'approved', 'complete'])
        .limit(1);
      
      return (orders && orders.length > 0) || false;
    }));

    purchaseChecks.forEach((hasPurchased) => {
      if (hasPurchased) {
        purchasedCount++;
      } else {
        notPurchasedCount++;
      }
    });

    const conversionRate = totalRequests > 0 ? (purchasedCount / totalRequests) * 100 : 0;

    // Group by date for timeline chart
    const requestsByDate: { [key: string]: number } = {};
    const purchasesByDate: { [key: string]: number } = {};

    assignments?.forEach((assignment: any, index: number) => {
      const date = new Date(assignment.assigned_at).toISOString().split('T')[0];
      requestsByDate[date] = (requestsByDate[date] || 0) + 1;
      
      if (purchaseChecks[index]) {
        purchasesByDate[date] = (purchasesByDate[date] || 0) + 1;
      }
    });

    // Convert to arrays for charts
    const timelineData = Object.keys(requestsByDate)
      .sort()
      .map(date => ({
        date,
        requests: requestsByDate[date] || 0,
        purchases: purchasesByDate[date] || 0,
      }));

    // Calculate conversion rate over time
    const conversionRateData = timelineData.map(item => ({
      date: item.date,
      conversionRate: item.requests > 0 ? (item.purchases / item.requests) * 100 : 0,
    }));

    // Pie chart data
    const pieChartData = [
      { name: 'اشتروا', value: purchasedCount, color: '#10b981' },
      { name: 'لم يشتروا', value: notPurchasedCount, color: '#ef4444' },
    ];

    return NextResponse.json({
      summary: {
        totalRequests,
        purchasedCount,
        notPurchasedCount,
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
      charts: {
        pieChart: pieChartData,
        timeline: timelineData,
        conversionRate: conversionRateData,
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

