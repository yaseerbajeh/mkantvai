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
import { Loader2, Package, ShoppingCart, ArrowLeft, CreditCard, Trash2, Tag, Calendar, MessageCircle, Key, UserPlus, TrendingUp } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">لوحة تحكم الإدارة</h1>
            <p className="text-gray-600">إدارة المنتجات والطلبات</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Product Inventory Card */}
            <Link href="/admin/products">
              <Card className="bg-white border-gray-200 hover:border-blue-500 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Package className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">مخزون المنتجات</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    إدارة المنتجات والاشتراكات. يمكنك إضافة وتعديل وحذف المنتجات وإدارة رموز الاشتراكات.
                  </p>
                  <div className="flex items-center text-blue-600 font-semibold">
                    الانتقال إلى المخزون
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Orders Management Card */}
            <Link href="/admin/orders">
              <Card className="bg-white border-gray-200 hover:border-green-500 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <ShoppingCart className="h-8 w-8 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">إدارة الطلبات</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    عرض وإدارة جميع الطلبات. قبول أو رفض الطلبات وعرض التحليلات والإحصائيات.
                  </p>
                  <div className="flex items-center text-green-600 font-semibold">
                    الانتقال إلى الطلبات
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Payment System Card */}
            <Link href="/admin/payments">
              <Card className="bg-white border-gray-200 hover:border-purple-500 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <CreditCard className="h-8 w-8 text-purple-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">نظام الدفع</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    عرض وإدارة جميع المدفوعات عبر PayPal. تتبع الطلبات المدفوعة تلقائياً والاشتراكات المفعلة.
                  </p>
                  <div className="flex items-center text-purple-600 font-semibold">
                    الانتقال إلى المدفوعات
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Abandoned Carts Card */}
            <Link href="/admin/abandoned-carts">
              <Card className="bg-white border-gray-200 hover:border-orange-500 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <Trash2 className="h-8 w-8 text-orange-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">السلات المتروكة</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    تتبع وإدارة السلات المتروكة. تواصل مع العملاء الذين لم يكملوا عملية الشراء وأرسل تذكيرات تلقائية.
                  </p>
                  <div className="flex items-center text-orange-600 font-semibold">
                    الانتقال إلى السلات المتروكة
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Promo Codes Card */}
            <Link href="/admin/promo-codes">
              <Card className="bg-white border-gray-200 hover:border-yellow-500 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <Tag className="h-8 w-8 text-yellow-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">رموز الخصم</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    إنشاء وإدارة رموز الخصم الترويجية. يمكنك إضافة رموز خصم بنسبة مئوية أو مبلغ ثابت، بما في ذلك رموز الخصم 100%.
                  </p>
                  <div className="flex items-center text-yellow-600 font-semibold">
                    الانتقال إلى رموز الخصم
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Trial Codes Card */}
            <Link href="/admin/trial-codes">
              <Card className="bg-white border-gray-200 hover:border-teal-500 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-100 rounded-lg">
                      <Key className="h-8 w-8 text-teal-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">رموز التجربة</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    إدارة رموز التجربة المجانية. إضافة رموز التجربة مع بيانات الدخول ومتابعة طلبات المستخدمين والتحليلات.
                  </p>
                  <div className="flex items-center text-teal-600 font-semibold">
                    الانتقال إلى رموز التجربة
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Subscription Management Card */}
            <Link href="/admin/subscriptions">
              <Card className="bg-white border-gray-200 hover:border-cyan-500 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-100 rounded-lg">
                      <Calendar className="h-8 w-8 text-cyan-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">إدارة الإشتراكات</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    إدارة وتتبع اشتراكات العملاء. عرض الاشتراكات المنتهية قريباً، وإرسال تذكيرات، وتجديد الاشتراكات.
                  </p>
                  <div className="flex items-center text-cyan-600 font-semibold">
                    الانتقال إلى الإشتراكات
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Tickets Management Card */}
            <Link href="/admin/tickets">
              <Card className="bg-white border-gray-200 hover:border-pink-500 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-pink-100 rounded-lg">
                      <MessageCircle className="h-8 w-8 text-pink-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">تذاكر الدعم</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    إدارة تذاكر الدعم الفني. عرض والرد على تذاكر العملاء ومتابعة المشاكل والدعم.
                  </p>
                  <div className="flex items-center text-pink-600 font-semibold">
                    الانتقال إلى التذاكر
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* CRM Leads Card */}
            <Link href="/admin/leads">
              <Card className="bg-white border-gray-200 hover:border-emerald-500 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-lg">
                      <UserPlus className="h-8 w-8 text-emerald-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">إدارة العملاء المحتملين</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    تتبع وإدارة العملاء المحتملين من السلات المتروكة وواتساب. إضافة تعليقات ومتابعة العملاء.
                  </p>
                  <div className="flex items-center text-emerald-600 font-semibold">
                    الانتقال إلى العملاء المحتملين
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Commission Panel Card */}
            <Link href="/admin/commissions">
              <Card className="bg-white border-gray-200 hover:border-indigo-500 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/20 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-lg">
                      <TrendingUp className="h-8 w-8 text-indigo-600" />
                    </div>
                    <CardTitle className="text-2xl text-gray-900">لوحة العمولات</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    إدارة المفوضين والعمولات. إضافة مفوضين جدد، تتبع الأرباح، ومعالجة المدفوعات.
                  </p>
                  <div className="flex items-center text-indigo-600 font-semibold">
                    الانتقال إلى لوحة العمولات
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
