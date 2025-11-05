'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, XCircle, Package, ExternalLink, MessageCircle, AlertCircle, Filter, Star, HelpCircle, Send, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  
  // Ticket states
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [selectedOrderForTicket, setSelectedOrderForTicket] = useState<Order | null>(null);
  const [ticketSubject, setTicketSubject] = useState<string>('');
  const [ticketMessage, setTicketMessage] = useState<string>('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  
  // My Tickets section
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'tickets'>('orders');

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
    fetchUserTickets();
  }, [router]);

  // Fetch user tickets
  const fetchUserTickets = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      setLoadingTickets(true);
      const response = await fetch('/api/tickets', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (response.ok && result.tickets) {
        setUserTickets(result.tickets);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

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

  // Handle opening ticket dialog - for creating new ticket from order
  const handleOpenTicketDialog = (order: Order) => {
    setSelectedOrderForTicket(order);
    setTicketSubject('');
    setTicketMessage('');
    setCurrentTicket(null);
    setTicketMessages([]);
    setNewMessage('');
    setSelectedImage(null);
    setTicketDialogOpen(true);
  };

  // Handle opening existing ticket
  const handleOpenExistingTicket = async (ticket: any) => {
    setSelectedOrderForTicket(null);
    setCurrentTicket(null);
    setTicketMessages([]);
    setNewMessage('');
    setSelectedImage(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      setLoadingTicket(true);
      const response = await fetch(`/api/tickets/${ticket.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      const ticketData = await response.json();
      if (response.ok && ticketData.ticket) {
        setCurrentTicket(ticketData.ticket);
        setTicketMessages(ticketData.ticket.messages || []);
        
        // Fetch order if order_id exists
        if (ticketData.ticket.order_id) {
          const orderResponse = await supabase
            .from('orders')
            .select('*')
            .eq('id', ticketData.ticket.order_id)
            .single();
          
          if (orderResponse.data) {
            setSelectedOrderForTicket(orderResponse.data as Order);
          }
        }
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في تحميل التذكرة',
        variant: 'destructive',
      });
    } finally {
      setLoadingTicket(false);
      setTicketDialogOpen(true);
    }
  };

  // Handle creating new ticket
  const handleCreateTicket = async () => {
    if ((!ticketSubject.trim() || (!ticketMessage.trim() && !selectedImage))) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال الموضوع والرسالة أو الصورة',
        variant: 'destructive',
      });
      return;
    }

    setCreatingTicket(true);
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

      let response: Response;
      
      if (selectedImage) {
        // Send with FormData for image upload
        const formData = new FormData();
        formData.append('order_id', selectedOrderForTicket?.id || '');
        formData.append('subject', ticketSubject.trim());
        if (ticketMessage.trim()) {
          formData.append('message', ticketMessage.trim());
        }
        formData.append('image', selectedImage);

        response = await fetch('/api/tickets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        });
      } else {
        // Send JSON for text only
        response = await fetch('/api/tickets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            order_id: selectedOrderForTicket?.id || null,
            subject: ticketSubject.trim(),
            message: ticketMessage.trim(),
          }),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إنشاء التذكرة');
      }

      toast({
        title: 'نجح',
        description: 'تم إنشاء التذكرة بنجاح',
      });

      setCurrentTicket(result.ticket);
      setTicketMessages(result.ticket.messages || []);
      setTicketSubject('');
      setTicketMessage('');
      setSelectedImage(null);
      
      // Refresh tickets list
      await fetchUserTickets();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إنشاء التذكرة',
        variant: 'destructive',
      });
    } finally {
      setCreatingTicket(false);
    }
  };

  // Handle sending message to ticket
  const handleSendMessage = async () => {
    if (!currentTicket || (!newMessage.trim() && !selectedImage)) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رسالة أو إضافة صورة',
        variant: 'destructive',
      });
      return;
    }

    setSendingMessage(true);
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

      let response: Response;
      
      if (selectedImage) {
        // Send with FormData for image upload
        const formData = new FormData();
        if (newMessage.trim()) {
          formData.append('message', newMessage.trim());
        }
        formData.append('image', selectedImage);

        response = await fetch(`/api/tickets/${currentTicket.id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        });
      } else {
        // Send JSON for text only
        response = await fetch(`/api/tickets/${currentTicket.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: newMessage.trim(),
          }),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إرسال الرسالة');
      }

      setTicketMessages([...ticketMessages, result.message]);
      setNewMessage('');
      setSelectedImage(null);
      
      // Refresh tickets list to update updated_at
      await fetchUserTickets();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إرسال الرسالة',
        variant: 'destructive',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'خطأ',
          description: 'يرجى اختيار ملف صورة',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'خطأ',
          description: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت',
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedImage(file);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  // Remove selected image
  const handleRemoveImage = () => {
    setSelectedImage(null);
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
            <p className="text-slate-300">عرض جميع طلباتك وتذاكر الدعم</p>
          </div>

          {/* Main Tabs - Orders and Tickets */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'orders' | 'tickets')} className="mb-6">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 mb-6">
              <TabsTrigger value="orders" className="data-[state=active]:bg-blue-600">
                طلباتي ({orderStats.all})
              </TabsTrigger>
              <TabsTrigger value="tickets" className="data-[state=active]:bg-blue-600">
                تذاكري ({userTickets.length})
              </TabsTrigger>
            </TabsList>

            {/* Orders Tab */}
            <TabsContent value="orders">
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

                    {/* Actions for Approved/Paid Orders */}
                    {(order.status === 'approved' || order.status === 'paid') && (
                      <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                        <Button
                          onClick={() => handleOpenTicketDialog(order)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <HelpCircle className="w-4 h-4 ml-2" />
                          فتح تذكرة دعم
                        </Button>
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
          </TabsContent>

            {/* Tickets Tab */}
            <TabsContent value="tickets">
              {loadingTickets ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-4" />
                      <p className="text-slate-300">جاري تحميل التذاكر...</p>
                    </div>
                  </CardContent>
                </Card>
              ) : userTickets.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <MessageCircle className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-white mb-2">لا توجد تذاكر</h3>
                      <p className="text-slate-300 mb-6">
                        لم تقم بإنشاء أي تذاكر دعم بعد
                      </p>
                      <p className="text-slate-400 text-sm">
                        يمكنك فتح تذكرة دعم من أي طلب معتمد أو مدفوع
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Add button to create general ticket */}
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={() => {
                        setSelectedOrderForTicket(null);
                        setTicketSubject('');
                        setTicketMessage('');
                        setCurrentTicket(null);
                        setTicketMessages([]);
                        setNewMessage('');
                        setTicketDialogOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <HelpCircle className="w-4 h-4 ml-2" />
                      إنشاء تذكرة دعم جديدة
                    </Button>
                  </div>
                  
                  {userTickets.map((ticket) => (
                    <Card key={ticket.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <MessageCircle className="w-5 h-5 text-blue-400" />
                              <CardTitle className="text-xl text-white">
                                {ticket.subject}
                              </CardTitle>
                              <Badge
                                className={
                                  ticket.status === 'open'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/50'
                                    : 'bg-slate-700 text-slate-400 border-slate-600'
                                }
                              >
                                {ticket.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                              </Badge>
                            </div>
                            <p className="text-slate-400 text-sm font-mono">
                              رقم التذكرة: {ticket.id.slice(0, 8).toUpperCase()}
                            </p>
                            {ticket.order_id && (
                              <p className="text-slate-400 text-sm">
                                مرتبطة بطلب: {ticket.order_id.slice(0, 8).toUpperCase()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleOpenExistingTicket(ticket)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <MessageCircle className="w-4 h-4 ml-2" />
                              فتح التذكرة
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-slate-400 text-sm mb-1">تاريخ الإنشاء</p>
                            <p className="text-white">
                              {new Date(ticket.created_at).toLocaleString('ar-SA')}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm mb-1">آخر تحديث</p>
                            <p className="text-white">
                              {new Date(ticket.updated_at).toLocaleString('ar-SA')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
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

      {/* Ticket Dialog */}
      <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-700">
            <DialogTitle className="text-xl">تذكرة الدعم</DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedOrderForTicket 
                ? `طلب: ${selectedOrderForTicket.product_name}`
                : currentTicket 
                  ? 'تذكرة دعم عامة'
                  : 'إنشاء تذكرة دعم جديدة'}
            </DialogDescription>
          </DialogHeader>
          
          {loadingTicket ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-2" />
              <p className="text-slate-300">جاري التحميل...</p>
            </div>
          ) : currentTicket ? (
            // Existing ticket - show messages
            <div className="flex-1 flex flex-col min-h-0">
              {/* Ticket Header */}
              <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <MessageCircle className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-lg">{currentTicket.subject}</p>
                      <p className="text-slate-400 text-sm">
                        {currentTicket.user_email}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      currentTicket.status === 'open'
                        ? 'bg-green-500/20 text-green-400 border-green-500/50'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }
                  >
                    {currentTicket.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                  </Badge>
                </div>
              </div>
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-gradient-to-b from-slate-900/50 to-slate-800/50">
                {ticketMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">لا توجد رسائل بعد</p>
                  </div>
                ) : (
                  ticketMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'} mb-4 w-full`}
                      style={{ width: '100%', maxWidth: '100%' }}
                    >
                      <div 
                        className={`flex gap-2 ${msg.sender_type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                        style={{ 
                          width: '100%', 
                          maxWidth: '100%',
                          minWidth: 0
                        }}
                      >
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                          msg.sender_type === 'user' ? 'bg-green-500' : 'bg-blue-500'
                        }`}>
                          <span className="text-xs text-white font-bold">
                            {msg.sender_type === 'user' ? 'أ' : 'م'}
                          </span>
                        </div>
                        
                        {/* Message Content */}
                        <div 
                          className="flex flex-col flex-1"
                          style={{ 
                            minWidth: 0,
                            maxWidth: '100%',
                            width: '100%'
                          }}
                        >
                          {/* Sender Name */}
                          <div className={`mb-1 ${msg.sender_type === 'user' ? 'text-right' : 'text-left'}`}>
                            <span className="text-xs text-slate-400 font-medium">
                              {msg.sender_type === 'user' ? 'أنت' : 'المدير'}
                            </span>
                          </div>
                          
                          {/* Message Bubble */}
                          <div
                            className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-md ${
                              msg.sender_type === 'user'
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : 'bg-slate-700 text-white rounded-bl-sm border border-slate-600'
                            }`}
                            style={{ 
                              maxWidth: '100%', 
                              width: '100%',
                              minWidth: 0,
                              wordWrap: 'break-word', 
                              overflowWrap: 'break-word',
                              overflow: 'hidden',
                              boxSizing: 'border-box'
                            }}
                          >
                            {/* Text Message */}
                            {msg.message && msg.message.trim() && (
                              <p 
                                className="text-sm leading-relaxed" 
                                style={{ 
                                  whiteSpace: 'pre-wrap', 
                                  wordBreak: 'break-word', 
                                  overflowWrap: 'anywhere',
                                  wordWrap: 'break-word',
                                  maxWidth: '100%',
                                  width: '100%',
                                  minWidth: 0,
                                  display: 'block',
                                  boxSizing: 'border-box',
                                  margin: 0,
                                  padding: 0
                                }}
                              >
                                {msg.message}
                              </p>
                            )}
                            
                            {/* Image */}
                            {msg.image_url && msg.image_url.trim() && (
                              <div className={msg.message && msg.message.trim() ? 'mt-2' : ''}>
                                <a
                                  href={msg.image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block rounded-lg overflow-hidden"
                                >
                                  <img
                                    src={msg.image_url}
                                    alt="مرفق"
                                    className="max-w-[150px] sm:max-w-[200px] max-h-[150px] sm:max-h-[200px] w-auto h-auto object-contain rounded-lg cursor-pointer hover:opacity-90 transition"
                                    onError={(e) => {
                                      console.error('Image load error:', msg.image_url);
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </a>
                              </div>
                            )}
                          </div>
                          
                          {/* Timestamp */}
                          <div className={`mt-1 ${msg.sender_type === 'user' ? 'text-right' : 'text-left'}`}>
                            <span className="text-xs text-slate-500">
                              {new Date(msg.created_at).toLocaleString('ar-SA', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Input Area */}
              {currentTicket.status === 'open' && (
                <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700">
                  {/* Image File Name Display */}
                  {selectedImage && (
                    <div className="mb-3 flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded-lg">
                      <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-300 flex-1 truncate">{selectedImage.name}</span>
                      <button
                        onClick={handleRemoveImage}
                        className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                        type="button"
                        title="حذف الصورة"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 relative">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="اكتب رسالتك هنا... (Ctrl+Enter للإرسال)"
                        className="bg-slate-800 border-slate-600 text-white min-h-[100px] resize-none pr-12 focus:ring-2 focus:ring-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <div className="absolute bottom-2 left-2 text-xs text-slate-500">
                        Ctrl + Enter
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="ticket-image-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500 h-[100px] px-4 flex flex-col items-center justify-center gap-1.5"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const fileInput = document.getElementById('ticket-image-upload') as HTMLInputElement;
                          if (fileInput) {
                            fileInput.click();
                          }
                        }}
                      >
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-xs">ارفع صورة</span>
                      </Button>
                      <Button
                        onClick={handleSendMessage}
                        disabled={sendingMessage || (!newMessage.trim() && !selectedImage)}
                        className="bg-blue-600 hover:bg-blue-700 h-[100px] px-6"
                        size="lg"
                      >
                        {sendingMessage ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-5 h-5 ml-2" />
                            إرسال
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // New ticket form
            <div className="px-6 py-6 space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-blue-300 font-semibold mb-1">
                      {selectedOrderForTicket ? 'إنشاء تذكرة دعم جديدة' : 'إنشاء تذكرة دعم عامة'}
                    </p>
                    <p className="text-blue-200/80 text-sm">
                      {selectedOrderForTicket 
                        ? `إنشاء تذكرة دعم متعلقة بالطلب: ${selectedOrderForTicket.product_name}. اشرح مشكلتك بالتفصيل وسنقوم بالرد عليك في أقرب وقت ممكن.`
                        : 'يمكنك إنشاء تذكرة دعم عامة. اشرح مشكلتك بالتفصيل وسنقوم بالرد عليك في أقرب وقت ممكن.'}
                    </p>
                    {selectedOrderForTicket && (
                      <p className="text-blue-200/60 text-xs mt-2">
                        ملاحظة: يمكنك إنشاء أكثر من تذكرة لنفس الطلب إذا كانت المشاكل مختلفة.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Image File Name Display for New Ticket */}
              {selectedImage && (
                <div className="mb-4 flex items-center gap-2 p-2 bg-slate-800 border border-slate-600 rounded-lg">
                  <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300 flex-1 truncate">{selectedImage.name}</span>
                  <button
                    onClick={handleRemoveImage}
                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                    type="button"
                    title="حذف الصورة"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              <div>
                <Label htmlFor="ticket-subject" className="text-white mb-2 block font-semibold">
                  الموضوع *
                </Label>
                <Input
                  id="ticket-subject"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="مثال: مشكلة في الاشتراك أو رمز غير صالح"
                  className="bg-slate-900 border-slate-600 text-white h-12 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label htmlFor="ticket-message" className="text-white mb-2 block font-semibold">
                  الرسالة {selectedImage ? '' : '*'}
                </Label>
                <div className="relative">
                  <Textarea
                    id="ticket-message"
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    placeholder="اشرح مشكلتك بالتفصيل... كلما كانت المعلومات أكثر تفصيلاً، كان بإمكاننا مساعدتك بشكل أفضل."
                    className="bg-slate-900 border-slate-600 text-white min-h-[200px] focus:ring-2 focus:ring-blue-500 pr-12"
                  />
                  <div className="absolute bottom-2 left-2 flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="new-ticket-image-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 border-slate-500 text-slate-300 hover:bg-slate-700 hover:border-slate-400 text-xs gap-1.5"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const fileInput = document.getElementById('new-ticket-image-upload') as HTMLInputElement;
                        if (fileInput) {
                          fileInput.click();
                        }
                      }}
                    >
                      <ImageIcon className="w-4 h-4" />
                      ارفع صورة
                    </Button>
                  </div>
                </div>
                <p className="text-slate-400 text-xs mt-2">
                  {ticketMessage.length} حرف
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="px-6 pb-6 border-t border-slate-700 pt-4">
            <Button
              variant="outline"
              onClick={async () => {
                setTicketDialogOpen(false);
                setCurrentTicket(null);
                setTicketMessages([]);
                setNewMessage('');
                setTicketSubject('');
                setTicketMessage('');
                setSelectedImage(null);
                // Refresh tickets list when closing dialog
                await fetchUserTickets();
              }}
              className="border-slate-600 text-slate-300"
            >
              إغلاق
            </Button>
            {!currentTicket && (
              <Button
                onClick={handleCreateTicket}
                disabled={creatingTicket || !ticketSubject.trim() || !ticketMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {creatingTicket ? 'جاري الإنشاء...' : 'إنشاء التذكرة'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

