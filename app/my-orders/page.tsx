'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, XCircle, Package, ExternalLink, MessageCircle, AlertCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface Order {
  id: string;
  order_number?: string;
  name: string;
  email: string;
  whatsapp?: string;
  product_name: string;
  price: number;
  status: 'pending' | 'approved' | 'rejected';
  assigned_subscription?: {
    code: string;
    meta?: {
      duration?: string;
      type?: string;
    };
  };
  created_at: string;
}

export default function MyOrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const checkAuthAndFetchOrders = async () => {
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push('/auth');
        return;
      }

      setUser(session.user);

      // Fetch user's orders by email
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('email', session.user.email)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching orders:', error);
          throw error;
        }

        setOrders((data as Order[]) || []);
      } catch (error: any) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchOrders();
  }, [router]);

  // Timer effect for pending orders
  useEffect(() => {
    const calculateTimeRemaining = (createdAt: string) => {
      const now = new Date().getTime();
      const created = new Date(createdAt).getTime();
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
      const elapsed = now - created;
      const remaining = Math.max(0, oneHour - elapsed);
      return Math.floor(remaining / 1000); // Return seconds
    };

    const updateTimers = () => {
      const timers: { [key: string]: number } = {};
      orders.forEach((order) => {
        if (order.status === 'pending') {
          timers[order.id] = calculateTimeRemaining(order.created_at);
        }
      });
      setTimeRemaining(timers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [orders]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getWhatsAppLink = (order: Order) => {
    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '966xxxxxxxxx';
    const orderDisplayId = order.order_number || order.id.slice(0, 8).toUpperCase();
    const message = encodeURIComponent(
      `مرحباً، لدي طلب اشتراك رقم ${orderDisplayId} لم أتمكن من إكمال الدفع. يرجى المساعدة.`
    );
    return `https://wa.me/${966542668201}?text=${message}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      default:
        return 'قيد الانتظار';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-900/20 border-green-700 text-green-500';
      case 'rejected':
        return 'bg-red-900/20 border-red-700 text-red-500';
      default:
        return 'bg-yellow-900/20 border-yellow-700 text-yellow-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-slate-300">جاري التحميل...</p>
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
            <h1 className="text-3xl font-bold text-white mb-2">طلباتي</h1>
            <p className="text-slate-300">عرض جميع طلباتك الاشتراك</p>
          </div>

          {orders.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">لا توجد طلبات</h3>
                  <p className="text-slate-300 mb-6">
                    لم تقم بإنشاء أي طلبات اشتراك بعد
                  </p>
                  <Link href="/subscribe">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      إنشاء طلب جديد
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(order.status)}
                          <CardTitle className="text-xl text-white">
                            {order.product_name}
                          </CardTitle>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm font-mono">
                          رقم الطلب: {order.order_number || order.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white">
                          <ExternalLink className="w-4 h-4 ml-2" />
                          التفاصيل
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-slate-400 text-sm mb-1">السعر</p>
                        <p className="text-white font-semibold">{order.price} ريال</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm mb-1">تاريخ الطلب</p>
                        <p className="text-white">
                          {new Date(order.created_at).toLocaleString('ar-SA')}
                        </p>
                      </div>
                    </div>

                    {order.status === 'approved' && order.assigned_subscription && (
                      <div className="mt-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                        <h4 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          تفاصيل الاشتراك
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <p className="text-slate-400 text-sm">رمز الاشتراك</p>
                            <p className="text-white font-mono font-bold text-lg bg-slate-900 px-3 py-2 rounded mt-1">
                              {order.assigned_subscription.code}
                            </p>
                          </div>
                          {order.assigned_subscription.meta?.duration && (
                            <div>
                              <p className="text-slate-400 text-sm">مدة الاشتراك</p>
                              <p className="text-white">{order.assigned_subscription.meta.duration}</p>
                            </div>
                          )}
                          {order.assigned_subscription.meta?.type && (
                            <div>
                              <p className="text-slate-400 text-sm">نوع الاشتراك</p>
                              <p className="text-white">{order.assigned_subscription.meta.type}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {order.status === 'pending' && (
                      <div className="mt-4 space-y-3">
                        <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-yellow-400 text-sm flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              الوقت المتبقي لإكمال الدفع:
                            </p>
                            <div className={`text-lg font-bold font-mono ${
                              (timeRemaining[order.id] || 0) < 300 ? 'text-red-500 animate-pulse' : 'text-yellow-400'
                            }`}>
                              {timeRemaining[order.id] !== undefined 
                                ? formatTime(timeRemaining[order.id])
                                : '00:00'}
                            </div>
                          </div>
                          <p className="text-yellow-300 text-xs mt-2">
                            يرجى إكمال عملية الدفع خلال الوقت المتبقي. سيتم إلغاء الطلب تلقائياً بعد انتهاء الوقت.
                          </p>
                        </div>
                        {(timeRemaining[order.id] || 0) > 0 && (
                          <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-blue-300 text-sm mb-2">
                                  لم تتمكن من إكمال الدفع؟
                                </p>
                                <p className="text-blue-200 text-xs mb-3">
                                  تواصل معنا عبر واتساب قبل انتهاء الوقت المتبقي لتجنب إلغاء الطلب.
                                </p>
                                <a href={getWhatsAppLink(order)} target="_blank" rel="noopener noreferrer">
                                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                                    <MessageCircle className="ml-2 h-4 w-4" />
                                    التواصل عبر واتساب
                                  </Button>
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                        {(timeRemaining[order.id] || 0) === 0 && (
                          <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
                            <p className="text-red-400 text-sm flex items-center gap-2">
                              <XCircle className="w-4 h-4" />
                              انتهى الوقت المحدد. يرجى التواصل معنا لإعادة تفعيل الطلب.
                            </p>
                            <a href={getWhatsAppLink(order)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block">
                              <Button variant="outline" className="border-red-700 text-red-400 hover:text-red-300 hover:bg-red-900/30">
                                <MessageCircle className="ml-2 h-4 w-4" />
                                التواصل عبر واتساب
                              </Button>
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {order.status === 'rejected' && (
                      <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
                        <p className="text-red-400 text-sm flex items-center gap-2">
                          <XCircle className="w-4 h-4" />
                          تم رفض الطلب. يرجى التواصل معنا للمزيد من المعلومات.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

