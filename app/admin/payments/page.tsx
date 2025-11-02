'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, 
  Search, 
  CheckCircle2,
  CreditCard,
  DollarSign,
  TrendingUp,
  Filter
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface PaymentOrder {
  id: string;
  order_number?: string;
  name: string;
  email: string;
  whatsapp?: string;
  product_name: string;
  product_code?: string;
  price: number;
  status: 'paid' | 'approved';
  payment_method: string;
  payment_id?: string;
  payment_status?: string;
  assigned_subscription?: {
    code: string;
    meta?: any;
  };
  created_at: string;
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentOrder[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          router.push('/auth');
          return;
        }

        const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
        if (adminEmailsStr) {
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

        // Fetch PayPal payments (orders with payment_method = 'paypal')
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .in('status', ['paid', 'approved'])
          .eq('payment_method', 'paypal')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setPayments((data as PaymentOrder[]) || []);
        setFilteredPayments((data as PaymentOrder[]) || []);
      } catch (error: any) {
        console.error('Error fetching payments:', error);
        toast({
          title: 'خطأ',
          description: 'فشل في جلب المدفوعات',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPayments(payments);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = payments.filter(payment => 
      payment.name.toLowerCase().includes(query) ||
      payment.email.toLowerCase().includes(query) ||
      payment.product_name.toLowerCase().includes(query) ||
      (payment.order_number && payment.order_number.toLowerCase().includes(query)) ||
      (payment.payment_id && payment.payment_id.toLowerCase().includes(query))
    );
    setFilteredPayments(filtered);
  }, [searchQuery, payments]);

  // Calculate statistics
  const stats = {
    totalPayments: payments.length,
    totalRevenue: payments.reduce((sum, p) => sum + parseFloat(p.price as any), 0),
    paidOrders: payments.filter(p => p.status === 'paid').length,
    approvedOrders: payments.filter(p => p.status === 'approved').length,
  };

  const getStatusBadge = (status: string) => {
    if (status === 'approved') {
      return <Badge className="bg-green-900/20 text-green-400 border-green-700">مقبول</Badge>;
    }
    return <Badge className="bg-blue-900/20 text-blue-400 border-blue-700">مدفوع</Badge>;
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
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">نظام الدفع - PayPal</h1>
            <p className="text-slate-300">عرض وإدارة جميع المدفوعات عبر PayPal</p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">إجمالي المدفوعات</p>
                    <p className="text-2xl font-bold text-white">{stats.totalPayments}</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">إجمالي الإيرادات</p>
                    <p className="text-2xl font-bold text-white">{stats.totalRevenue.toFixed(2)} ريال</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">طلبات مدفوعة</p>
                    <p className="text-2xl font-bold text-blue-400">{stats.paidOrders}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">طلبات مقبولة</p>
                    <p className="text-2xl font-bold text-green-400">{stats.approvedOrders}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="ابحث بالاسم، البريد الإلكتروني، المنتج، أو رقم الطلب..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white pr-10"
                    dir="rtl"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments Table */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-2xl text-white">قائمة المدفوعات</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPayments.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-300 text-lg">
                    {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد مدفوعات حتى الآن'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">رقم الطلب</TableHead>
                        <TableHead className="text-slate-300">الاسم</TableHead>
                        <TableHead className="text-slate-300">البريد الإلكتروني</TableHead>
                        <TableHead className="text-slate-300">المنتج</TableHead>
                        <TableHead className="text-slate-300">السعر</TableHead>
                        <TableHead className="text-slate-300">الحالة</TableHead>
                        <TableHead className="text-slate-300">معرف الدفع</TableHead>
                        <TableHead className="text-slate-300">الاشتراك</TableHead>
                        <TableHead className="text-slate-300">التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id} className="border-slate-700">
                          <TableCell className="font-mono text-sm text-white">
                            {payment.order_number || payment.id.slice(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell className="text-white">{payment.name}</TableCell>
                          <TableCell className="text-slate-300">{payment.email}</TableCell>
                          <TableCell className="text-white">{payment.product_name}</TableCell>
                          <TableCell className="text-white font-semibold">
                            {payment.price} ريال
                          </TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-400">
                            {payment.payment_id ? payment.payment_id.slice(0, 12) + '...' : '-'}
                          </TableCell>
                          <TableCell>
                            {payment.assigned_subscription ? (
                              <Badge className="bg-green-900/20 text-green-400 border-green-700">
                                {payment.assigned_subscription.code}
                              </Badge>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">
                            {new Date(payment.created_at).toLocaleString('ar-SA')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

