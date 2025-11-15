import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

  const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  if (!adminEmailsStr) {
    return process.env.NODE_ENV === 'development' ? user : null;
  }

  const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

// GET - Get dashboard statistics
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

    // Fetch all statistics in parallel
    const [
      ordersResult,
      productsResult,
      paymentsResult,
      subscriptionsResult,
      commissionersResult,
      promoCodesResult,
      ticketsResult,
      leadsResult,
    ] = await Promise.all([
      // Orders
      supabaseAdmin
        .from('orders')
        .select('id, status, total_amount, price, created_at, payment_status')
        .in('status', ['pending', 'approved', 'paid', 'rejected']),
      
      // Products
      supabaseAdmin
        .from('products')
        .select('id, is_active'),
      
      // Payments (from orders with payment_status = COMPLETED or status = paid)
      supabaseAdmin
        .from('orders')
        .select('total_amount, price, created_at')
        .or('payment_status.eq.COMPLETED,status.eq.paid'),
      
      // Subscriptions
      supabaseAdmin
        .from('active_subscriptions')
        .select('id, expiration_date, due_days, renewal_count'),
      
      // Commissioners
      supabaseAdmin
        .from('commissioners')
        .select('id, is_active, pending_payouts, paid_out'),
      
      // Promo Codes
      supabaseAdmin
        .from('promo_codes')
        .select('id, is_active, used_count'),
      
      // Tickets
      supabaseAdmin
        .from('support_tickets')
        .select('id, status'),
      
      // Leads
      supabaseAdmin
        .from('leads')
        .select('id, status'),
    ]);

    const orders = ordersResult.data || [];
    const products = productsResult.data || [];
    const payments = paymentsResult.data || [];
    const subscriptions = subscriptionsResult.data || [];
    const commissioners = commissionersResult.data || [];
    const promoCodes = promoCodesResult.data || [];
    const tickets = ticketsResult.data || [];
    const leads = leadsResult.data || [];

    // Calculate statistics
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const approvedOrders = orders.filter(o => o.status === 'approved').length;
    const paidOrders = orders.filter(o => o.status === 'paid' || o.payment_status === 'COMPLETED').length;
    const rejectedOrders = orders.filter(o => o.status === 'rejected').length;

    const totalRevenue = payments.reduce((sum, p) => {
      return sum + (parseFloat(p.total_amount as any) || parseFloat(p.price as any) || 0);
    }, 0);

    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.is_active).length;

    const totalSubscriptions = subscriptions.length;
    const expiringSoon = subscriptions.filter(s => s.due_days <= 4 && s.due_days > 0).length;
    const expired = subscriptions.filter(s => s.due_days <= 0).length;

    const totalCommissioners = commissioners.filter(c => c.is_active).length;
    const totalPendingPayouts = commissioners.reduce((sum, c) => {
      return sum + (parseFloat(c.pending_payouts as any) || 0);
    }, 0);

    const totalPromoCodes = promoCodes.length;
    const activePromoCodes = promoCodes.filter(p => p.is_active).length;
    const totalPromoUsage = promoCodes.reduce((sum, p) => sum + (p.used_count || 0), 0);

    const totalTickets = tickets.length;
    const openTickets = tickets.filter(t => t.status === 'open').length;
    const closedTickets = tickets.filter(t => t.status === 'closed').length;

    const totalLeads = leads.length;
    const newLeads = leads.filter(l => l.status === 'new').length;
    const convertedLeads = leads.filter(l => l.status === 'converted').length;

    // Recent orders (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = orders.filter(o => {
      const orderDate = new Date(o.created_at);
      return orderDate >= sevenDaysAgo;
    }).length;

    // Revenue last 7 days
    const recentRevenue = payments
      .filter(p => {
        const paymentDate = new Date(p.created_at);
        return paymentDate >= sevenDaysAgo;
      })
      .reduce((sum, p) => {
        return sum + (parseFloat(p.total_amount as any) || parseFloat(p.price as any) || 0);
      }, 0);

    return NextResponse.json({
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        approved: approvedOrders,
        paid: paidOrders,
        rejected: rejectedOrders,
        recent: recentOrders,
      },
      revenue: {
        total: totalRevenue,
        recent: recentRevenue,
      },
      products: {
        total: totalProducts,
        active: activeProducts,
      },
      subscriptions: {
        total: totalSubscriptions,
        expiringSoon: expiringSoon,
        expired: expired,
      },
      commissioners: {
        total: totalCommissioners,
        pendingPayouts: totalPendingPayouts,
      },
      promoCodes: {
        total: totalPromoCodes,
        active: activePromoCodes,
        totalUsage: totalPromoUsage,
      },
      tickets: {
        total: totalTickets,
        open: openTickets,
        closed: closedTickets,
      },
      leads: {
        total: totalLeads,
        new: newLeads,
        converted: convertedLeads,
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الإحصائيات' },
      { status: 500 }
    );
  }
}

