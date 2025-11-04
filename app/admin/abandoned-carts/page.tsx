'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, 
  Search,
  Mail,
  MessageCircle,
  Clock,
  DollarSign,
  ShoppingCart,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  Trash2
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface OrderItem {
  id: string;
  product_code: string;
  product_name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number?: string;
  name: string;
  email: string;
  whatsapp?: string;
  product_name: string;
  product_code?: string;
  price: number;
  total_amount?: number;
  discount_amount?: number;
  is_cart_order?: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  contact_status?: 'not_contacted' | 'contacted';
  reminder_hours?: number;
  reminder_sent_at?: string;
  order_items?: OrderItem[];
  created_at: string;
}

interface EmailTemplate {
  id?: string;
  title: string;
  body: string;
}

export default function AbandonedCartsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>({ title: '', body: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [updatingContact, setUpdatingContact] = useState<string | null>(null);
  const [settingTimer, setSettingTimer] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [contactStatusFilter, setContactStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

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

        const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
        
        if (!adminEmailsStr) {
          if (process.env.NODE_ENV === 'production') {
            toast({
              title: 'خطأ في الإعدادات',
              description: 'إعدادات الإدارة غير متوفرة',
              variant: 'destructive',
            });
            router.push('/');
            return;
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
        await Promise.all([fetchOrders(), fetchEmailTemplate()]);
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

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء جلب الطلبات',
          variant: 'destructive',
        });
        return;
      }

      setOrders((data as Order[]) || []);
    } catch (error: any) {
      console.error('Fetch orders error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء جلب الطلبات',
        variant: 'destructive',
      });
    }
  };

  const fetchEmailTemplate = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/reminder-email-template', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const template = await response.json();
        setEmailTemplate({
          title: template.title || '',
          body: template.body || '',
        });
      }
    } catch (error) {
      console.error('Error fetching email template:', error);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch('/api/admin/reminder-email-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: emailTemplate.title,
          body: emailTemplate.body,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء حفظ القالب');
      }

      toast({
        title: 'نجح',
        description: 'تم حفظ قالب البريد الإلكتروني بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء حفظ القالب',
        variant: 'destructive',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleMarkAsContacted = async (orderId: string) => {
    setUpdatingContact(orderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch('/api/admin/update-contact-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ order_id: orderId, contact_status: 'contacted' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء تحديث الحالة');
      }

      toast({
        title: 'نجح',
        description: 'تم تحديث حالة الاتصال بنجاح',
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث الحالة',
        variant: 'destructive',
      });
    } finally {
      setUpdatingContact(null);
    }
  };

  const handleSendPendingReminders = async () => {
    setSendingReminders(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch('/api/cron/send-abandoned-cart-reminders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إرسال التذكيرات');
      }

      toast({
        title: 'نجح',
        description: `تم إرسال ${data.sent || 0} تذكير بنجاح`,
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إرسال التذكيرات',
        variant: 'destructive',
      });
    } finally {
      setSendingReminders(false);
    }
  };

  const handleSetReminderTimer = async (orderId: string, hours: number) => {
    setSettingTimer(orderId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch('/api/admin/set-reminder-timer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ order_id: orderId, reminder_hours: hours }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء تعيين المؤقت');
      }

      toast({
        title: 'نجح',
        description: `تم تعيين تذكير بعد ${hours} ساعة`,
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تعيين المؤقت',
        variant: 'destructive',
      });
    } finally {
      setSettingTimer(null);
    }
  };

  const getWhatsAppLink = (order: Order) => {
    const whatsappNumber = order.whatsapp?.replace(/[^0-9]/g, '') || '';
    if (!whatsappNumber) return '#';
    const orderDisplayId = order.order_number || order.id.slice(0, 8).toUpperCase();
    const message = encodeURIComponent(
      `مرحباً، لدي طلب رقم ${orderDisplayId} لم أتمكن من إكمال الدفع. يرجى المساعدة.`
    );
    return `https://wa.me/${whatsappNumber}?text=${message}`;
  };

  const getEmailLink = (order: Order) => {
    const orderDisplayId = order.order_number || order.id.slice(0, 8).toUpperCase();
    const subject = encodeURIComponent(`استفسار عن الطلب رقم ${orderDisplayId}`);
    return `mailto:${order.email}?subject=${subject}`;
  };

  const getTimeSinceAbandonment = (createdAt: string) => {
    try {
      const date = new Date(createdAt);
      return formatDistanceToNow(date, { addSuffix: false, locale: ar });
    } catch {
      return 'غير محدد';
    }
  };

  const getReminderStatus = (order: Order) => {
    if (order.reminder_sent_at) {
      return { text: 'تم إرسال التذكير', color: 'bg-green-900/50 text-green-500 border-green-700' };
    }
    if (order.reminder_hours) {
      const createdAt = new Date(order.created_at);
      const reminderTime = new Date(createdAt.getTime() + order.reminder_hours * 60 * 60 * 1000);
      const now = new Date();
      if (now >= reminderTime) {
        return { text: 'جاهز للإرسال', color: 'bg-blue-900/50 text-blue-500 border-blue-700' };
      }
      return { text: `مجدول بعد ${order.reminder_hours} ساعة`, color: 'bg-yellow-900/50 text-yellow-500 border-yellow-700' };
    }
    return null;
  };

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.order_number?.toLowerCase().includes(query) ||
        order.name.toLowerCase().includes(query) ||
        order.email.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query)
      );
    }

    // Contact status filter
    if (contactStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.contact_status === contactStatusFilter);
    }

    return filtered;
  }, [orders, searchQuery, contactStatusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage]);

  // Statistics
  const statistics = useMemo(() => {
    const total = filteredOrders.length;
    const notContacted = filteredOrders.filter(o => o.contact_status === 'not_contacted' || !o.contact_status).length;
    const contacted = filteredOrders.filter(o => o.contact_status === 'contacted').length;
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total_amount || o.price), 0);
    const remindersScheduled = filteredOrders.filter(o => o.reminder_hours && !o.reminder_sent_at).length;
    const remindersSent = filteredOrders.filter(o => o.reminder_sent_at).length;

    return {
      total,
      notContacted,
      contacted,
      totalRevenue,
      remindersScheduled,
      remindersSent,
    };
  }, [filteredOrders]);

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
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">السلات المتروكة</h1>
            <Button
              onClick={handleSendPendingReminders}
              disabled={sendingReminders}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {sendingReminders ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  إرسال التذكيرات المعلقة الآن
                </>
              )}
            </Button>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Card className="bg-orange-900/20 border-orange-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-orange-500">{statistics.total}</div>
                    <div className="text-slate-300 mt-2 text-sm">إجمالي السلات</div>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-orange-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-900/20 border-yellow-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-yellow-500">{statistics.notContacted}</div>
                    <div className="text-slate-300 mt-2 text-sm">لم يتم الاتصال</div>
                  </div>
                  <AlertCircle className="h-8 w-8 text-yellow-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-900/20 border-blue-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-blue-500">{statistics.contacted}</div>
                    <div className="text-slate-300 mt-2 text-sm">تم الاتصال</div>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-900/20 border-green-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-green-500">{statistics.totalRevenue.toLocaleString()}</div>
                    <div className="text-slate-300 mt-2 text-sm">إجمالي القيمة (ريال)</div>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-900/20 border-purple-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-purple-500">{statistics.remindersScheduled}</div>
                    <div className="text-slate-300 mt-2 text-sm">تذكيرات مجدولة</div>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-indigo-900/20 border-indigo-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-indigo-500">{statistics.remindersSent}</div>
                    <div className="text-slate-300 mt-2 text-sm">تذكيرات مرسلة</div>
                  </div>
                  <Send className="h-8 w-8 text-indigo-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Email Template Editor */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-2xl text-white">قالب البريد الإلكتروني للتذكير</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">عنوان البريد الإلكتروني</label>
                <Input
                  value={emailTemplate.title}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, title: e.target.value })}
                  placeholder="مثال: لم تكمل عملية الشراء - {name}"
                  className="bg-slate-900 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-400 mt-1">المتغيرات المتاحة: {'{name}'}, {'{order_id}'}, {'{product_name}'}, {'{total_amount}'}, {'{cart_link}'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">محتوى البريد الإلكتروني (HTML)</label>
                <Textarea
                  value={emailTemplate.body}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, body: e.target.value })}
                  placeholder="محتوى البريد الإلكتروني..."
                  className="bg-slate-900 border-slate-700 text-white min-h-[200px]"
                />
                <p className="text-xs text-slate-400 mt-1">يمكنك استخدام HTML و المتغيرات: {'{name}'}, {'{order_id}'}, {'{product_name}'}, {'{total_amount}'}, {'{cart_link}'}</p>
              </div>
              <Button
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {savingTemplate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    حفظ القالب
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="بحث برقم الطلب أو الاسم أو البريد..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pr-10 bg-slate-900 border-slate-700 text-white"
                  />
                </div>
                <Select value={contactStatusFilter} onValueChange={(value) => {
                  setContactStatusFilter(value);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder="حالة الاتصال" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="not_contacted">لم يتم الاتصال</SelectItem>
                    <SelectItem value="contacted">تم الاتصال</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-2xl text-white">
                الطلبات المتروكة ({filteredOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredOrders.length === 0 ? (
                <p className="text-slate-300 text-center py-8">لا توجد سلات متروكة</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-slate-700/50">
                          <TableHead className="text-white">رقم الطلب</TableHead>
                          <TableHead className="text-white">العميل</TableHead>
                          <TableHead className="text-white">المنتج</TableHead>
                          <TableHead className="text-white">المبلغ</TableHead>
                          <TableHead className="text-white">منذ</TableHead>
                          <TableHead className="text-white">حالة الاتصال</TableHead>
                          <TableHead className="text-white">التذكير</TableHead>
                          <TableHead className="text-white">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedOrders.map((order) => {
                          const reminderStatus = getReminderStatus(order);
                          return (
                            <TableRow key={order.id} className="border-slate-700 hover:bg-slate-700/50">
                              <TableCell className="font-mono text-sm text-white">
                                {order.order_number || order.id.slice(0, 8).toUpperCase()}
                              </TableCell>
                              <TableCell className="text-white">
                                <div className="space-y-1">
                                  <div className="font-semibold">{order.name}</div>
                                  <div className="text-xs text-slate-400">{order.email}</div>
                                  {order.whatsapp && (
                                    <div className="text-xs text-slate-400">{order.whatsapp}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-300 text-sm">
                                {order.is_cart_order && order.order_items && order.order_items.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="font-semibold text-blue-400 mb-1">
                                      🛒 سلة ({order.order_items.length} منتج)
                                    </div>
                                    {order.order_items.map((item: OrderItem) => (
                                      <div key={item.id} className="text-xs text-slate-400">
                                        • {item.product_name} (x{item.quantity})
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  order.product_name
                                )}
                              </TableCell>
                              <TableCell className="text-white">
                                {order.total_amount ? `${order.total_amount} ريال` : `${order.price} ريال`}
                                {order.discount_amount && order.discount_amount > 0 && (
                                  <div className="text-xs text-green-400">
                                    خصم: -{order.discount_amount} ريال
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-400 text-xs">
                                منذ {getTimeSinceAbandonment(order.created_at)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    order.contact_status === 'contacted'
                                      ? 'bg-blue-900/50 text-blue-500 border-blue-700'
                                      : 'bg-yellow-900/50 text-yellow-500 border-yellow-700'
                                  }
                                >
                                  {order.contact_status === 'contacted' ? 'تم الاتصال' : 'لم يتم الاتصال'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {reminderStatus ? (
                                  <Badge className={reminderStatus.color}>
                                    {reminderStatus.text}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-1">
                                    {order.whatsapp && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="bg-green-600 hover:bg-green-700 text-white border-green-700 h-7 text-xs"
                                        onClick={() => window.open(getWhatsAppLink(order), '_blank')}
                                      >
                                        <MessageCircle className="h-3 w-3 mr-1" />
                                        واتساب
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700 h-7 text-xs"
                                      onClick={() => {
                                        const emailLink = getEmailLink(order);
                                        if (emailLink && emailLink !== '#') {
                                          window.location.href = emailLink;
                                        } else {
                                          toast({
                                            title: 'خطأ',
                                            description: 'البريد الإلكتروني غير متوفر',
                                            variant: 'destructive',
                                          });
                                        }
                                      }}
                                    >
                                      <Mail className="h-3 w-3 mr-1" />
                                      بريد
                                    </Button>
                                  </div>
                                  {order.contact_status !== 'contacted' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700 h-7 text-xs"
                                      onClick={() => handleMarkAsContacted(order.id)}
                                      disabled={updatingContact === order.id}
                                    >
                                      {updatingContact === order.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      ) : (
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                      )}
                                      تم الاتصال
                                    </Button>
                                  )}
                                  <Select
                                    value={order.reminder_hours?.toString() || 'none'}
                                    onValueChange={(value) => {
                                      if (value !== 'none') {
                                        handleSetReminderTimer(order.id, parseInt(value));
                                      }
                                    }}
                                    disabled={settingTimer === order.id}
                                  >
                                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white h-7 text-xs">
                                      <SelectValue placeholder="تعيين تذكير" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">لا يوجد تذكير</SelectItem>
                                      <SelectItem value="6">6 ساعات</SelectItem>
                                      <SelectItem value="12">12 ساعة</SelectItem>
                                      <SelectItem value="24">24 ساعة</SelectItem>
                                      <SelectItem value="48">48 ساعة</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-slate-300 text-sm">
                        عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} من {filteredOrders.length}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="bg-slate-800 border-slate-700 text-white"
                        >
                          السابق
                        </Button>
                        <span className="text-slate-300 text-sm flex items-center px-4">
                          صفحة {currentPage} من {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="bg-slate-800 border-slate-700 text-white"
                        >
                          التالي
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

