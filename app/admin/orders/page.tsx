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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { 
  CheckCircle2, 
  Loader2, 
  Search, 
  Calendar as CalendarIcon,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Plus
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';

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
  promo_code_id?: string;
  is_cart_order?: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  payment_method?: string;
  payment_id?: string;
  payment_status?: string;
  assigned_subscription?: {
    code: string;
    meta?: any;
  };
  order_items?: OrderItem[];
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
  
  // Complete order state
  const [completingOrders, setCompletingOrders] = useState<Set<string>>(new Set());
  
  // Manual order creation state
  const [manualOrderDialogOpen, setManualOrderDialogOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [availableSubscriptionCodes, setAvailableSubscriptionCodes] = useState<any[]>([]);
  const [loadingSubscriptionCodes, setLoadingSubscriptionCodes] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_whatsapp: '',
    product_code: '',
    product_name: '',
    price: '',
    payment_status: 'unpaid' as 'paid' | 'unpaid',
    selected_subscription_code: '', // Optional: manually select subscription code
  });

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
        fetchProducts();
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

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: 'خطأ',
          description: 'يرجى تسجيل الدخول',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/admin/products', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل في جلب المنتجات');
      }
      
      const result = await response.json();
      setProducts(result.products || []);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في جلب المنتجات',
        variant: 'destructive',
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchOrders = async () => {
    try {
      // Fetch paid, approved, and pending orders with order_items for cart orders
      // Explicitly select status field to ensure we get the correct value from database
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          name,
          email,
          whatsapp,
          product_name,
          product_code,
          price,
          total_amount,
          discount_amount,
          promo_code_id,
          is_cart_order,
          status,
          payment_method,
          payment_id,
          payment_status,
          assigned_subscription,
          created_at,
          order_items (*)
        `)
        .in('status', ['paid', 'approved', 'pending']) // Fetch paid, approved, and pending orders
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        
        if (error.message?.includes('permission denied') || error.message?.includes('denied')) {
          toast({
            title: 'خطأ في الصلاحيات',
            description: 'لا يوجد لديك صلاحية لعرض الطلبات. يرجى التحقق من إعدادات قاعدة البيانات (RLS policies).',
            variant: 'destructive',
          });
        } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          toast({
            title: 'خطأ في قاعدة البيانات',
            description: 'جدول الطلبات غير موجود. يرجى تشغيل SQL في Supabase أولاً.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'خطأ',
            description: error.message || 'حدث خطأ أثناء جلب الطلبات',
            variant: 'destructive',
          });
        }
        return;
      }

      // Debug: Log order YAFBBUEG if found in raw data
      if (data) {
        const yafOrder = (data as Order[]).find(o => 
          o.order_number === 'YAFBBUEG' || 
          o.id.slice(0, 8).toUpperCase() === 'YAFBBUEG'
        );
        if (yafOrder) {
          console.log('🔍 FOUND YAFBBUEG in raw database response:', {
            order_number: yafOrder.order_number,
            id: yafOrder.id,
            status_from_db: yafOrder.status,
            status_type: typeof yafOrder.status,
            payment_status: yafOrder.payment_status,
            raw_data: yafOrder
          });
        }
      }

      // Filter out incomplete orders, abandoned carts, and abandoned payment attempts
      // Only show orders with proper customer info and valid data
      const validOrders = (data as Order[] || []).filter(order => {
        // Must have name and email
        if (!order.name || !order.email || order.name.trim() === '' || order.email.trim() === '') {
          return false;
        }
        
        // Must have a valid product name
        if (!order.product_name || order.product_name.trim() === '') {
          return false;
        }
        
        // Must have a valid price
        if (!order.price || order.price <= 0) {
          return false;
        }
        
        // Exclude orders that look like abandoned cart placeholders
        // (orders without proper payment flow or customer data)
        // If it's a cart order, ensure it has order_items
        if (order.is_cart_order && (!order.order_items || order.order_items.length === 0)) {
          return false;
        }
        
        // Filter out abandoned payment attempts - orders where user clicked pay but abandoned
        // These are: pending status + payment_method set + payment_status not COMPLETED
        // These will appear in abandoned carts page, so don't show in orders
        if (order.status === 'pending' && 
            order.payment_method && 
            order.payment_method.includes('paypal') &&
            order.payment_status !== 'COMPLETED') {
          // This is an abandoned payment - exclude it
          return false;
        }
        
        return true;
      });

      setOrders(validOrders);
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
    const paidOrders = filtered.filter(o => o.status === 'paid').length;
    const approvedOrders = filtered.filter(o => o.status === 'approved').length;
    const totalRevenue = filtered.reduce((sum, o) => sum + Number(o.total_amount || o.price), 0);

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
      { name: 'مدفوع', value: paidOrders, color: '#3b82f6' },
      { name: 'مقبول', value: approvedOrders, color: '#22c55e' },
    ];

    // Revenue by product
    const revenueByProduct: { [key: string]: number } = {};
    filtered.forEach(order => {
      const productName = order.product_name || 'غير محدد';
      revenueByProduct[productName] = (revenueByProduct[productName] || 0) + Number(order.total_amount || order.price);
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
      paidOrders,
      approvedOrders,
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

  const handleCompleteOrder = async (orderId: string) => {
    setCompletingOrders(prev => new Set(prev).add(orderId));
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: 'خطأ',
          description: 'يرجى تسجيل الدخول',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/admin/orders/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في تحديث حالة الطلب');
      }

      toast({
        title: 'نجح',
        description: result.message || 'تم تحديث حالة الطلب إلى مدفوع بنجاح',
      });

      // Refresh orders to show updated status
      router.refresh();
      // Reload orders
      const { data: { session: newSession } } = await supabase.auth.getSession();
      if (newSession) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .in('status', ['paid', 'approved', 'pending'])
          .order('created_at', { ascending: false });
        
        if (!ordersError && ordersData) {
          setOrders(ordersData as Order[]);
        }
      }
    } catch (error: any) {
      console.error('Error completing order:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث حالة الطلب',
        variant: 'destructive',
      });
    } finally {
      setCompletingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handleManualOrderSubmit = async () => {
    // Validation
    if (!manualOrderForm.customer_name || !manualOrderForm.customer_email || !manualOrderForm.product_name || !manualOrderForm.price) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive',
      });
      return;
    }

    setCreatingOrder(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({
          title: 'خطأ',
          description: 'يرجى تسجيل الدخول',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/admin/orders/create-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          customer_name: manualOrderForm.customer_name,
          customer_email: manualOrderForm.customer_email,
          customer_whatsapp: manualOrderForm.customer_whatsapp || null,
          product_code: manualOrderForm.product_code || null,
          product_name: manualOrderForm.product_name,
          price: parseFloat(manualOrderForm.price),
          payment_status: manualOrderForm.payment_status,
          selected_subscription_code: manualOrderForm.selected_subscription_code || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إنشاء الطلب');
      }

      toast({
        title: 'نجح',
        description: result.message || 'تم إنشاء الطلب بنجاح',
      });

      // Reset form
      setManualOrderForm({
        customer_name: '',
        customer_email: '',
        customer_whatsapp: '',
        product_code: '',
        product_name: '',
        price: '',
        payment_status: 'unpaid',
        selected_subscription_code: '',
      });
      setAvailableSubscriptionCodes([]);
      setManualOrderDialogOpen(false);

      // Refresh orders list
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          name,
          email,
          whatsapp,
          product_name,
          product_code,
          price,
          total_amount,
          discount_amount,
          promo_code_id,
          is_cart_order,
          status,
          payment_method,
          payment_id,
          payment_status,
          assigned_subscription,
          created_at,
          order_items (*)
        `)
        .in('status', ['paid', 'approved', 'pending'])
        .order('created_at', { ascending: false });
      
      if (!ordersError && ordersData) {
        setOrders(ordersData as Order[]);
      }

      if (result.warning) {
        toast({
          title: 'تحذير',
          description: result.warning,
          variant: 'default',
        });
      }
    } catch (error: any) {
      console.error('Error creating manual order:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إنشاء الطلب',
        variant: 'destructive',
      });
    } finally {
      setCreatingOrder(false);
    }
  };

  const fetchAvailableSubscriptionCodes = async (productCode: string) => {
    if (!productCode) {
      setAvailableSubscriptionCodes([]);
      return;
    }

    setLoadingSubscriptionCodes(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const response = await fetch(`/api/admin/products/subscription-codes?product_code=${encodeURIComponent(productCode)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('فشل في جلب رموز الاشتراكات المتاحة');
      }

      const result = await response.json();
      setAvailableSubscriptionCodes(result.subscriptionCodes || []);
    } catch (error: any) {
      console.error('Error fetching subscription codes:', error);
      toast({
        title: 'تحذير',
        description: 'فشل في جلب رموز الاشتراكات المتاحة',
        variant: 'default',
      });
      setAvailableSubscriptionCodes([]);
    } finally {
      setLoadingSubscriptionCodes(false);
    }
  };

  const handleProductSelect = (productCode: string) => {
    const product = products.find(p => p.product_code === productCode);
    if (product) {
      setManualOrderForm({
        ...manualOrderForm,
        product_code: product.product_code,
        product_name: product.name,
        price: product.price.toString(),
        selected_subscription_code: '', // Reset selected subscription code
      });
      
      // Fetch available subscription codes for this product
      fetchAvailableSubscriptionCodes(product.product_code);
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
      (order.total_amount || order.price).toString(),
      order.status === 'paid' ? 'مدفوع' : order.status === 'approved' ? 'مقبول' : order.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار',
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
            <div className="flex gap-2">
              <Button 
                onClick={() => setManualOrderDialogOpen(true)} 
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة طلب
              </Button>
              <Button onClick={exportToCSV} variant="outline" className="bg-slate-800 text-white border-slate-700">
                <Download className="h-4 w-4 ml-2" />
                تصدير CSV
              </Button>
            </div>
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
                        <SelectItem value="paid">مدفوع</SelectItem>
                        <SelectItem value="approved">مقبول</SelectItem>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                <Card className="bg-indigo-900/20 border-indigo-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-indigo-500">{analytics.paidOrders}</div>
                        <div className="text-slate-300 mt-2 text-sm">طلبات مدفوعة</div>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-indigo-500 opacity-50" />
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
                <Card className="bg-emerald-900/20 border-emerald-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-3xl font-bold text-emerald-500">{analytics.totalRevenue.toLocaleString()}</div>
                        <div className="text-slate-300 mt-2 text-sm">إجمالي الإيرادات (ريال)</div>
                      </div>
                      <DollarSign className="h-8 w-8 text-emerald-500 opacity-50" />
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
                              <TableHead className="text-white">طريقة الدفع</TableHead>
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
                                <TableCell className="text-slate-300 text-sm">
                                  {order.is_cart_order && order.order_items && order.order_items.length > 0 ? (
                                    <div className="space-y-1">
                                      <div className="font-semibold text-blue-400 mb-1">
                                        🛒 طلب سلة ({order.order_items.length} منتج)
                                      </div>
                                      {order.order_items.map((item: OrderItem) => (
                                        <div key={item.id} className="text-xs text-slate-400 border-r-2 border-slate-600 pr-2 mr-2">
                                          • {item.product_name} (x{item.quantity}) - {item.price * item.quantity} ريال
                                        </div>
                                      ))}
                                      {order.discount_amount && order.discount_amount > 0 && (
                                        <div className="text-xs text-green-400 mt-1">
                                          خصم: -{order.discount_amount} ريال
                                        </div>
                                      )}
                                      {order.total_amount && (
                                        <div className="text-xs font-semibold text-white mt-1">
                                          المجموع: {order.total_amount} ريال
                                        </div>
                                      )}
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
                                <TableCell>
                                  {(() => {
                                    // Force read status directly from order object - ensure no transformation
                                    const dbStatus = String(order.status || '').toLowerCase().trim();
                                    
                                    // Debug log for specific order
                                    if (order.order_number === 'YAFBBUEG' || order.id.slice(0, 8).toUpperCase() === 'YAFBBUEG') {
                                      console.log('🔍 Order YAFBBUEG status debug:', {
                                        order_number: order.order_number,
                                        id: order.id,
                                        status_raw: order.status,
                                        status_type: typeof order.status,
                                        status_normalized: dbStatus,
                                        payment_status: order.payment_status,
                                        full_order: JSON.stringify(order, null, 2)
                                      });
                                    }
                                    
                                    // Determine badge color and text based on normalized status
                                    let badgeText = 'قيد الانتظار';
                                    let badgeClass = 'bg-yellow-900/50 text-yellow-500 border-yellow-700';
                                    
                                    if (dbStatus === 'approved') {
                                      badgeText = 'مقبول';
                                      badgeClass = 'bg-green-900/50 text-green-500 border-green-700';
                                    } else if (dbStatus === 'paid') {
                                      badgeText = 'مدفوع';
                                      badgeClass = 'bg-blue-900/50 text-blue-500 border-blue-700';
                                    } else if (dbStatus === 'rejected') {
                                      badgeText = 'مرفوض';
                                      badgeClass = 'bg-red-900/50 text-red-500 border-red-700';
                                    } else if (dbStatus === 'pending') {
                                      badgeText = 'قيد الانتظار';
                                      badgeClass = 'bg-yellow-900/50 text-yellow-500 border-yellow-700';
                                    } else {
                                      // Unknown status - show it for debugging
                                      badgeText = `غير معروف (${order.status})`;
                                      badgeClass = 'bg-gray-900/50 text-gray-500 border-gray-700';
                                    }
                                    
                                    return (
                                      <Badge className={badgeClass}>
                                        {badgeText}
                                      </Badge>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="text-slate-300 text-sm">
                                  {(() => {
                                    if (!order.payment_method) return '-';
                                    const method = order.payment_method.toLowerCase();
                                    if (method === 'promo_code_100') {
                                      return <Badge className="bg-purple-900/50 text-purple-400 border-purple-700">كود خصم 100%</Badge>;
                                    } else if (method === 'manual') {
                                      return <Badge className="bg-orange-900/50 text-orange-400 border-orange-700">يدوي</Badge>;
                                    } else if (method.includes('paypal')) {
                                      return <Badge className="bg-blue-900/50 text-blue-400 border-blue-700">PayPal</Badge>;
                                    } else {
                                      return <span className="text-slate-400">{order.payment_method}</span>;
                                    }
                                  })()}
                                </TableCell>
                                <TableCell className="text-slate-400 text-xs">
                                  {format(new Date(order.created_at), 'yyyy-MM-dd HH:mm', { locale: ar })}
                                </TableCell>
                                <TableCell>
                                  {/* Show mark as paid button for pending orders */}
                                  {order.status === 'pending' && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleCompleteOrder(order.id)}
                                      disabled={completingOrders.has(order.id)}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      {completingOrders.has(order.id) ? (
                                        <>
                                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                                          جاري المعالجة...
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="h-4 w-4 ml-2" />
                                          تم الاستلام
                                        </>
                                      )}
                                    </Button>
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
                        <div className="text-3xl font-bold text-blue-500">{analytics.paidOrders}</div>
                        <div className="text-slate-300 mt-2 text-sm">طلبات مدفوعة</div>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-blue-500" />
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

      {/* Manual Order Creation Dialog */}
      <Dialog open={manualOrderDialogOpen} onOpenChange={setManualOrderDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة طلب يدوياً</DialogTitle>
            <DialogDescription className="text-slate-400">
              أضف طلب جديد يدوياً مع معلومات العميل وحالة الدفع
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="col-span-2">
              <Label>اسم العميل *</Label>
              <Input
                value={manualOrderForm.customer_name}
                onChange={(e) => setManualOrderForm({ ...manualOrderForm, customer_name: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-1"
                placeholder="أدخل اسم العميل"
              />
            </div>
            <div>
              <Label>البريد الإلكتروني *</Label>
              <Input
                type="email"
                value={manualOrderForm.customer_email}
                onChange={(e) => setManualOrderForm({ ...manualOrderForm, customer_email: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-1"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label>رقم الواتساب (اختياري)</Label>
              <Input
                value={manualOrderForm.customer_whatsapp}
                onChange={(e) => setManualOrderForm({ ...manualOrderForm, customer_whatsapp: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-1"
                placeholder="966501234567"
              />
            </div>
            <div className="col-span-2">
              <Label>المنتج *</Label>
              <Select
                value={manualOrderForm.product_code}
                onValueChange={handleProductSelect}
                disabled={loadingProducts}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                  <SelectValue placeholder={loadingProducts ? "جاري التحميل..." : "اختر المنتج"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.product_code} value={product.product_code}>
                      {product.name} ({product.product_code}) - {product.price} ريال
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {manualOrderForm.product_code && (
                <p className="text-xs text-slate-400 mt-1">
                  {loadingSubscriptionCodes ? (
                    'جاري جلب رموز الاشتراكات المتاحة...'
                  ) : (
                    `رموز الاشتراكات المتاحة: ${availableSubscriptionCodes.length}`
                  )}
                </p>
              )}
            </div>
            {manualOrderForm.product_code && availableSubscriptionCodes.length > 0 && manualOrderForm.payment_status === 'paid' && (
              <div className="col-span-2">
                <Label>اختر رمز الاشتراك (اختياري)</Label>
                <Select
                  value={manualOrderForm.selected_subscription_code}
                  onValueChange={(value) => setManualOrderForm({ ...manualOrderForm, selected_subscription_code: value })}
                  disabled={loadingSubscriptionCodes}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue placeholder="اختر رمز الاشتراك (سيتم اختيار واحد تلقائياً إذا لم تختر)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">تلقائي (اختيار عشوائي)</SelectItem>
                    {availableSubscriptionCodes.map((sub) => (
                      <SelectItem key={sub.id} value={sub.subscription_code}>
                        {sub.subscription_code} {sub.subscription_meta?.duration ? `(${sub.subscription_meta.duration})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-1">
                  إذا لم تختر رمزاً، سيتم اختيار واحد تلقائياً من المتوفر
                </p>
              </div>
            )}
            <div>
              <Label>السعر *</Label>
              <Input
                type="number"
                value={manualOrderForm.price}
                onChange={(e) => setManualOrderForm({ ...manualOrderForm, price: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-1"
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
            <div className="col-span-2">
              <Label>حالة الدفع *</Label>
              <RadioGroup
                value={manualOrderForm.payment_status}
                onValueChange={(value: 'paid' | 'unpaid') => {
                  setManualOrderForm({ ...manualOrderForm, payment_status: value, selected_subscription_code: value === 'unpaid' ? '' : manualOrderForm.selected_subscription_code });
                  // Refresh subscription codes if switching to paid
                  if (value === 'paid' && manualOrderForm.product_code) {
                    fetchAvailableSubscriptionCodes(manualOrderForm.product_code);
                  }
                }}
                className="mt-2"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="paid" id="paid" />
                  <Label htmlFor="paid" className="cursor-pointer">مدفوع (سيتم تعيين الاشتراك تلقائياً)</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="unpaid" id="unpaid" />
                  <Label htmlFor="unpaid" className="cursor-pointer">غير مدفوع</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setManualOrderDialogOpen(false)}
              className="border-slate-600 text-slate-300"
              disabled={creatingOrder}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleManualOrderSubmit}
              disabled={creatingOrder || !manualOrderForm.customer_name || !manualOrderForm.customer_email || !manualOrderForm.product_name || !manualOrderForm.price}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {creatingOrder ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                'إنشاء الطلب'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
