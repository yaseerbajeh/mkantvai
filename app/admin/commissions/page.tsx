'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  Loader2,
  Plus,
  Search,
  User,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  X,
  Edit,
  Eye,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Commissioner {
  id: string;
  email: string;
  name: string | null;
  promo_code: string;
  commission_rate: number;
  is_active: boolean;
  total_earnings: number;
  pending_payouts: number;
  paid_out: number;
  created_at: string;
}

interface Stats {
  totalWorkers: number;
  avgCommissionRate: number;
  pendingPayouts: number;
}

export default function AdminCommissionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [commissioners, setCommissioners] = useState<Commissioner[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalWorkers: 0,
    avgCommissionRate: 0,
    pendingPayouts: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCommissioner, setEditingCommissioner] = useState<Commissioner | null>(null);
  const [newCommissionerEmail, setNewCommissionerEmail] = useState('');
  const [newCommissionerName, setNewCommissionerName] = useState('');
  const [newCommissionRate, setNewCommissionRate] = useState('10');
  const [newPromoCode, setNewPromoCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

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
        await fetchCommissioners();
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

  const fetchCommissioners = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/commissions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('فشل جلب البيانات');
      }

      const result = await response.json();
      setCommissioners(result.commissioners || []);
      setStats(result.stats || {
        totalWorkers: 0,
        avgCommissionRate: 0,
        pendingPayouts: 0,
      });
    } catch (error: any) {
      console.error('Error fetching commissioners:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء جلب البيانات',
        variant: 'destructive',
      });
    }
  };

  const handleAddCommissioner = async () => {
    if (!newCommissionerEmail || !newCommissionRate) {
      toast({
        title: 'خطأ',
        description: 'البريد الإلكتروني ومعدل العمولة مطلوبان',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/commissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: newCommissionerEmail,
          name: newCommissionerName || null,
          commission_rate: parseFloat(newCommissionRate),
          promo_code: newPromoCode || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل إنشاء المفوض');
      }

      const result = await response.json();
      
      toast({
        title: 'نجح',
        description: `تم إنشاء المفوض بنجاح. الرمز الترويجي: ${result.commissioner.promo_code}`,
        duration: 10000,
      });

      setAddDialogOpen(false);
      setNewCommissionerEmail('');
      setNewCommissionerName('');
      setNewCommissionRate('10');
      setNewPromoCode('');
      await fetchCommissioners();
    } catch (error: any) {
      console.error('Error creating commissioner:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إنشاء المفوض',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEditCommissioner = (commissioner: Commissioner) => {
    setEditingCommissioner(commissioner);
    setNewCommissionerEmail(commissioner.email);
    setNewCommissionerName(commissioner.name || '');
    setNewCommissionRate(((commissioner.commission_rate as number) * 100).toString());
    setNewPromoCode(commissioner.promo_code);
    setEditDialogOpen(true);
  };

  const handleUpdateCommissioner = async () => {
    if (!editingCommissioner || !newCommissionerEmail || !newCommissionRate || !newPromoCode) {
      toast({
        title: 'خطأ',
        description: 'جميع الحقول المطلوبة يجب أن تكون مملوءة',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/commissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: editingCommissioner.id,
          email: newCommissionerEmail,
          name: newCommissionerName || null,
          commission_rate: parseFloat(newCommissionRate),
          promo_code: newPromoCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل تحديث المفوض');
      }

      toast({
        title: 'نجح',
        description: 'تم تحديث المفوض بنجاح',
      });

      setEditDialogOpen(false);
      setEditingCommissioner(null);
      setNewCommissionerEmail('');
      setNewCommissionerName('');
      setNewCommissionRate('10');
      setNewPromoCode('');
      await fetchCommissioners();
    } catch (error: any) {
      console.error('Error updating commissioner:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث المفوض',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const filteredCommissioners = commissioners.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.email.toLowerCase().includes(query) ||
      c.name?.toLowerCase().includes(query) ||
      c.promo_code.toLowerCase().includes(query) ||
      `WKR${String(c.id).slice(0, 3).toUpperCase()}`.toLowerCase().includes(query)
    );
  });

  const getCommissionerId = (id: string) => {
    return `WKR${String(id).slice(0, 8).toUpperCase().padStart(3, '0')}`;
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">لوحة تحكم العمولات</h1>
              <p className="text-gray-600">إدارة المفوضين والعمولات</p>
            </div>
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              إضافة مفوض
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0">
              <CardContent className="p-6">
                <div className="text-white">
                  <p className="text-blue-100 text-sm mb-2">إجمالي العمال</p>
                  <p className="text-4xl font-bold">{stats.totalWorkers}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0">
              <CardContent className="p-6">
                <div className="text-white">
                  <p className="text-blue-100 text-sm mb-2">متوسط معدل العمولة</p>
                  <div className="flex items-center gap-2">
                    <p className="text-4xl font-bold">{stats.avgCommissionRate.toFixed(1)}%</p>
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0">
              <CardContent className="p-6">
                <div className="text-white">
                  <p className="text-blue-100 text-sm mb-2">المدفوعات المعلقة</p>
                  <p className="text-4xl font-bold">${stats.pendingPayouts.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="البحث عن عامل بالاسم أو المعرف"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 bg-white border-gray-300 text-gray-900"
              />
            </div>
          </div>

          {/* Worker Profiles */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">ملفات العمال</h2>
            <div className="space-y-4">
              {filteredCommissioners.map((commissioner) => {
                const targetMet = commissioner.total_earnings > 0 
                  ? Math.min(100, (commissioner.total_earnings / (commissioner.total_earnings + 1000)) * 100)
                  : 0;
                
                return (
                  <Card key={commissioner.id} className="bg-white border-0">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {getInitials(commissioner.name, commissioner.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {commissioner.name || commissioner.email}
                              </h3>
                              <p className="text-sm text-gray-500">{getCommissionerId(commissioner.id)}</p>
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-semibold text-gray-900">
                                المعدل: {((commissioner.commission_rate as number) * 100).toFixed(0)}%
                              </p>
                              {commissioner.is_active ? (
                                <div className="flex items-center gap-1 text-green-600 mt-1">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-sm">نشط</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-red-600 mt-1">
                                  <X className="h-4 w-4" />
                                  <span className="text-sm">غير نشط</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {targetMet > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-600">تحقيق الهدف: {targetMet.toFixed(0)}%</span>
                              </div>
                              <Progress value={targetMet} className="h-2" />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              router.push(`/admin/commissions/${commissioner.id}/payouts`);
                            }}
                            className="cursor-pointer"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            عرض المدفوعات
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditCommissioner(commissioner)}
                            className="cursor-pointer"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            إدارة
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <Footer />

      {/* Add Commissioner Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">إضافة مفوض جديد</DialogTitle>
            <DialogDescription className="text-gray-600">
              أدخل معلومات المفوض الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-gray-900">البريد الإلكتروني *</Label>
              <Input
                id="email"
                type="email"
                value={newCommissionerEmail}
                onChange={(e) => setNewCommissionerEmail(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="example@email.com"
              />
            </div>
            <div>
              <Label htmlFor="name" className="text-gray-900">الاسم (اختياري)</Label>
              <Input
                id="name"
                type="text"
                value={newCommissionerName}
                onChange={(e) => setNewCommissionerName(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="اسم المفوض"
              />
            </div>
            <div>
              <Label htmlFor="rate" className="text-gray-900">معدل العمولة (%) *</Label>
              <Input
                id="rate"
                type="number"
                min="0"
                max="100"
                value={newCommissionRate}
                onChange={(e) => setNewCommissionRate(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="10"
              />
              <p className="text-xs text-gray-500 mt-1">أدخل النسبة المئوية (مثلاً: 10 لـ 10%)</p>
            </div>
            <div>
              <Label htmlFor="promo_code" className="text-gray-900">الرمز الترويجي (اختياري)</Label>
              <Input
                id="promo_code"
                type="text"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="أدخل رمز مخصص أو اتركه فارغاً للإنشاء التلقائي"
              />
              <p className="text-xs text-gray-500 mt-1">سيتم تحويله إلى أحرف كبيرة تلقائياً</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setNewPromoCode('');
              }}
              className="border-gray-300 text-gray-700"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleAddCommissioner}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                'إنشاء'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Commissioner Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">تعديل المفوض</DialogTitle>
            <DialogDescription className="text-gray-600">
              قم بتعديل معلومات المفوض
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_email" className="text-gray-900">البريد الإلكتروني *</Label>
              <Input
                id="edit_email"
                type="email"
                value={newCommissionerEmail}
                onChange={(e) => setNewCommissionerEmail(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="example@email.com"
              />
            </div>
            <div>
              <Label htmlFor="edit_name" className="text-gray-900">الاسم (اختياري)</Label>
              <Input
                id="edit_name"
                type="text"
                value={newCommissionerName}
                onChange={(e) => setNewCommissionerName(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="اسم المفوض"
              />
            </div>
            <div>
              <Label htmlFor="edit_rate" className="text-gray-900">معدل العمولة (%) *</Label>
              <Input
                id="edit_rate"
                type="number"
                min="0"
                max="100"
                value={newCommissionRate}
                onChange={(e) => setNewCommissionRate(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="10"
              />
              <p className="text-xs text-gray-500 mt-1">أدخل النسبة المئوية (مثلاً: 10 لـ 10%)</p>
            </div>
            <div>
              <Label htmlFor="edit_promo_code" className="text-gray-900">الرمز الترويجي *</Label>
              <Input
                id="edit_promo_code"
                type="text"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                className="bg-white border-gray-300 text-gray-900 mt-1"
                placeholder="الرمز الترويجي"
              />
              <p className="text-xs text-gray-500 mt-1">سيتم تحويله إلى أحرف كبيرة تلقائياً</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingCommissioner(null);
                setNewPromoCode('');
              }}
              className="border-gray-300 text-gray-700"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleUpdateCommissioner}
              disabled={updating}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  جاري التحديث...
                </>
              ) : (
                'حفظ'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

