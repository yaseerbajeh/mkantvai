'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, 
  Package, 
  ShoppingCart, 
  CreditCard, 
  Trash2, 
  Tag, 
  Calendar, 
  MessageCircle, 
  Key, 
  UserPlus, 
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface DashboardStats {
  orders: {
    total: number;
    pending: number;
    approved: number;
    paid: number;
    rejected: number;
    recent: number;
  };
  revenue: {
    total: number;
    recent: number;
  };
  products: {
    total: number;
    active: number;
  };
  subscriptions: {
    total: number;
    expiringSoon: number;
    expired: number;
  };
  commissioners: {
    total: number;
    pendingPayouts: number;
  };
  promoCodes: {
    total: number;
    active: number;
    totalUsage: number;
  };
  tickets: {
    total: number;
    open: number;
    closed: number;
  };
  leads: {
    total: number;
    new: number;
    converted: number;
  };
}

const navigationItems = [
  { href: '/admin/products', label: 'مخزون المنتجات', icon: Package, color: 'blue' },
  { href: '/admin/orders', label: 'إدارة الطلبات', icon: ShoppingCart, color: 'green' },
  { href: '/admin/payments', label: 'نظام الدفع', icon: CreditCard, color: 'purple' },
  { href: '/admin/abandoned-carts', label: 'السلات المتروكة', icon: Trash2, color: 'orange' },
  { href: '/admin/promo-codes', label: 'رموز الخصم', icon: Tag, color: 'yellow' },
  { href: '/admin/trial-codes', label: 'رموز التجربة', icon: Key, color: 'teal' },
  { href: '/admin/subscriptions', label: 'إدارة الإشتراكات', icon: Calendar, color: 'cyan' },
  { href: '/admin/tickets', label: 'تذاكر الدعم', icon: MessageCircle, color: 'pink' },
  { href: '/admin/leads', label: 'إدارة العملاء المحتملين', icon: UserPlus, color: 'emerald' },
  { href: '/admin/commissions', label: 'لوحة العمولات', icon: TrendingUp, color: 'indigo' },
];

function AdminDashboardPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          toast({
            title: 'خطأ',
            description: 'حدث خطأ أثناء التحقق من الجلسة',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        if (!session?.user) {
          router.push('/auth');
          return;
        }

        // Check if user is admin
        const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
        if (!adminEmailsStr) {
          if (process.env.NODE_ENV === 'production') {
            toast({
              title: 'خطأ في الإعدادات',
              description: 'إعدادات الإدارة غير متوفرة. يرجى الاتصال بالدعم الفني.',
              variant: 'destructive',
            });
            router.push('/');
            return;
          }
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ SECURITY WARNING: No admin emails configured - allowing access for development only');
          }
        } else {
          const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
          if (adminEmails.length > 0 && !adminEmails.includes(session.user.email || '')) {
            toast({
              title: 'غير مصرح',
              description: 'ليس لديك صلاحية للوصول إلى هذه الصفحة',
              variant: 'destructive',
            });
            router.push('/');
            return;
          }
        }

        setUser(session.user);
        await fetchStats(session.access_token);
      } catch (error: any) {
        console.error('Auth check error:', error);
        toast({
          title: 'خطأ',
          description: error.message || 'حدث خطأ أثناء التحقق من الصلاحيات',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    const fetchStats = async (token: string) => {
      try {
        setLoadingStats(true);
        const response = await fetch('/api/admin/dashboard/stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.error('Failed to fetch stats');
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-6xl mx-auto text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto" />
            <p className="text-gray-600 mt-4">جاري التحميل...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const colorClasses: { [key: string]: { bg: string; text: string; border: string } } = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
    green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">لوحة تحكم الإدارة</h1>
            <p className="text-gray-600">نظرة عامة على النظام والإحصائيات</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Analytics Section - Center */}
            <div className="lg:col-span-3 space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">إجمالي الطلبات</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {loadingStats ? '...' : stats?.orders.total || 0}
                        </p>
                        {stats && stats.orders.recent > 0 && (
                          <p className="text-xs text-green-600 mt-1">
                            +{stats.orders.recent} آخر 7 أيام
                          </p>
                        )}
                      </div>
                      <ShoppingCart className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">إجمالي الإيرادات</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {loadingStats ? '...' : stats?.revenue.total.toFixed(2) || '0.00'} ريال
                        </p>
                        {stats && stats.revenue.recent > 0 && (
                          <p className="text-xs text-green-600 mt-1">
                            +{stats.revenue.recent.toFixed(2)} آخر 7 أيام
                          </p>
                        )}
                      </div>
                      <DollarSign className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">المنتجات النشطة</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {loadingStats ? '...' : stats?.products.active || 0}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          من {stats?.products.total || 0} منتج
                        </p>
                      </div>
                      <Package className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">الاشتراكات</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {loadingStats ? '...' : stats?.subscriptions.total || 0}
                        </p>
                        {stats && stats.subscriptions.expiringSoon > 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            {stats.subscriptions.expiringSoon} على وشك الانتهاء
                          </p>
                        )}
                      </div>
                      <Users className="h-8 w-8 text-cyan-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Analytics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-white border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-gray-900">حالة الطلبات</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingStats ? (
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">قيد الانتظار</span>
                          <span className="font-semibold text-gray-900">{stats?.orders.pending || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">مقبولة</span>
                          <span className="font-semibold text-green-600">{stats?.orders.approved || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">مدفوعة</span>
                          <span className="font-semibold text-blue-600">{stats?.orders.paid || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">مرفوضة</span>
                          <span className="font-semibold text-red-600">{stats?.orders.rejected || 0}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-gray-900">إحصائيات أخرى</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingStats ? (
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">رموز الخصم النشطة</span>
                          <span className="font-semibold text-gray-900">{stats?.promoCodes.active || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">المفوضين</span>
                          <span className="font-semibold text-gray-900">{stats?.commissioners.total || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">التذاكر المفتوحة</span>
                          <span className="font-semibold text-orange-600">{stats?.tickets.open || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">العملاء المحتملين الجدد</span>
                          <span className="font-semibold text-blue-600">{stats?.leads.new || 0}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Chart Placeholder */}
              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    تحليل الإيرادات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-500">إجمالي الإيرادات</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {loadingStats ? '...' : stats?.revenue.total.toFixed(2) || '0.00'} ريال
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">آخر 7 أيام</p>
                        <p className="text-xl font-semibold text-green-600">
                          {loadingStats ? '...' : stats?.revenue.recent.toFixed(2) || '0.00'} ريال
                        </p>
                      </div>
                    </div>
                    {stats && stats.commissioners.pendingPayouts > 0 && (
                      <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div>
                          <p className="text-sm text-orange-700">عمولات معلقة</p>
                          <p className="text-xl font-bold text-orange-900">
                            {stats.commissioners.pendingPayouts.toFixed(2)} ريال
                          </p>
                        </div>
                        <Link href="/admin/commissions">
                          <Button variant="outline" size="sm" className="border-orange-300 text-orange-700">
                            عرض التفاصيل
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side Navigation */}
            <div className="lg:col-span-1">
              <Card className="bg-white border-gray-200 sticky top-32">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900">القوائم</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <nav className="space-y-1 p-2">
                    {navigationItems.map((item) => {
                      const Icon = item.icon;
                      const colors = colorClasses[item.color];
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                        >
                          <div className={`p-2 rounded-lg ${colors.bg} group-hover:${colors.bg.replace('100', '200')}`}>
                            <Icon className={`h-5 w-5 ${colors.text}`} />
                          </div>
                          <span className="flex-1 text-gray-700 font-medium group-hover:text-gray-900">
                            {item.label}
                          </span>
                          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                        </Link>
                      );
                    })}
                  </nav>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Export with dynamic import to prevent chunk load errors
export default dynamic(() => Promise.resolve(AdminDashboardPageContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-6xl mx-auto text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto" />
          <p className="text-gray-600 mt-4">جاري التحميل...</p>
        </div>
      </main>
      <Footer />
    </div>
  ),
});
