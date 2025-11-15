'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Loader2, DollarSign, ArrowDown, Home, BarChart3, Settings } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Commissioner {
  id: string;
  email: string;
  name: string | null;
  promo_code: string;
  commission_rate: number;
  total_earnings: number;
  pending_payouts: number;
  paid_out: number;
}

interface Earnings {
  id: string;
  order_id: string;
  order_amount: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
}

export default function CommissionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [commissioner, setCommissioner] = useState<Commissioner | null>(null);
  const [earnings, setEarnings] = useState<Earnings[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [dailyCommissions, setDailyCommissions] = useState<{ [key: string]: number }>({});
  const [nextPayoutAmount, setNextPayoutAmount] = useState(0);

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

        // Check if user is a commissioner via API
        const checkResponse = await fetch('/api/commissions/earnings', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!checkResponse.ok) {
          toast({
            title: 'غير مصرح',
            description: 'ليس لديك صلاحية للوصول إلى هذه الصفحة. يجب أن تكون مفوضاً نشطاً.',
            variant: 'destructive',
          });
          router.push('/');
          return;
        }

        setUser(session.user);
        await fetchEarnings(session.access_token);
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

    checkAuth();
  }, [router, toast]);

  const fetchEarnings = async (accessToken: string) => {
    try {
      const response = await fetch('/api/commissions/earnings', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('فشل جلب البيانات');
      }

      const result = await response.json();
      setCommissioner(result.commissioner);
      setEarnings(result.earnings || []);
      setPayouts(result.payouts || []);
      setDailyCommissions(result.dailyCommissions || {});
      setNextPayoutAmount(result.nextPayoutAmount || 0);
    } catch (error: any) {
      console.error('Error fetching earnings:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء جلب البيانات',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'اليوم';
      } else if (diffDays === 1) {
        return 'أمس';
      } else if (diffDays < 7) {
        return format(date, 'EEEE', { locale: ar });
      } else {
        return format(date, 'dd MMM yyyy', { locale: ar });
      }
    } catch {
      return dateString;
    }
  };

  const getMaxDailyCommission = () => {
    const values = Object.values(dailyCommissions);
    return values.length > 0 ? Math.max(...values) : 0;
  };

  const maxCommission = getMaxDailyCommission();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto" />
            <p className="text-gray-600 mt-4">جاري التحميل...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user || !commissioner) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-32 pb-24">
        <div className="max-w-4xl mx-auto">
          {/* Promo Code Banner */}
          <Card className="mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white text-sm mb-1">رمزك الترويجي</p>
                  <p className="text-2xl font-bold text-white">{commissioner.promo_code}</p>
                </div>
                <Button
                  onClick={async () => {
                    await navigator.clipboard.writeText(commissioner.promo_code);
                    toast({
                      title: 'تم النسخ',
                      description: 'تم نسخ الرمز الترويجي',
                    });
                  }}
                  className="bg-white text-indigo-600 hover:bg-indigo-50"
                >
                  نسخ
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Your Earnings Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">أرباحك</h1>
            <p className="text-4xl font-bold text-green-600 mb-1">
              ${parseFloat(commissioner.pending_payouts as any).toFixed(2)}
            </p>
            <p className="text-gray-600 text-sm">الرصيد الحالي</p>
            <p className="text-gray-400 text-xs mt-1">
              آخر تحديث: {format(new Date(), 'EEEE، d MMMM yyyy، h:mm a', { locale: ar })}
            </p>
          </div>

          {/* Daily Commissions Chart */}
          <Card className="mb-6 bg-white">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">العمولات اليومية</h2>
              <div className="space-y-3">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const value = dailyCommissions[day] || 0;
                  const percentage = maxCommission > 0 ? (value / maxCommission) * 100 : 0;
                  const dayLabels: { [key: string]: string } = {
                    Mon: 'الاثنين',
                    Tue: 'الثلاثاء',
                    Wed: 'الأربعاء',
                    Thu: 'الخميس',
                    Fri: 'الجمعة',
                    Sat: 'السبت',
                    Sun: 'الأحد',
                  };
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <div className="w-16 text-sm text-gray-600">{dayLabels[day]}</div>
                      <div className="flex-1 relative">
                        <div className="h-8 bg-blue-500 rounded" style={{ width: `${percentage}%` }} />
                        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-700 font-semibold">
                          ${value.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card className="mb-6 bg-white">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">سجل المعاملات</h2>
              <div className="space-y-4">
                {[...earnings.slice(0, 5), ...payouts.slice(0, 2)].sort((a, b) => {
                  const dateA = new Date(a.created_at).getTime();
                  const dateB = new Date(b.created_at).getTime();
                  return dateB - dateA;
                }).slice(0, 5).map((item: any) => {
                  const isEarning = 'commission_amount' in item;
                  return (
                    <div key={item.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          isEarning ? 'bg-green-100' : 'bg-blue-100'
                        }`}>
                          {isEarning ? (
                            <DollarSign className="h-5 w-5 text-green-600" />
                          ) : (
                            <ArrowDown className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {isEarning ? `عمولة - ${item.order_id.slice(0, 8)}` : 'مكافأة الإحالة'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {isEarning ? formatDate(item.created_at) : 'دفع - تحويل بنكي'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isEarning ? 'text-gray-900' : 'text-gray-900'}`}>
                          {isEarning ? `$${parseFloat(item.commission_amount).toFixed(2)}` : `-$${parseFloat(item.amount).toFixed(2)}`}
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(item.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Next Payout */}
          <Card className="mb-6 bg-white">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">الدفعة القادمة</h2>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600">متوقع: {format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'dd MMM yyyy', { locale: ar })}</p>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-2xl font-bold text-gray-900">
                  ${nextPayoutAmount.toFixed(2)}
                </p>
              </div>
              <Link href="/commissions/transactions" className="text-blue-600 text-sm hover:underline">
                عرض جميع المعاملات
              </Link>
            </CardContent>
          </Card>

          {/* Request Payout Button */}
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-6 text-lg"
            onClick={() => {
              toast({
                title: 'تم إرسال الطلب',
                description: 'سيتم معالجة طلب الدفع قريباً',
              });
            }}
          >
            طلب الدفع
          </Button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-around py-3">
            <Link href="/" className="flex flex-col items-center gap-1">
              <Home className="h-6 w-6 text-gray-600" />
              <span className="text-xs text-gray-600">الرئيسية</span>
            </Link>
            <Link href="/commissions/analytics" className="flex flex-col items-center gap-1">
              <BarChart3 className="h-6 w-6 text-gray-600" />
              <span className="text-xs text-gray-600">التحليلات</span>
            </Link>
            <div className="flex flex-col items-center gap-1">
              <DollarSign className="h-6 w-6 text-teal-600" />
              <span className="text-xs text-teal-600 font-semibold">الأرباح</span>
            </div>
            <Link href="/profile" className="flex flex-col items-center gap-1">
              <div className="h-6 w-6 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-600">الملف الشخصي</span>
            </Link>
            <Link href="/profile" className="flex flex-col items-center gap-1">
              <Settings className="h-6 w-6 text-gray-600" />
              <span className="text-xs text-gray-600">الإعدادات</span>
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

