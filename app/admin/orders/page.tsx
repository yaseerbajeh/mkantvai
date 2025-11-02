'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { 
  CheckCircle2, 
  Loader2, 
  XCircle, 
  Search, 
  Calendar as CalendarIcon,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Clock
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';

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
    meta?: any;
  };
  created_at: string;
}

type SortField = 'order_number' | 'created_at' | 'price' | 'status' | 'name';
type SortDirection = 'asc' | 'desc';

export default function AdminOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [quickFilter, setQuickFilter] = useState<string>('all');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Pagination
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
          if (process.env.NODE_ENV === 'development') {
            console.log('No session, redirecting to auth');
          }
          router.push('/auth');
          return;
        }

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
        fetchOrders();
      } catch (error: any) {
        console.error('Auth check error:', error);
        toast({
          title: 'خطأ',
          description: error.message || 'حدث خطأ أثناء التحقق من الصلاحيات',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  // Apply quick date filters
  useEffect(() => {
    if (quickFilter === 'all') {
      setDateFrom(undefined);
      setDateTo(undefined);
    } else {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (quickFilter) {
        case 'today':
          setDateFrom(today);
          setDateTo(new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1));
          break;
        case 'yesterday':
          const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
          setDateFrom(yesterday);
          setDateTo(new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1));
          break;
        case 'last7':
          setDateFrom(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
          setDateTo(new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1));
          break;
        case 'last30':
          setDateFrom(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
          setDateTo(new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1));
          break;
      }
    }
  }, [quickFilter]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          toast({
            title: 'خطأ في قاعدة البيانات',
            description: 'جدول الطلبات غير موجود. يرجى تشغيل SQL في Supabase أولاً.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
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
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort orders
  const filteredAndSortedOrders = useMemo(() => {
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

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Date filters
    if (dateFrom) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= dateFrom;
      });
    }
    if (dateTo) {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate <= dateTo;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'order_number':
          aValue = a.order_number || a.id;
          bValue = b.order_number || b.id;
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [orders, searchQuery, statusFilter, dateFrom, dateTo, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedOrders.slice(start, start + itemsPerPage);
  }, [filteredAndSortedOrders, currentPage]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const filtered = filteredAndSortedOrders;
    
    const totalOrders = filtered.length;
    const pendingOrders = filtered.filter(o => o.status === 'pending').length;
    const approvedOrders = filtered.filter(o => o.status === 'approved' || o.status === 'paid').length;
    const paidOrders = filtered.filter(o => o.status === 'paid').length;
    const rejectedOrders = filtered.filter(o => o.status === 'rejected').length;
    const totalRevenue = filtered.filter(o => o.status === 'approved' || o.status === 'paid').reduce((sum, o) => sum + Number(o.price), 0);

    // Orders over time (last 30 days)
    const ordersByDate: { [key: string]: number } = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    filtered.forEach(order => {
      const orderDate = new Date(order.created_at);
      if (orderDate >= thirtyDaysAgo) {
        const dateKey = format(orderDate, 'yyyy-MM-dd');
        ordersByDate[dateKey] = (ordersByDate[dateKey] || 0) + 1;
      }
    });

    const ordersOverTime = Object.entries(ordersByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Orders by status
    const ordersByStatus = [
      { name: 'مقبول', value: approvedOrders, color: '#22c55e' },
      { name: 'قيد الانتظار', value: pendingOrders, color: '#eab308' },
      { name: 'مرفوض', value: rejectedOrders, color: '#ef4444' },
    ];

    // Revenue by product
    const revenueByProduct: { [key: string]: number } = {};
    filtered.filter(o => o.status === 'approved').forEach(order => {
      const productName = order.product_name || 'غير محدد';
      revenueByProduct[productName] = (revenueByProduct[productName] || 0) + Number(order.price);
    });

    const revenueByProductData = Object.entries(revenueByProduct)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Orders by day of week
    const ordersByDay: { [key: string]: number } = {
      'الأحد': 0,
      'الإثنين': 0,
      'الثلاثاء': 0,
      'الأربعاء': 0,
      'الخميس': 0,
      'الجمعة': 0,
      'السبت': 0,
    };

    filtered.forEach(order => {
      const orderDate = new Date(order.created_at);
      const dayIndex = orderDate.getDay();
      const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      ordersByDay[dayNames[dayIndex]] = (ordersByDay[dayNames[dayIndex]] || 0) + 1;
    });

    const ordersByDayData = Object.entries(ordersByDay).map(([day, count]) => ({ day, count }));

    return {
      totalOrders,
      pendingOrders,
      approvedOrders,
      rejectedOrders,
      totalRevenue,
      ordersOverTime,
      ordersByStatus,
      revenueByProductData,
      ordersByDayData,
    };
  }, [filteredAndSortedOrders]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const handleApproveOrder = async (orderId: string) => {
    setApprovingOrderId(orderId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch('/api/admin/approve-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء الموافقة على الطلب');
      }

      toast({
        title: 'نجح',
        description: 'تم تفعيل الاشتراك وإرسال التفاصيل للعميل',
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء الموافقة على الطلب',
        variant: 'destructive',
      });
    } finally {
      setApprovingOrderId(null);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    setRejectingOrderId(orderId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch('/api/admin/reject-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء رفض الطلب');
      }

      toast({
        title: 'نجح',
        description: 'تم رفض الطلب بنجاح',
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء رفض الطلب',
        variant: 'destructive',
      });
    } finally {
      setRejectingOrderId(null);
    }
  };

  const exportToCSV = () => {
    const headers = ['رقم الطلب', 'الاسم', 'البريد الإلكتروني', 'واتساب', 'المنتج', 'السعر', 'الحالة', 'التاريخ'];
    const rows = filteredAndSortedOrders.map(order => [
      order.order_number || order.id.slice(0, 8).toUpperCase(),
      order.name,
      order.email,
      order.whatsapp || '',
      order.product_name,
      order.price.toString(),
      order.status === 'approved' ? 'مقبول' : order.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار',
      format(new Date(order.created_at), 'yyyy-MM-dd HH:mm', { locale: ar }),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

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
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-6xl mx-auto">
            <Card className="bg-red-900/20 border-red-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white mb-2">غير مصرح</h2>
                  <p className="text-slate-300 mb-4">
                    يرجى تسجيل الدخول للوصول إلى لوحة الإدارة
                  </p>
                  <Button onClick={() => router.push('/auth')} className="bg-blue-600 hover:bg-blue-700">
                    تسجيل الدخول
                  </Button>
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
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">لوحة تحكم الإدارة - الطلبات</h1>
            <Button onClick={exportToCSV} variant="outline" className="bg-slate-800 text-white border-slate-700">
              <Download className="h-4 w-4 ml-2" />
              تصدير CSV
            </Button>
          </div>

          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="bg-slate-800 border-slate-700">
              <TabsTrigger value="orders" className="data-[state=active]:bg-slate-700">الطلبات</TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-slate-700">التحليلات</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-6">
              {/* Filters */}
              <Card className="bg-slate-800/50 border-slate-700 mb-6">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="بحث برقم الطلب أو الاسم..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pr-10 bg-slate-900 border-slate-700 text-white"
                      />
                    </div>

                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={(value) => {
                      setStatusFilter(value);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="حالة الطلب" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الحالات</SelectItem>
                        <SelectItem value="pending">قيد الانتظار</SelectItem>
                        <SelectItem value="approved">مقبول</SelectItem>
                        <SelectItem value="paid">مدفوع</SelectItem>
                        <SelectItem value="rejected">مرفوض</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Quick Date Filter */}
                    <Select value={quickFilter} onValueChange={(value) => {
                      setQuickFilter(value);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="الفترة الزمنية" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفترات</SelectItem>
                        <SelectItem value="today">اليوم</SelectItem>
                        <SelectItem value="yesterday">أمس</SelectItem>
                        <SelectItem value="last7">آخر 7 أيام</SelectItem>
                        <SelectItem value="last30">آخر 30 يوم</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Date Range */}
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 bg-slate-900 border-slate-700 text-white">
                            <CalendarIcon className="h-4 w-4 ml-2" />
                            {dateFrom ? format(dateFrom, 'yyyy-MM-dd', { locale: ar }) : 'من تاريخ'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                          <Calendar
                            mode="single"
                            selected={dateFrom}
                            onSelect={(date) => {
                              setDateFrom(date);
                              setQuickFilter('custom');
                              setCurrentPage(1);
                            }}
                            className="bg-slate-800"
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 bg-slate-900 border-slate-700 text-white">
                            <CalendarIcon className="h-4 w-4 ml-2" />
                            {dateTo ? format(dateTo, 'yyyy-MM-dd', { locale: ar }) : 'إلى تاريخ'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                          <Calendar
                            mode="single"
                            selected={dateTo}
                            onSelect={(date) => {
                              setDateTo(date);
                              setQuickFilter('custom');
                              setCurrentPage(1);
                            }}
                            className="bg-slate-800"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-yellow-900/20 border-yellow-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-yellow-500">{analytics.pendingOrders}</div>
                        <div className="text-slate-300 mt-2 text-sm">طلبات قيد الانتظار</div>
                      </div>
                      <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-green-900/20 border-green-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-green-500">{analytics.approvedOrders}</div>
                        <div className="text-slate-300 mt-2 text-sm">طلبات مقبولة</div>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-900/20 border-red-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-red-500">{analytics.rejectedOrders}</div>
                        <div className="text-slate-300 mt-2 text-sm">طلبات مرفوضة</div>
                      </div>
                      <XCircle className="h-8 w-8 text-red-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-blue-900/20 border-blue-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-blue-500">{analytics.totalOrders}</div>
                        <div className="text-slate-300 mt-2 text-sm">إجمالي الطلبات</div>
                      </div>
                      <ShoppingCart className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Orders Table */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">
                    الطلبات ({filteredAndSortedOrders.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredAndSortedOrders.length === 0 ? (
                    <p className="text-slate-300 text-center py-8">لا توجد طلبات</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-700 hover:bg-slate-700/50">
                              <TableHead className="text-white cursor-pointer" onClick={() => handleSort('order_number')}>
                                <div className="flex items-center">
                                  رقم الطلب
                                  <SortIcon field="order_number" />
                                </div>
                              </TableHead>
                              <TableHead className="text-white cursor-pointer" onClick={() => handleSort('name')}>
                                <div className="flex items-center">
                                  الاسم
                                  <SortIcon field="name" />
                                </div>
                              </TableHead>
                              <TableHead className="text-white">البريد الإلكتروني</TableHead>
                              <TableHead className="text-white">واتساب</TableHead>
                              <TableHead className="text-white">المنتج</TableHead>
                              <TableHead className="text-white cursor-pointer" onClick={() => handleSort('price')}>
                                <div className="flex items-center">
                                  السعر
                                  <SortIcon field="price" />
                                </div>
                              </TableHead>
                              <TableHead className="text-white cursor-pointer" onClick={() => handleSort('status')}>
                                <div className="flex items-center">
                                  الحالة
                                  <SortIcon field="status" />
                                </div>
                              </TableHead>
                              <TableHead className="text-white cursor-pointer" onClick={() => handleSort('created_at')}>
                                <div className="flex items-center">
                                  التاريخ
                                  <SortIcon field="created_at" />
                                </div>
                              </TableHead>
                              <TableHead className="text-white">الإجراءات</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedOrders.map((order) => (
                              <TableRow key={order.id} className="border-slate-700 hover:bg-slate-700/50">
                                <TableCell className="font-mono text-sm text-white">
                                  {order.order_number || order.id.slice(0, 8).toUpperCase()}
                                </TableCell>
                                <TableCell className="text-white">{order.name}</TableCell>
                                <TableCell className="text-slate-300 text-sm">{order.email}</TableCell>
                                <TableCell className="text-slate-300 text-sm">{order.whatsapp || '-'}</TableCell>
                                <TableCell className="text-slate-300 text-sm">{order.product_name}</TableCell>
                                <TableCell className="text-white">{order.price} ريال</TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      order.status === 'approved'
                                        ? 'bg-green-900/50 text-green-500 border-green-700'
                                        : order.status === 'paid'
                                        ? 'bg-blue-900/50 text-blue-500 border-blue-700'
                                        : order.status === 'rejected'
                                        ? 'bg-red-900/50 text-red-500 border-red-700'
                                        : 'bg-yellow-900/50 text-yellow-500 border-yellow-700'
                                    }
                                  >
                                    {order.status === 'approved'
                                      ? 'مقبول'
                                      : order.status === 'paid'
                                      ? 'مدفوع'
                                      : order.status === 'rejected'
                                      ? 'مرفوض'
                                      : 'قيد الانتظار'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-slate-400 text-xs">
                                  {format(new Date(order.created_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                                </TableCell>
                                <TableCell>
                                  {(order.status === 'pending' || order.status === 'paid') && order.status !== 'approved' && (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleApproveOrder(order.id)}
                                        disabled={approvingOrderId === order.id || rejectingOrderId === order.id}
                                        className="bg-green-600 hover:bg-green-700 text-white h-8"
                                      >
                                        {approvingOrderId === order.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="h-3 w-3" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleRejectOrder(order.id)}
                                        disabled={approvingOrderId === order.id || rejectingOrderId === order.id}
                                        variant="destructive"
                                        className="bg-red-600 hover:bg-red-700 h-8"
                                      >
                                        {rejectingOrderId === order.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <XCircle className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                          <p className="text-slate-300 text-sm">
                            عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedOrders.length)} من {filteredAndSortedOrders.length}
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
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-white">{analytics.totalOrders}</div>
                        <div className="text-slate-300 mt-2 text-sm">إجمالي الطلبات</div>
                      </div>
                      <ShoppingCart className="h-8 w-8 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-yellow-500">{analytics.pendingOrders}</div>
                        <div className="text-slate-300 mt-2 text-sm">قيد الانتظار</div>
                      </div>
                      <Clock className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-green-500">{analytics.approvedOrders}</div>
                        <div className="text-slate-300 mt-2 text-sm">مقبولة</div>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-blue-500">{analytics.totalRevenue.toLocaleString()}</div>
                        <div className="text-slate-300 mt-2 text-sm">إجمالي الإيرادات (ريال)</div>
                      </div>
                      <DollarSign className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Orders Over Time */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">الطلبات عبر الزمن (آخر 30 يوم)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.ordersOverTime.length > 0 ? (
                      <ChartContainer config={{ count: { label: 'عدد الطلبات' } }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={analytics.ordersOverTime}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                            <XAxis dataKey="date" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <p className="text-slate-300 text-center py-8">لا توجد بيانات</p>
                    )}
                  </CardContent>
                </Card>

                {/* Orders by Status */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">الطلبات حسب الحالة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.ordersByStatus.some(s => s.value > 0) ? (
                      <ChartContainer config={{ 
                        مقبول: { label: 'مقبول', color: '#22c55e' },
                        'قيد الانتظار': { label: 'قيد الانتظار', color: '#eab308' },
                        مرفوض: { label: 'مرفوض', color: '#ef4444' },
                      }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={analytics.ordersByStatus}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {analytics.ordersByStatus.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <p className="text-slate-300 text-center py-8">لا توجد بيانات</p>
                    )}
                  </CardContent>
                </Card>

                {/* Revenue by Product */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">الإيرادات حسب المنتج</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.revenueByProductData.length > 0 ? (
                      <ChartContainer config={{ revenue: { label: 'الإيرادات (ريال)' } }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analytics.revenueByProductData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                            <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={100} />
                            <YAxis stroke="#94a3b8" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="revenue" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <p className="text-slate-300 text-center py-8">لا توجد بيانات</p>
                    )}
                  </CardContent>
                </Card>

                {/* Orders by Day of Week */}
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">الطلبات حسب يوم الأسبوع</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.ordersByDayData.some(d => d.count > 0) ? (
                      <ChartContainer config={{ count: { label: 'عدد الطلبات' } }}>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analytics.ordersByDayData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                            <XAxis dataKey="day" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" fill="#8b5cf6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <p className="text-slate-300 text-center py-8">لا توجد بيانات</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
