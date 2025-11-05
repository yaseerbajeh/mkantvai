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
import { Loader2, Package, ShoppingCart, ArrowLeft, CreditCard, Trash2, Tag, Calendar } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

function AdminDashboardPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
          // CRITICAL: In production, admin emails must be configured
          if (process.env.NODE_ENV === 'production') {
            toast({
              title: 'خطأ في الإعدادات',
              description: 'إعدادات الإدارة غير متوفرة. يرجى الاتصال بالدعم الفني.',
              variant: 'destructive',
            });
            router.push('/');
            return;
          }
          // Development mode: warn but allow (for development only)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-6xl mx-auto text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
            <p className="text-slate-300 mt-4">جاري التحميل...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">لوحة تحكم الإدارة</h1>
            <p className="text-slate-300">إدارة المنتجات والطلبات</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Product Inventory Card */}
            <Link href="/admin/products">
              <Card className="bg-slate-800/50 border-slate-700 hover:border-blue-500 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <Package className="h-8 w-8 text-blue-400" />
                    </div>
                    <CardTitle className="text-2xl text-white">مخزون المنتجات</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 mb-4">
                    إدارة المنتجات والاشتراكات. يمكنك إضافة وتعديل وحذف المنتجات وإدارة رموز الاشتراكات.
                  </p>
                  <div className="flex items-center text-blue-400 font-semibold">
                    الانتقال إلى المخزون
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Orders Management Card */}
            <Link href="/admin/orders">
              <Card className="bg-slate-800/50 border-slate-700 hover:border-green-500 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-500/20 rounded-lg">
                      <ShoppingCart className="h-8 w-8 text-green-400" />
                    </div>
                    <CardTitle className="text-2xl text-white">إدارة الطلبات</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 mb-4">
                    عرض وإدارة جميع الطلبات. قبول أو رفض الطلبات وعرض التحليلات والإحصائيات.
                  </p>
                  <div className="flex items-center text-green-400 font-semibold">
                    الانتقال إلى الطلبات
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Payment System Card */}
            <Link href="/admin/payments">
              <Card className="bg-slate-800/50 border-slate-700 hover:border-purple-500 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                      <CreditCard className="h-8 w-8 text-purple-400" />
                    </div>
                    <CardTitle className="text-2xl text-white">نظام الدفع</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 mb-4">
                    عرض وإدارة جميع المدفوعات عبر PayPal. تتبع الطلبات المدفوعة تلقائياً والاشتراكات المفعلة.
                  </p>
                  <div className="flex items-center text-purple-400 font-semibold">
                    الانتقال إلى المدفوعات
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Abandoned Carts Card */}
            <Link href="/admin/abandoned-carts">
              <Card className="bg-slate-800/50 border-slate-700 hover:border-orange-500 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-500/20 rounded-lg">
                      <Trash2 className="h-8 w-8 text-orange-400" />
                    </div>
                    <CardTitle className="text-2xl text-white">السلات المتروكة</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 mb-4">
                    تتبع وإدارة السلات المتروكة. تواصل مع العملاء الذين لم يكملوا عملية الشراء وأرسل تذكيرات تلقائية.
                  </p>
                  <div className="flex items-center text-orange-400 font-semibold">
                    الانتقال إلى السلات المتروكة
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Promo Codes Card */}
            <Link href="/admin/promo-codes">
              <Card className="bg-slate-800/50 border-slate-700 hover:border-yellow-500 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/20 rounded-lg">
                      <Tag className="h-8 w-8 text-yellow-400" />
                    </div>
                    <CardTitle className="text-2xl text-white">رموز الخصم</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 mb-4">
                    إنشاء وإدارة رموز الخصم الترويجية. يمكنك إضافة رموز خصم بنسبة مئوية أو مبلغ ثابت، بما في ذلك رموز الخصم 100%.
                  </p>
                  <div className="flex items-center text-yellow-400 font-semibold">
                    الانتقال إلى رموز الخصم
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Subscription Management Card */}
            <Link href="/admin/subscriptions">
              <Card className="bg-slate-800/50 border-slate-700 hover:border-cyan-500 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-500/20 rounded-lg">
                      <Calendar className="h-8 w-8 text-cyan-400" />
                    </div>
                    <CardTitle className="text-2xl text-white">إدارة الإشتراكات</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 mb-4">
                    إدارة وتتبع اشتراكات العملاء. عرض الاشتراكات المنتهية قريباً، وإرسال تذكيرات، وتجديد الاشتراكات.
                  </p>
                  <div className="flex items-center text-cyan-400 font-semibold">
                    الانتقال إلى الإشتراكات
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-6xl mx-auto text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
          <p className="text-slate-300 mt-4">جاري التحميل...</p>
        </div>
      </main>
      <Footer />
    </div>
  ),
});
