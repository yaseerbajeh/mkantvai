'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CheckCircle2, XCircle, Clock, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Order {
  id: string;
  order_number?: string;
  name: string;
  email: string;
  whatsapp?: string;
  product_name: string;
  price: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  payment_method?: string;
  assigned_subscription?: {
    code: string;
    meta?: {
      duration?: string;
      type?: string;
    };
  };
  created_at: string;
}

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (error) {
          throw error;
        }

        setOrder(data as Order);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء جلب بيانات الطلب');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const getWhatsAppLink = () => {
    if (!order) return '';
    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '966xxxxxxxxx';
    const orderDisplayId = order.order_number || orderId.slice(0, 8).toUpperCase();
    const message = encodeURIComponent(
      `مرحباً، لقد أنشأت طلب اشتراك على موقع مكان تيفي. رقم الطلب هو: ${orderDisplayId}`
    );
    return `https://wa.me/${966542668201}?text=${message}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-slate-300">جاري التحميل...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-red-900/20 border-red-700">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <XCircle className="w-8 h-8 text-red-500" />
                  <div>
                    <h3 className="text-xl font-bold text-white">خطأ</h3>
                    <p className="text-slate-300 mt-1">
                      {error || 'الطلب غير موجود'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-2xl mx-auto">
          {/* Success Message for Pending Orders */}
          {order.status === 'pending' && (
            <Card className="mb-6 bg-green-900/20 border-green-700">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      ✅ تم استلام طلبك بنجاح!
                    </h3>
                    <p className="text-slate-300">
                      يرجى إكمال عملية الدفع عبر واتساب. سيتم تفعيل اشتراكك بعد التحقق من الدفع.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paid Status (PayPal) */}
          {order.status === 'paid' && (
            <Card className="mb-6 bg-blue-900/20 border-blue-700">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <CheckCircle2 className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      ✅ تم استلام الدفع بنجاح!
                    </h3>
                    <p className="text-slate-300">
                      {order.assigned_subscription 
                        ? 'تم تفعيل اشتراكك تلقائياً. تم إرسال تفاصيل الاشتراك إلى بريدك الإلكتروني.'
                        : 'جاري معالجة طلبك وتفعيل الاشتراك...'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approved Status */}
          {order.status === 'approved' && (
            <Card className="mb-6 bg-green-900/20 border-green-700">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      ✅ تم قبول طلبك وتم تفعيل الاشتراك!
                    </h3>
                    <p className="text-slate-300">
                      تم إرسال تفاصيل الاشتراك إلى بريدك الإلكتروني.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejected Status */}
          {order.status === 'rejected' && (
            <Card className="mb-6 bg-red-900/20 border-red-700">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <XCircle className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      تم رفض الطلب
                    </h3>
                    <p className="text-slate-300">
                      للأسف، تم رفض طلبك. يرجى التواصل معنا عبر واتساب للمزيد من المعلومات.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Details Card */}
          <Card className="mb-6 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-2xl text-white">تفاصيل الطلب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">رقم الطلب:</span>
                <span className="text-white font-mono">{order.order_number || order.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">الاسم:</span>
                <span className="text-white">{order.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">البريد الإلكتروني:</span>
                <span className="text-white">{order.email}</span>
              </div>
              {order.whatsapp && (
                <div className="flex justify-between items-center py-2 border-b border-slate-700">
                  <span className="text-slate-400">رقم الواتساب:</span>
                  <span className="text-white">{order.whatsapp}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">المنتج:</span>
                <span className="text-white">{order.product_name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">السعر:</span>
                <span className="text-white font-bold">{order.price} ريال</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">الحالة:</span>
                <span className={`font-bold ${
                  order.status === 'approved' ? 'text-green-500' :
                  order.status === 'paid' ? 'text-blue-500' :
                  order.status === 'rejected' ? 'text-red-500' :
                  'text-yellow-500'
                }`}>
                  {order.status === 'approved' ? 'مقبول' :
                   order.status === 'paid' ? 'مدفوع' :
                   order.status === 'rejected' ? 'مرفوض' :
                   'قيد الانتظار'}
                </span>
              </div>
              {order.payment_method && (
                <div className="flex justify-between items-center py-2 border-b border-slate-700">
                  <span className="text-slate-400">طريقة الدفع:</span>
                  <span className="text-white font-semibold">
                    {order.payment_method === 'paypal' ? 'PayPal' : order.payment_method}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400">تاريخ الطلب:</span>
                <span className="text-white">
                  {new Date(order.created_at).toLocaleString('ar-SA')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Details (if approved or paid with subscription) */}
          {(order.status === 'approved' || (order.status === 'paid' && order.assigned_subscription)) && order.assigned_subscription && (
            <div className="mb-6">
              <h2 className="text-2xl text-white font-bold mb-4">تفاصيل الاشتراك</h2>
              <div className="space-y-3">
                {/* Subscription Code Box */}
                <Card className="bg-blue-900/20 border-blue-700">
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <span className="text-blue-300 text-sm font-medium">رمز الاشتراك</span>
                      <div className="bg-slate-900 px-4 py-3 rounded-lg border border-blue-600/50">
                        <pre className="text-white font-mono text-lg font-bold whitespace-pre-wrap break-words overflow-x-auto">
                          {order.assigned_subscription.code}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Duration Box */}
                {order.assigned_subscription.meta?.duration && (
                  <Card className="bg-blue-900/20 border-blue-700">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <span className="text-blue-300 text-sm font-medium">مدة الاشتراك</span>
                        <div className="bg-slate-900 px-4 py-3 rounded-lg border border-blue-600/50">
                          <span className="text-white text-lg font-semibold">
                            {order.assigned_subscription.meta.duration}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Type Box */}
                {order.assigned_subscription.meta?.type && (
                  <Card className="bg-blue-900/20 border-blue-700">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <span className="text-blue-300 text-sm font-medium">نوع الاشتراك</span>
                        <div className="bg-slate-900 px-4 py-3 rounded-lg border border-blue-600/50">
                          <span className="text-white text-lg font-semibold">
                            {order.assigned_subscription.meta.type}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* WhatsApp Button (for pending orders) */}
          {order.status === 'pending' && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
                    <MessageCircle className="ml-2 h-5 w-5" />
                    الإنتقال إلى واتساب لإكمال عملية الدفع
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

