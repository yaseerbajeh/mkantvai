'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Edit,
  Trash2,
  Search,
  Tag,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  used_count: number;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
}

export default function AdminPromoCodesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [promoCodeDialogOpen, setPromoCodeDialogOpen] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<PromoCode | null>(null);
  const [deletingPromoCodeId, setDeletingPromoCodeId] = useState<string | null>(null);
  const [promoCodeForm, setPromoCodeForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    min_purchase_amount: '',
    max_discount_amount: '',
    usage_limit: '',
    is_active: true,
    valid_from: '',
    valid_until: '',
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

  useEffect(() => {
    if (user) {
      fetchPromoCodes();
    }
  }, [user]);

  const fetchPromoCodes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/promo-codes', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في جلب رموز الخصم');
      }

      setPromoCodes(result.promoCodes || []);
    } catch (error: any) {
      console.error('Fetch promo codes error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في جلب رموز الخصم',
        variant: 'destructive',
      });
    }
  };

  const handleCreatePromoCode = () => {
    setEditingPromoCode(null);
    setPromoCodeForm({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      min_purchase_amount: '',
      max_discount_amount: '',
      usage_limit: '',
      is_active: true,
      valid_from: '',
      valid_until: '',
    });
    setPromoCodeDialogOpen(true);
  };

  const handleEditPromoCode = (promoCode: PromoCode) => {
    setEditingPromoCode(promoCode);
    setPromoCodeForm({
      code: promoCode.code,
      description: promoCode.description || '',
      discount_type: promoCode.discount_type,
      discount_value: promoCode.discount_value.toString(),
      min_purchase_amount: promoCode.min_purchase_amount?.toString() || '',
      max_discount_amount: promoCode.max_discount_amount?.toString() || '',
      usage_limit: promoCode.usage_limit?.toString() || '',
      is_active: promoCode.is_active,
      valid_from: promoCode.valid_from ? new Date(promoCode.valid_from).toISOString().split('T')[0] : '',
      valid_until: promoCode.valid_until ? new Date(promoCode.valid_until).toISOString().split('T')[0] : '',
    });
    setPromoCodeDialogOpen(true);
  };

  const handleSavePromoCode = async () => {
    if (!promoCodeForm.code || !promoCodeForm.discount_value) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const payload: any = {
        code: promoCodeForm.code,
        description: promoCodeForm.description || null,
        discount_type: promoCodeForm.discount_type,
        discount_value: parseFloat(promoCodeForm.discount_value),
        is_active: promoCodeForm.is_active,
      };

      if (promoCodeForm.min_purchase_amount) {
        payload.min_purchase_amount = parseFloat(promoCodeForm.min_purchase_amount);
      }
      if (promoCodeForm.max_discount_amount) {
        payload.max_discount_amount = parseFloat(promoCodeForm.max_discount_amount);
      }
      if (promoCodeForm.usage_limit) {
        payload.usage_limit = parseInt(promoCodeForm.usage_limit);
      }
      if (promoCodeForm.valid_from) {
        payload.valid_from = new Date(promoCodeForm.valid_from).toISOString();
      }
      if (promoCodeForm.valid_until) {
        payload.valid_until = new Date(promoCodeForm.valid_until).toISOString();
      }

      const url = '/api/admin/promo-codes';
      const method = editingPromoCode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(editingPromoCode ? { id: editingPromoCode.id, ...payload } : payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في حفظ رمز الخصم');
      }

      toast({
        title: 'نجح',
        description: editingPromoCode ? 'تم تحديث رمز الخصم بنجاح' : 'تم إضافة رمز الخصم بنجاح',
      });

      setPromoCodeDialogOpen(false);
      fetchPromoCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ رمز الخصم',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePromoCode = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch(`/api/admin/promo-codes?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في حذف رمز الخصم');
      }

      toast({
        title: 'نجح',
        description: 'تم حذف رمز الخصم بنجاح',
      });

      setDeletingPromoCodeId(null);
      fetchPromoCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف رمز الخصم',
        variant: 'destructive',
      });
    }
  };

  const toggleActiveStatus = async (promoCode: PromoCode) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch('/api/admin/promo-codes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: promoCode.id,
          is_active: !promoCode.is_active,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في تحديث حالة رمز الخصم');
      }

      fetchPromoCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث حالة رمز الخصم',
        variant: 'destructive',
      });
    }
  };

  const filteredPromoCodes = promoCodes.filter((pc) => {
    const matchesSearch = pc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pc.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    const matchesActive = activeFilter === 'all' ||
      (activeFilter === 'active' && pc.is_active) ||
      (activeFilter === 'inactive' && !pc.is_active);
    return matchesSearch && matchesActive;
  });

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
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">إدارة رموز الخصم</h1>
              <p className="text-slate-300">إنشاء وإدارة رموز الخصم الترويجية</p>
            </div>
            <Button onClick={handleCreatePromoCode} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 ml-2" />
              إضافة رمز خصم جديد
            </Button>
          </div>

          {/* Filters */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="ابحث عن رمز الخصم..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white pr-10"
                  />
                </div>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="تصفية حسب الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Promo Codes Table */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-white">الرمز</TableHead>
                    <TableHead className="text-white">الوصف</TableHead>
                    <TableHead className="text-white">نوع الخصم</TableHead>
                    <TableHead className="text-white">قيمة الخصم</TableHead>
                    <TableHead className="text-white">الاستخدام</TableHead>
                    <TableHead className="text-white">الحالة</TableHead>
                    <TableHead className="text-white">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-white">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromoCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                        لا توجد رموز خصم
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPromoCodes.map((promoCode) => (
                      <TableRow key={promoCode.id} className="border-slate-700">
                        <TableCell className="text-white font-semibold">{promoCode.code}</TableCell>
                        <TableCell className="text-slate-300">
                          {promoCode.description || '-'}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {promoCode.discount_type === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {promoCode.discount_type === 'percentage'
                            ? `${promoCode.discount_value}%`
                            : `${promoCode.discount_value} ريال`}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {promoCode.usage_limit
                            ? `${promoCode.used_count} / ${promoCode.usage_limit}`
                            : `${promoCode.used_count} استخدام`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={promoCode.is_active ? 'default' : 'secondary'}
                            className={promoCode.is_active ? 'bg-green-600' : 'bg-slate-600'}
                          >
                            {promoCode.is_active ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {format(new Date(promoCode.created_at), 'yyyy-MM-dd', { locale: ar })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActiveStatus(promoCode)}
                              className="text-slate-300 hover:text-white"
                            >
                              {promoCode.is_active ? (
                                <ToggleRight className="h-4 w-4 text-green-400" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-slate-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPromoCode(promoCode)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingPromoCodeId(promoCode.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Create/Edit Dialog */}
          <Dialog open={promoCodeDialogOpen} onOpenChange={setPromoCodeDialogOpen}>
            <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {editingPromoCode ? 'تعديل رمز الخصم' : 'إضافة رمز خصم جديد'}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {editingPromoCode ? 'قم بتعديل معلومات رمز الخصم' : 'أدخل معلومات رمز الخصم الجديد'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="code">الرمز *</Label>
                  <Input
                    id="code"
                    value={promoCodeForm.code}
                    onChange={(e) => setPromoCodeForm({ ...promoCodeForm, code: e.target.value.toUpperCase() })}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    placeholder="SUMMER2024"
                  />
                </div>
                <div>
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea
                    id="description"
                    value={promoCodeForm.description}
                    onChange={(e) => setPromoCodeForm({ ...promoCodeForm, description: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    placeholder="وصف رمز الخصم"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discount_type">نوع الخصم *</Label>
                    <Select
                      value={promoCodeForm.discount_type}
                      onValueChange={(value: 'percentage' | 'fixed') =>
                        setPromoCodeForm({ ...promoCodeForm, discount_type: value })
                      }
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                        <SelectItem value="fixed">مبلغ ثابت (ريال)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="discount_value">قيمة الخصم *</Label>
                    <Input
                      id="discount_value"
                      type="number"
                      step="0.01"
                      min="0"
                      value={promoCodeForm.discount_value}
                      onChange={(e) => setPromoCodeForm({ ...promoCodeForm, discount_value: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      placeholder={promoCodeForm.discount_type === 'percentage' ? '10' : '50'}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_purchase_amount">الحد الأدنى للشراء (ريال)</Label>
                    <Input
                      id="min_purchase_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={promoCodeForm.min_purchase_amount}
                      onChange={(e) => setPromoCodeForm({ ...promoCodeForm, min_purchase_amount: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_discount_amount">الحد الأقصى للخصم (ريال)</Label>
                    <Input
                      id="max_discount_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={promoCodeForm.max_discount_amount}
                      onChange={(e) => setPromoCodeForm({ ...promoCodeForm, max_discount_amount: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      placeholder="غير محدود"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="usage_limit">حد الاستخدام</Label>
                    <Input
                      id="usage_limit"
                      type="number"
                      min="0"
                      value={promoCodeForm.usage_limit}
                      onChange={(e) => setPromoCodeForm({ ...promoCodeForm, usage_limit: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      placeholder="غير محدود"
                    />
                  </div>
                  <div>
                    <Label htmlFor="is_active">الحالة</Label>
                    <Select
                      value={promoCodeForm.is_active ? 'active' : 'inactive'}
                      onValueChange={(value) =>
                        setPromoCodeForm({ ...promoCodeForm, is_active: value === 'active' })
                      }
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">نشط</SelectItem>
                        <SelectItem value="inactive">غير نشط</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="valid_from">تاريخ البداية</Label>
                    <Input
                      id="valid_from"
                      type="date"
                      value={promoCodeForm.valid_from}
                      onChange={(e) => setPromoCodeForm({ ...promoCodeForm, valid_from: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="valid_until">تاريخ الانتهاء</Label>
                    <Input
                      id="valid_until"
                      type="date"
                      value={promoCodeForm.valid_until}
                      onChange={(e) => setPromoCodeForm({ ...promoCodeForm, valid_until: e.target.value })}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPromoCodeDialogOpen(false)}
                  className="border-slate-600 text-slate-300"
                >
                  إلغاء
                </Button>
                <Button onClick={handleSavePromoCode} className="bg-blue-600 hover:bg-blue-700">
                  حفظ
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!deletingPromoCodeId} onOpenChange={(open) => !open && setDeletingPromoCodeId(null)}>
            <DialogContent className="bg-slate-800 border-slate-700 text-white">
              <DialogHeader>
                <DialogTitle>تأكيد الحذف</DialogTitle>
                <DialogDescription className="text-slate-400">
                  هل أنت متأكد من حذف رمز الخصم هذا؟ لا يمكن التراجع عن هذا الإجراء.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeletingPromoCodeId(null)}
                  className="border-slate-600 text-slate-300"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={() => deletingPromoCodeId && handleDeletePromoCode(deletingPromoCodeId)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  حذف
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <Footer />
    </div>
  );
}

