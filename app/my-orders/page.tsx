'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, XCircle, Package, ExternalLink, MessageCircle, AlertCircle, Filter, Star } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';

interface Order {
  id: string;
  order_number?: string;
  name: string;
  email: string;
  whatsapp?: string;
  product_name: string;
  product_code?: string;
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
  has_review?: boolean;
}

export default function MyOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: number }>({});
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'rejected'>('all');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedOrderForReview, setSelectedOrderForReview] = useState<Order | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);

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

        const ordersData = (data as Order[]) || [];
        
        // Check which orders already have reviews
        const orderIds = ordersData.map(o => o.id);
        if (orderIds.length > 0) {
          const { data: reviews } = await supabase
            .from('reviews')
            .select('order_id')
            .in('order_id', orderIds);
          
          const reviewedOrderIds = new Set(reviews?.map(r => r.order_id) || []);
          ordersData.forEach(order => {
            order.has_review = reviewedOrderIds.has(order.id);
          });
        }

        setOrders(ordersData);
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
        // Only show timer for pending orders that are NOT PayPal payments
        if (order.status === 'pending' && order.payment_method !== 'paypal') {
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
      case 'paid':
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
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
      case 'paid':
        return 'مدفوع';
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
      case 'paid':
        return 'bg-blue-900/20 border-blue-700 text-blue-500';
      case 'rejected':
        return 'bg-red-900/20 border-red-700 text-red-500';
      default:
        return 'bg-yellow-900/20 border-yellow-700 text-yellow-500';
    }
  };

  // Filter orders based on selected status
  const filteredOrders = orders.filter((order) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'completed') {
      return order.status === 'approved' || order.status === 'paid';
    }
    if (filterStatus === 'pending') {
      return order.status === 'pending';
    }
    if (filterStatus === 'rejected') {
      return order.status === 'rejected';
    }
    return true;
  });

  // Count orders by status
  const orderStats = {
    all: orders.length,
    completed: orders.filter(o => o.status === 'approved' || o.status === 'paid').length,
    pending: orders.filter(o => o.status === 'pending').length,
    rejected: orders.filter(o => o.status === 'rejected').length,
  };

  // Handle opening review dialog
  const handleOpenReviewDialog = (order: Order) => {
    setSelectedOrderForReview(order);
    setReviewRating(0);
    setReviewComment('');
    setReviewDialogOpen(true);
  };

  // Handle submitting review
  const handleSubmitReview = async () => {
    if (!selectedOrderForReview || reviewRating === 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار تقييم (1-5 نجوم)',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingReview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'خطأ',
          description: 'يرجى تسجيل الدخول',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          order_id: selectedOrderForReview.id,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إرسال التقييم');
      }

      toast({
        title: 'نجح',
        description: 'تم إرسال التقييم بنجاح',
      });

      // Update order to mark as reviewed
      setOrders(prevOrders =>
        prevOrders.map(o =>
          o.id === selectedOrderForReview.id ? { ...o, has_review: true } : o
        )
      );

      setReviewDialogOpen(false);
      setSelectedOrderForReview(null);
      setReviewRating(0);
      setReviewComment('');
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إرسال التقييم',
        variant: 'destructive',
      });
    } finally {
      setSubmittingReview(false);
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

          {/* Filter Tabs */}
          <Tabs value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)} className="mb-6">
            <TabsList className="grid w-full grid-cols-4 bg-slate-800/50">
              <TabsTrigger value="all" className="data-[state=active]:bg-blue-600">
                الكل ({orderStats.all})
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-green-600">
                مكتملة ({orderStats.completed})
              </TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-600">
                قيد الانتظار ({orderStats.pending})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600">
                مرفوضة ({orderStats.rejected})
              </TabsTrigger>
            </TabsList>
          </Tabs>

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
          ) : filteredOrders.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">لا توجد طلبات</h3>
                  <p className="text-slate-300 mb-6">
                    {filterStatus === 'completed' 
                      ? 'لا توجد طلبات مكتملة حالياً'
                      : filterStatus === 'pending'
                      ? 'لا توجد طلبات قيد الانتظار'
                      : filterStatus === 'rejected'
                      ? 'لا توجد طلبات مرفوضة'
                      : 'لا توجد طلبات'}
                  </p>
                  {filterStatus !== 'all' && (
                    <Button 
                      variant="outline" 
                      onClick={() => setFilterStatus('all')}
                      className="border-slate-700 text-slate-300 hover:text-white"
                    >
                      عرض جميع الطلبات
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
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

                    {/* Completed Order - Subscription Details */}
                    {(order.status === 'approved' || (order.status === 'paid' && order.assigned_subscription)) && order.assigned_subscription && (
                      <div className="mt-4 p-4 bg-gradient-to-br from-green-900/30 to-emerald-900/20 border-2 border-green-600 rounded-lg shadow-lg">
                        <h4 className="text-green-300 font-bold mb-3 flex items-center gap-2 text-lg">
                          <CheckCircle2 className="w-5 h-5" />
                          ✅ طلب مكتمل - تفاصيل الاشتراك
                        </h4>
                        <div className="space-y-3">
                          <div className="bg-slate-900/50 p-3 rounded-lg">
                            <p className="text-slate-400 text-xs mb-1">رمز الاشتراك</p>
                            <p className="text-white font-mono font-bold text-xl bg-slate-950 px-4 py-3 rounded border border-green-600/50">
                              {order.assigned_subscription.code}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {order.assigned_subscription.meta?.duration && (
                              <div className="bg-slate-900/50 p-3 rounded-lg">
                                <p className="text-slate-400 text-xs mb-1">مدة الاشتراك</p>
                                <p className="text-white font-semibold">{order.assigned_subscription.meta.duration}</p>
                              </div>
                            )}
                            {order.assigned_subscription.meta?.type && (
                              <div className="bg-slate-900/50 p-3 rounded-lg">
                                <p className="text-slate-400 text-xs mb-1">نوع الاشتراك</p>
                                <p className="text-white font-semibold">{order.assigned_subscription.meta.type}</p>
                              </div>
                            )}
                          </div>
                          {order.payment_method === 'paypal' && (
                            <div className="bg-blue-900/30 p-2 rounded border border-blue-700/50">
                              <p className="text-blue-300 text-xs flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3" />
                                تم الدفع عبر PayPal
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* PayPal paid status - no timer needed */}
                    {order.status === 'paid' && order.payment_method === 'paypal' && (
                      <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-blue-300 text-sm mb-2">
                              ✅ تم استلام الدفع عبر PayPal بنجاح
                            </p>
                            <p className="text-blue-200 text-xs">
                              {order.assigned_subscription 
                                ? 'تم تفعيل اشتراكك تلقائياً. تم إرسال تفاصيل الاشتراك إلى بريدك الإلكتروني.'
                                : 'جاري معالجة طلبك وتفعيل الاشتراك...'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pending status - only show timer for non-PayPal orders */}
                    {order.status === 'pending' && order.payment_method !== 'paypal' && (
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

                    {/* Review Button for Approved/Paid Orders */}
                    {(order.status === 'approved' || order.status === 'paid') && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        {order.has_review ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm">تم تقييم هذا الطلب</span>
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleOpenReviewDialog(order)}
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                          >
                            <Star className="w-4 h-4 ml-2" />
                            قيّم هذا الطلب
                          </Button>
                        )}
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

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>تقييم الطلب</DialogTitle>
            <DialogDescription className="text-slate-400">
              شاركنا رأيك في المنتج والخدمة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-white mb-2 block">التقييم *</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= reviewRating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-slate-500'
                      } transition-colors`}
                    />
                  </button>
                ))}
              </div>
              {reviewRating > 0 && (
                <p className="text-slate-400 text-sm mt-2">
                  {reviewRating === 1 && 'سيء جداً'}
                  {reviewRating === 2 && 'سيء'}
                  {reviewRating === 3 && 'متوسط'}
                  {reviewRating === 4 && 'جيد'}
                  {reviewRating === 5 && 'ممتاز'}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="comment" className="text-white mb-2 block">
                التعليق (اختياري)
              </Label>
              <Textarea
                id="comment"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="اكتب تعليقك هنا..."
                className="bg-slate-900 border-slate-700 text-white min-h-[100px]"
                maxLength={500}
              />
              <p className="text-slate-400 text-xs mt-1">
                {reviewComment.length}/500
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              className="bg-slate-700 border-slate-600 text-white"
              disabled={submittingReview}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubmitReview}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
              disabled={submittingReview || reviewRating === 0}
            >
              {submittingReview ? 'جاري الإرسال...' : 'إرسال التقييم'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

