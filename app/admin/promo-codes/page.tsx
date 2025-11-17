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
  Megaphone,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';

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
  effective_is_active?: boolean;
  is_expired?: boolean;
  is_not_yet_valid?: boolean;
}

interface PromotionalBanner {
  id: string;
  is_enabled: boolean;
  title: string;
  subtitle: string;
  discount_percentage: number;
  expiration_date: string;
  cta_link: string;
  banner_type?: 'default' | 'blackfriday';
  banner_image_url?: string;
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
  
  // Promotional Banner State
  const [defaultBanner, setDefaultBanner] = useState<PromotionalBanner | null>(null);
  const [blackfridayBanner, setBlackfridayBanner] = useState<PromotionalBanner | null>(null);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [editingBannerType, setEditingBannerType] = useState<'default' | 'blackfriday'>('default');
  const [defaultBannerForm, setDefaultBannerForm] = useState({
    is_enabled: false,
    title: '',
    subtitle: '',
    discount_percentage: 20,
    expiration_date: '',
    cta_link: '/subscribe',
  });
  const [blackfridayBannerForm, setBlackfridayBannerForm] = useState({
    is_enabled: false,
    title: '',
    subtitle: '',
    discount_percentage: 20,
    expiration_date: '',
    cta_link: '/subscribe',
    banner_image_url: 'https://l.top4top.io/p_3608w917h1.png',
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
      fetchPromotionalBanners();
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

  const fetchPromotionalBanners = async () => {
    try {
      setBannerLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch both banner types
      const [defaultResponse, blackfridayResponse] = await Promise.all([
        fetch('/api/admin/promotional-banner?type=default', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }),
        fetch('/api/admin/promotional-banner?type=blackfriday', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }),
      ]);

      const defaultResult = await defaultResponse.json();
      const blackfridayResult = await blackfridayResponse.json();

      if (!defaultResponse.ok && defaultResponse.status !== 404) {
        throw new Error(defaultResult.error || 'فشل في جلب البانر الافتراضي');
      }
      if (!blackfridayResponse.ok && blackfridayResponse.status !== 404) {
        throw new Error(blackfridayResult.error || 'فشل في جلب بانر الجمعة البيضاء');
      }

      const defaultBannerData = defaultResult.banner || null;
      const blackfridayBannerData = blackfridayResult.banner || null;

      setDefaultBanner(defaultBannerData);
      setBlackfridayBanner(blackfridayBannerData);

      if (defaultBannerData) {
        setDefaultBannerForm({
          is_enabled: defaultBannerData.is_enabled,
          title: defaultBannerData.title,
          subtitle: defaultBannerData.subtitle,
          discount_percentage: defaultBannerData.discount_percentage,
          expiration_date: defaultBannerData.expiration_date ? new Date(defaultBannerData.expiration_date).toISOString().split('T')[0] : '',
          cta_link: defaultBannerData.cta_link,
        });
      }

      if (blackfridayBannerData) {
        setBlackfridayBannerForm({
          is_enabled: blackfridayBannerData.is_enabled,
          title: blackfridayBannerData.title,
          subtitle: blackfridayBannerData.subtitle,
          discount_percentage: blackfridayBannerData.discount_percentage,
          expiration_date: blackfridayBannerData.expiration_date ? new Date(blackfridayBannerData.expiration_date).toISOString().split('T')[0] : '',
          cta_link: blackfridayBannerData.cta_link,
          banner_image_url: blackfridayBannerData.banner_image_url || 'https://l.top4top.io/p_3608w917h1.png',
        });
      }
    } catch (error: any) {
      console.error('Fetch promotional banners error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في جلب البانرات الترويجية',
        variant: 'destructive',
      });
    } finally {
      setBannerLoading(false);
    }
  };

  const handleSaveBanner = async () => {
    const bannerForm = editingBannerType === 'default' ? defaultBannerForm : blackfridayBannerForm;
    const currentBanner = editingBannerType === 'default' ? defaultBanner : blackfridayBanner;

    if (bannerForm.is_enabled) {
      if (!bannerForm.title || !bannerForm.subtitle) {
        toast({
          title: 'خطأ',
          description: 'يرجى ملء العنوان والوصف',
          variant: 'destructive',
        });
        return;
      }
      if (bannerForm.discount_percentage < 0 || bannerForm.discount_percentage > 100) {
        toast({
          title: 'خطأ',
          description: 'نسبة الخصم يجب أن تكون بين 0 و 100',
          variant: 'destructive',
        });
        return;
      }
      if (!bannerForm.expiration_date) {
        toast({
          title: 'خطأ',
          description: 'يرجى تحديد تاريخ الانتهاء',
          variant: 'destructive',
        });
        return;
      }
      if (editingBannerType === 'blackfriday' && !bannerForm.banner_image_url) {
        toast({
          title: 'خطأ',
          description: 'يرجى إدخال رابط الصورة',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setBannerLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const payload: any = {
        id: currentBanner?.id || null,
        banner_type: editingBannerType,
        ...bannerForm,
        expiration_date: bannerForm.expiration_date ? new Date(bannerForm.expiration_date).toISOString() : new Date().toISOString(),
      };

      const response = await fetch('/api/admin/promotional-banner', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في حفظ البانر الترويجي');
      }

      toast({
        title: 'نجح',
        description: 'تم حفظ البانر الترويجي بنجاح',
      });

      setBannerDialogOpen(false);
      fetchPromotionalBanners();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ البانر الترويجي',
        variant: 'destructive',
      });
    } finally {
      setBannerLoading(false);
    }
  };

  const handleToggleBanner = async (bannerType: 'default' | 'blackfriday', enabled: boolean) => {
    const bannerForm = bannerType === 'default' ? defaultBannerForm : blackfridayBannerForm;
    const currentBanner = bannerType === 'default' ? defaultBanner : blackfridayBanner;
    const previousState = bannerForm.is_enabled;
    
    // Update local state immediately
    if (bannerType === 'default') {
      setDefaultBannerForm({ ...defaultBannerForm, is_enabled: enabled });
    } else {
      setBlackfridayBannerForm({ ...blackfridayBannerForm, is_enabled: enabled });
    }
    
    try {
      setBannerLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      // If enabling and form is empty or no banner exists, use defaults
      let payload: any = {
        id: currentBanner?.id || null,
        banner_type: bannerType,
        is_enabled: enabled,
        title: bannerForm.title || '',
        subtitle: bannerForm.subtitle || '',
        discount_percentage: bannerForm.discount_percentage || 20,
        cta_link: bannerForm.cta_link || '/subscribe',
      };

      if (bannerType === 'blackfriday') {
        payload.banner_image_url = bannerForm.banner_image_url || 'https://l.top4top.io/p_3608w917h1.png';
      }

      if (enabled) {
        // If enabling, ensure we have valid data
        if (!payload.title) {
          payload.title = bannerType === 'default' 
            ? 'خصم 20% بمناسبة افتتاح المنصة 🎉'
            : 'عروض الجمعة البيضاء';
        }
        if (!payload.subtitle) {
          payload.subtitle = bannerType === 'default'
            ? 'خصم 20% على جميع المنتجات بمناسبة افتتاح المنصة استخدم كود 20A على جميع المنتجات'
            : 'خصومات حصرية على جميع المنتجات';
        }
        if (!bannerForm.expiration_date) {
          // Default to 30 days from now
          const defaultDate = new Date();
          defaultDate.setDate(defaultDate.getDate() + 30);
          payload.expiration_date = defaultDate.toISOString();
        } else {
          // Ensure expiration_date is in ISO format
          payload.expiration_date = bannerForm.expiration_date.includes('T')
            ? bannerForm.expiration_date
            : new Date(bannerForm.expiration_date).toISOString();
        }
      } else {
        // If disabling, keep existing expiration_date or set a default
        payload.expiration_date = bannerForm.expiration_date
          ? (bannerForm.expiration_date.includes('T')
              ? bannerForm.expiration_date
              : new Date(bannerForm.expiration_date).toISOString())
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const response = await fetch('/api/admin/promotional-banner', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في تحديث حالة البانر');
      }

      toast({
        title: 'نجح',
        description: enabled ? `تم تفعيل ${bannerType === 'default' ? 'البانر الافتراضي' : 'بانر الجمعة البيضاء'}` : `تم تعطيل ${bannerType === 'default' ? 'البانر الافتراضي' : 'بانر الجمعة البيضاء'}`,
      });

      fetchPromotionalBanners();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث حالة البانر',
        variant: 'destructive',
      });
      // Revert the toggle on error
      if (bannerType === 'default') {
        setDefaultBannerForm({ ...defaultBannerForm, is_enabled: previousState });
      } else {
        setBlackfridayBannerForm({ ...blackfridayBannerForm, is_enabled: previousState });
      }
    } finally {
      setBannerLoading(false);
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
        title: result.deactivated ? 'تم التعطيل' : 'نجح',
        description: result.message || result.deactivated 
          ? 'تم تعطيل رمز الخصم لأنه مستخدم في طلبات'
          : 'تم حذف رمز الخصم بنجاح',
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
    
    // Use effective_is_active if available, otherwise fall back to is_active
    const effectiveActive = pc.effective_is_active !== undefined ? pc.effective_is_active : pc.is_active;
    
    const matchesActive = activeFilter === 'all' ||
      (activeFilter === 'active' && effectiveActive) ||
      (activeFilter === 'inactive' && !effectiveActive);
    return matchesSearch && matchesActive;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-6xl mx-auto text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto" />
            <p className="text-gray-600 mt-4">جاري التحميل...</p>
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
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">إدارة رموز الخصم</h1>
              <p className="text-gray-600">إنشاء وإدارة رموز الخصم الترويجية</p>
            </div>
            <Button onClick={handleCreatePromoCode} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 ml-2" />
              إضافة رمز خصم جديد
            </Button>
          </div>

          {/* Promotional Banner Management */}
          <Card className="bg-white border-gray-200 mb-6">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                إدارة البانر الترويجي
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bannerLoading && !defaultBanner && !blackfridayBanner ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Default Banner Theme */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">البانر الافتراضي</h3>
                      <div className="flex items-center gap-3">
                        <Label htmlFor="default-banner-toggle" className="text-gray-900 cursor-pointer text-sm">
                          {defaultBannerForm.is_enabled ? 'مفعّل' : 'معطّل'}
                        </Label>
                        <Switch
                          id="default-banner-toggle"
                          checked={defaultBannerForm.is_enabled}
                          onCheckedChange={(enabled) => handleToggleBanner('default', enabled)}
                          disabled={bannerLoading}
                        />
                        <Button
                          onClick={() => {
                            setEditingBannerType('default');
                            setBannerDialogOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="border-gray-300 text-gray-600 hover:bg-gray-100"
                        >
                          <Edit className="h-4 w-4 ml-2" />
                          تعديل
                        </Button>
                      </div>
                    </div>
                    {defaultBanner && (
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">العنوان:</span>
                          <span className="text-gray-900 font-medium">{defaultBanner.title || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">نسبة الخصم:</span>
                          <span className="text-gray-900 font-semibold">{defaultBanner.discount_percentage}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">تاريخ الانتهاء:</span>
                          <span className="text-gray-900">
                            {defaultBanner.expiration_date
                              ? format(new Date(defaultBanner.expiration_date), 'yyyy-MM-dd', { locale: ar })
                              : '-'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Black Friday Banner Theme */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">عروض الجمعة البيضاء</h3>
                      <div className="flex items-center gap-3">
                        <Label htmlFor="blackfriday-banner-toggle" className="text-gray-900 cursor-pointer text-sm">
                          {blackfridayBannerForm.is_enabled ? 'مفعّل' : 'معطّل'}
                        </Label>
                        <Switch
                          id="blackfriday-banner-toggle"
                          checked={blackfridayBannerForm.is_enabled}
                          onCheckedChange={(enabled) => handleToggleBanner('blackfriday', enabled)}
                          disabled={bannerLoading}
                        />
                        <Button
                          onClick={() => {
                            setEditingBannerType('blackfriday');
                            setBannerDialogOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="border-gray-300 text-gray-600 hover:bg-gray-100"
                        >
                          <Edit className="h-4 w-4 ml-2" />
                          تعديل
                        </Button>
                      </div>
                    </div>
                    {blackfridayBanner && (
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">العنوان:</span>
                          <span className="text-gray-900 font-medium">{blackfridayBanner.title || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">نسبة الخصم:</span>
                          <span className="text-gray-900 font-semibold">{blackfridayBanner.discount_percentage}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">تاريخ الانتهاء:</span>
                          <span className="text-gray-900">
                            {blackfridayBanner.expiration_date
                              ? format(new Date(blackfridayBanner.expiration_date), 'yyyy-MM-dd', { locale: ar })
                              : '-'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="bg-white border-gray-200 mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="ابحث عن رمز الخصم..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900 pr-10"
                  />
                </div>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900">
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
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="text-gray-900">الرمز</TableHead>
                    <TableHead className="text-white">الوصف</TableHead>
                    <TableHead className="text-white">نوع الخصم</TableHead>
                    <TableHead className="text-white">قيمة الخصم</TableHead>
                    <TableHead className="text-white">الاستخدام</TableHead>
                    <TableHead className="text-white">الحالة</TableHead>
                    <TableHead className="text-white">تاريخ الانتهاء</TableHead>
                    <TableHead className="text-white">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-white">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromoCodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                        لا توجد رموز خصم
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPromoCodes.map((promoCode) => (
                      <TableRow key={promoCode.id} className="border-gray-200">
                        <TableCell className="text-gray-900 font-semibold">{promoCode.code}</TableCell>
                        <TableCell className="text-gray-600">
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
                          {(() => {
                            const effectiveActive = promoCode.effective_is_active !== undefined 
                              ? promoCode.effective_is_active 
                              : promoCode.is_active;
                            const isExpired = promoCode.is_expired || false;
                            const isNotYetValid = promoCode.is_not_yet_valid || false;
                            
                            if (isExpired) {
                              return (
                                <Badge className="bg-red-600">
                                  منتهي الصلاحية
                                </Badge>
                              );
                            }
                            if (isNotYetValid) {
                              return (
                                <Badge className="bg-yellow-600">
                                  غير مفعّل بعد
                                </Badge>
                              );
                            }
                            return (
                              <Badge
                                variant={effectiveActive ? 'default' : 'secondary'}
                                className={effectiveActive ? 'bg-green-600' : 'bg-slate-600'}
                              >
                                {effectiveActive ? 'نشط' : 'غير نشط'}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {promoCode.valid_until 
                            ? format(new Date(promoCode.valid_until), 'yyyy-MM-dd', { locale: ar })
                            : '-'}
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
            <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {editingPromoCode ? 'تعديل رمز الخصم' : 'إضافة رمز خصم جديد'}
                </DialogTitle>
                <DialogDescription className="text-gray-600">
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
                      <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-1">
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
                      <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-1">
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
            <DialogContent className="bg-white border-gray-200 text-gray-900">
              <DialogHeader>
                <DialogTitle>تأكيد الحذف</DialogTitle>
                <DialogDescription className="text-gray-600">
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

          {/* Promotional Banner Edit Dialog */}
          <Dialog open={bannerDialogOpen} onOpenChange={setBannerDialogOpen}>
            <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  تعديل {editingBannerType === 'default' ? 'البانر الافتراضي' : 'بانر الجمعة البيضاء'}
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  قم بتعديل إعدادات البانر الترويجي المعروض على الصفحة الرئيسية
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {(() => {
                  const bannerForm = editingBannerType === 'default' ? defaultBannerForm : blackfridayBannerForm;
                  const setBannerForm = editingBannerType === 'default' ? setDefaultBannerForm : setBlackfridayBannerForm;
                  
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="banner-enabled" className="text-gray-900">
                          تفعيل البانر
                        </Label>
                        <Switch
                          id="banner-enabled"
                          checked={bannerForm.is_enabled}
                          onCheckedChange={(checked) => setBannerForm({ ...bannerForm, is_enabled: checked })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="banner-title">العنوان *</Label>
                        <Input
                          id="banner-title"
                          value={bannerForm.title}
                          onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                          className="bg-white border-gray-300 text-gray-900 mt-1"
                          placeholder={editingBannerType === 'default' ? 'خصم 20% بمناسبة افتتاح المنصة 🎉' : 'عروض الجمعة البيضاء'}
                        />
                      </div>
                      <div>
                        <Label htmlFor="banner-subtitle">الوصف *</Label>
                        <Textarea
                          id="banner-subtitle"
                          value={bannerForm.subtitle}
                          onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                          className="bg-white border-gray-300 text-gray-900 mt-1"
                          placeholder={editingBannerType === 'default' ? 'خصم 20% على جميع المنتجات بمناسبة افتتاح المنصة استخدم كود 20A على جميع المنتجات' : 'خصومات حصرية على جميع المنتجات'}
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="banner-discount">نسبة الخصم (%) *</Label>
                          <Input
                            id="banner-discount"
                            type="number"
                            min="0"
                            max="100"
                            value={bannerForm.discount_percentage}
                            onChange={(e) => setBannerForm({ ...bannerForm, discount_percentage: parseInt(e.target.value) || 0 })}
                            className="bg-white border-gray-300 text-gray-900 mt-1"
                            placeholder="20"
                          />
                        </div>
                        <div>
                          <Label htmlFor="banner-expiration">تاريخ الانتهاء *</Label>
                          <Input
                            id="banner-expiration"
                            type="date"
                            value={bannerForm.expiration_date}
                            onChange={(e) => setBannerForm({ ...bannerForm, expiration_date: e.target.value })}
                            className="bg-white border-gray-300 text-gray-900 mt-1"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      </div>
                      {editingBannerType === 'blackfriday' && (
                        <div>
                          <Label htmlFor="banner-image-url">رابط الصورة *</Label>
                          <Input
                            id="banner-image-url"
                            value={bannerForm.banner_image_url}
                            onChange={(e) => setBannerForm({ ...bannerForm, banner_image_url: e.target.value })}
                            className="bg-white border-gray-300 text-gray-900 mt-1"
                            placeholder="https://l.top4top.io/p_3608w917h1.png"
                          />
                          <p className="text-xs text-gray-500 mt-1">رابط الصورة التي ستظهر في البانر</p>
                        </div>
                      )}
                      <div>
                        <Label htmlFor="banner-cta-link">رابط الزر (CTA)</Label>
                        <Input
                          id="banner-cta-link"
                          value={bannerForm.cta_link}
                          onChange={(e) => setBannerForm({ ...bannerForm, cta_link: e.target.value })}
                          className="bg-white border-gray-300 text-gray-900 mt-1"
                          placeholder="/subscribe"
                        />
                        <p className="text-xs text-gray-500 mt-1">مثال: /subscribe أو /browse</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setBannerDialogOpen(false)}
                  className="border-gray-300 text-gray-600"
                  disabled={bannerLoading}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSaveBanner}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={bannerLoading}
                >
                  {bannerLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    'حفظ'
                  )}
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

