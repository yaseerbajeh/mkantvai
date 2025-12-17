'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Package,
  Key,
  ToggleLeft,
  ToggleRight,
  X,
  FolderTree,
  ChevronDown,
  ChevronUp,
  Save,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface Product {
  id: string;
  product_code: string;
  name: string;
  description: string;
  price: number;
  discounted_price?: number | null;
  promo_banner_text?: string | null;
  duration: string;
  section: number;
  section_title: string;
  category_id?: string;
  categories?: {
    id: string;
    name: string;
    name_en?: string;
    display_order: number;
    is_active: boolean;
  };
  image: string;
  image2?: string;
  logos?: string[];
  gradient: string;
  badge_color: string;
  icon_name: string;
  is_package: boolean;
  features?: string[];
  is_active: boolean;
  display_order: number;
}

interface Category {
  id: string;
  name: string;
  name_en?: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SubscriptionCode {
  id: string;
  subscription_code: string;
  product_code: string;
  subscription_meta: any;
  created_at: string;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [subscriptionCodes, setSubscriptionCodes] = useState<SubscriptionCode[]>([]);
  const [subscriptionCounts, setSubscriptionCounts] = useState<{ [key: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [addSubscriptionDialogOpen, setAddSubscriptionDialogOpen] = useState(false);
  const [editSubscriptionDialogOpen, setEditSubscriptionDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionCode | null>(null);
  const [selectedProductCode, setSelectedProductCode] = useState<string>('');
  const [subscriptionCode, setSubscriptionCode] = useState<string>('');
  const [expandedSubscriptions, setExpandedSubscriptions] = useState<Set<string>>(new Set());

  // Categories management
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

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
        fetchProducts();
        fetchSubscriptionCodes();
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

  // Fetch categories
  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const response = await fetch('/api/admin/categories', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('فشل في جلب التصنيفات');
      }

      const result = await response.json();
      setCategories(result.categories || []);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في جلب التصنيفات',
        variant: 'destructive',
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user]);

  const fetchProducts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/products', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        const errorMessage = result.error || 'فشل في جلب المنتجات';
        console.error('API Error:', errorMessage, result);
        throw new Error(errorMessage);
      }

      setProducts(result.products || []);
    } catch (error: any) {
      console.error('Fetch products error:', error);
      console.error('Error details:', error);
      toast({
        title: 'خطأ في الاتصال',
        description: error.message || 'حدث خطأ أثناء جلب المنتجات. تأكد من إعدادات قاعدة البيانات.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionCodes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/products/subscription-codes', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في جلب رموز الاشتراكات');
      }

      setSubscriptionCodes(result.subscriptionCodes || []);
      setSubscriptionCounts(result.counts || {});
    } catch (error: any) {
      console.error('Fetch subscription codes error:', error);
    }
  };


  const handleCreateProduct = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

    setDeletingProductId(productId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في حذف المنتج');
      }

      toast({
        title: 'نجح',
        description: 'تم حذف المنتج بنجاح',
      });

      fetchProducts();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء حذف المنتج',
        variant: 'destructive',
      });
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_active: !product.is_active,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في تحديث المنتج');
      }

      toast({
        title: 'نجح',
        description: `تم ${product.is_active ? 'إخفاء' : 'تفعيل'} المنتج بنجاح`,
      });

      fetchProducts();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث المنتج',
        variant: 'destructive',
      });
    }
  };

  const handleSaveProduct = async (formData: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `فشل في ${editingProduct ? 'تحديث' : 'إنشاء'} المنتج`);
      }

      toast({
        title: 'نجح',
        description: `تم ${editingProduct ? 'تحديث' : 'إنشاء'} المنتج بنجاح`,
      });

      setProductDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ',
        variant: 'destructive',
      });
    }
  };

  const handleAddSubscription = async () => {
    if (!selectedProductCode || !subscriptionCode.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رمز المنتج ورمز الاشتراك',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch('/api/admin/products/subscription-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          product_code: selectedProductCode,
          subscription_code: subscriptionCode,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في إضافة رمز الاشتراك');
      }

      toast({
        title: 'نجح',
        description: 'تم إضافة رمز الاشتراك بنجاح',
      });

      setAddSubscriptionDialogOpen(false);
      setSelectedProductCode('');
      setSubscriptionCode('');
      fetchSubscriptionCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ',
        variant: 'destructive',
      });
    }
  };

  const handleEditSubscription = (subscription: SubscriptionCode) => {
    setEditingSubscription(subscription);
    setSelectedProductCode(subscription.product_code || '');
    setSubscriptionCode(subscription.subscription_code);
    setEditSubscriptionDialogOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!editingSubscription) return;

    if (!selectedProductCode || !subscriptionCode.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رمز المنتج ورمز الاشتراك',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch(`/api/admin/products/subscription-codes/${editingSubscription.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          product_code: selectedProductCode,
          subscription_code: subscriptionCode,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في تحديث رمز الاشتراك');
      }

      toast({
        title: 'نجح',
        description: 'تم تحديث رمز الاشتراك بنجاح',
      });

      setEditSubscriptionDialogOpen(false);
      setEditingSubscription(null);
      setSelectedProductCode('');
      setSubscriptionCode('');
      fetchSubscriptionCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ',
        variant: 'destructive',
      });
    }
  };

  const handleInlineUpdateSubscription = async (id: string, newCode: string, productCode: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch(`/api/admin/products/subscription-codes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          product_code: productCode,
          subscription_code: newCode,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في تحديث رمز الاشتراك');
      }

      toast({
        title: 'نجح',
        description: 'تم تحديث رمز الاشتراك بنجاح',
      });

      fetchSubscriptionCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ',
        variant: 'destructive',
      });
    }
  };

  // Category management handlers
  const handleCreateCategory = () => {
    setEditingCategory(null);
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async (formData: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const url = editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : '/api/admin/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في حفظ التصنيف');
      }

      toast({
        title: 'نجح',
        description: editingCategory ? 'تم تحديث التصنيف بنجاح' : 'تم إنشاء التصنيف بنجاح',
      });

      setCategoryDialogOpen(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء حفظ التصنيف',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setDeletingCategoryId(categoryId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في حذف التصنيف');
      }

      toast({
        title: 'نجح',
        description: 'تم حذف التصنيف بنجاح',
      });

      fetchCategories();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء حذف التصنيف',
        variant: 'destructive',
      });
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const handleDeleteSubscriptionCode = async (codeId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الرمز؟')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const response = await fetch(`/api/admin/products/subscription-codes/${codeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في حذف الرمز');
      }

      toast({
        title: 'نجح',
        description: 'تم حذف الرمز بنجاح',
      });

      fetchSubscriptionCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ',
        variant: 'destructive',
      });
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.product_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' ||
      (product.category_id && product.category_id === categoryFilter) ||
      (categoryFilter === 'all' && sectionFilter === 'all') ||
      (sectionFilter !== 'all' && product.section.toString() === sectionFilter); // Backward compatibility
    const matchesActive = activeFilter === 'all' ||
      (activeFilter === 'active' && product.is_active) ||
      (activeFilter === 'inactive' && !product.is_active);
    return matchesSearch && matchesCategory && matchesActive;
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
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">إدارة المنتجات والاشتراكات</h1>
            <Button onClick={handleCreateProduct} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 ml-2" />
              إضافة منتج جديد
            </Button>
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="bg-white border-gray-200">
              <TabsTrigger value="products" className="data-[state=active]:bg-gray-100">
                <Package className="h-4 w-4 ml-2" />
                المنتجات
              </TabsTrigger>
              <TabsTrigger value="subscription-codes" className="data-[state=active]:bg-gray-100">
                <Key className="h-4 w-4 ml-2" />
                رموز الاشتراكات
              </TabsTrigger>
              <TabsTrigger value="categories" className="data-[state=active]:bg-gray-100">
                <FolderTree className="h-4 w-4 ml-2" />
                إدارة التصنيفات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-6">
              {/* Filters */}
              <Card className="bg-white border-gray-200 mb-6">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="بحث بالاسم أو الكود..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-10 bg-white border-gray-300 text-gray-900"
                      />
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="التصنيف" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع التصنيفات</SelectItem>
                        {categories
                          .filter(cat => cat.is_active)
                          .sort((a, b) => a.display_order - b.display_order)
                          .map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Select value={activeFilter} onValueChange={setActiveFilter}>
                      <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="الحالة" />
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

              {/* Products Table */}
              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <CardTitle className="text-2xl text-gray-900">
                    المنتجات ({filteredProducts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredProducts.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">لا توجد منتجات</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-200">
                            <TableHead className="text-gray-900">الكود</TableHead>
                            <TableHead className="text-gray-900">الاسم</TableHead>
                            <TableHead className="text-gray-900">السعر</TableHead>
                            <TableHead className="text-gray-900">القسم</TableHead>
                            <TableHead className="text-gray-900">المخزون</TableHead>
                            <TableHead className="text-gray-900">الحالة</TableHead>
                            <TableHead className="text-gray-900">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.map((product) => (
                            <TableRow key={product.id} className="border-gray-200">
                              <TableCell className="font-mono text-sm text-gray-900">
                                {product.product_code}
                              </TableCell>
                              <TableCell className="text-gray-900">{product.name}</TableCell>
                              <TableCell className="text-gray-900">{product.price} ريال</TableCell>
                              <TableCell className="text-gray-600">
                                {product.categories?.name || product.section_title || 'غير محدد'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    (subscriptionCounts[product.product_code] || 0) > 0
                                      ? 'bg-blue-900/50 text-blue-400 border-blue-700'
                                      : 'bg-red-900/50 text-red-400 border-red-700'
                                  }
                                >
                                  {subscriptionCounts[product.product_code] || 0} متاح
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    product.is_active
                                      ? 'bg-green-900/50 text-green-500 border-green-700'
                                      : 'bg-red-900/50 text-red-500 border-red-700'
                                  }
                                >
                                  {product.is_active ? 'نشط' : 'غير نشط'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedProductCode(product.product_code);
                                      setSubscriptionCode('');
                                      setAddSubscriptionDialogOpen(true);
                                    }}
                                    className="bg-blue-800 border-blue-700 text-blue-300 hover:bg-blue-700 hover:text-white"
                                    title="إضافة اشتراكات"
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleToggleActive(product)}
                                    className="bg-white border-gray-300 text-gray-900"
                                  >
                                    {product.is_active ? (
                                      <ToggleLeft className="h-4 w-4" />
                                    ) : (
                                      <ToggleRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditProduct(product)}
                                    className="bg-white border-gray-300 text-gray-900"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteProduct(product.id)}
                                    disabled={deletingProductId === product.id}
                                  >
                                    {deletingProductId === product.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscription-codes" className="mt-6">
              <Card className="bg-white border-gray-200 mb-6">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl text-gray-900">رموز الاشتراكات</CardTitle>
                    <Button
                      onClick={() => {
                        setSelectedProductCode('');
                        setSubscriptionCode('');
                        setAddSubscriptionDialogOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة إشتراك
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(subscriptionCounts).map(([productCode, count]) => (
                      <Card key={productCode} className="bg-white border-gray-200">
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <Package className="h-5 w-5 text-blue-400" />
                              <div>
                                <h3 className="text-xl font-bold text-gray-900">رمز المنتج: {productCode}</h3>
                                <p className="text-gray-500 text-sm mt-1">
                                  {count} اشتراك متاح
                                </p>
                              </div>
                            </div>
                            <Badge className="bg-blue-900/50 text-blue-400 border-blue-700">
                              {count} متاح
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {subscriptionCodes
                              .filter(sc => sc.product_code === productCode)
                              .map((code) => {
                                const isExpanded = expandedSubscriptions.has(code.id);
                                const codeLines = code.subscription_code.split('\n');
                                const isLong = codeLines.length > 3 || code.subscription_code.length > 150;
                                const displayCode = isExpanded || !isLong
                                  ? code.subscription_code
                                  : codeLines.slice(0, 3).join('\n') + (codeLines.length > 3 ? '\n...' : '');

                                return (
                                  <Card key={code.id} className="bg-gray-50 border-gray-300">
                                    <CardContent className="pt-4">
                                      <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Key className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                            <Label className="text-gray-600 text-sm">رمز الاشتراك:</Label>
                                          </div>
                                          <div className="bg-gray-100 border border-gray-300 rounded p-3">
                                            <pre className="text-gray-700 font-mono text-sm whitespace-pre-wrap break-words overflow-x-auto max-h-[120px] overflow-y-auto">
                                              {displayCode}
                                            </pre>
                                          </div>
                                          {isLong && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => {
                                                const newExpanded = new Set(expandedSubscriptions);
                                                if (isExpanded) {
                                                  newExpanded.delete(code.id);
                                                } else {
                                                  newExpanded.add(code.id);
                                                }
                                                setExpandedSubscriptions(newExpanded);
                                              }}
                                              className="text-gray-500 hover:text-gray-700 text-xs mt-2 h-6 px-2"
                                            >
                                              {isExpanded ? (
                                                <>
                                                  <ChevronUp className="h-3 w-3 ml-1" />
                                                  إخفاء
                                                </>
                                              ) : (
                                                <>
                                                  <ChevronDown className="h-3 w-3 ml-1" />
                                                  عرض المزيد
                                                </>
                                              )}
                                            </Button>
                                          )}
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleEditSubscription(code)}
                                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                            title="تعديل"
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDeleteSubscriptionCode(code.id)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                            title="حذف"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                          </div>
                          {subscriptionCodes.filter(sc => sc.product_code === productCode).length === 0 && (
                            <p className="text-gray-500 text-sm text-center py-4">لا توجد اشتراكات لهذا المنتج</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {Object.keys(subscriptionCounts).length === 0 && (
                      <div className="text-center py-12">
                        <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 text-lg">لا توجد رموز اشتراكات</p>
                        <p className="text-gray-500 text-sm mt-2">ابدأ بإضافة اشتراك جديد</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories" className="mt-6">
              <Card className="bg-white border-gray-200">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl text-gray-900">التصنيفات</CardTitle>
                    <Button onClick={handleCreateCategory} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة تصنيف جديد
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCategories ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-600 mx-auto" />
                      <p className="text-gray-600 mt-4">جاري التحميل...</p>
                    </div>
                  ) : categories.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">لا توجد تصنيفات</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-200">
                            <TableHead className="text-gray-900">الاسم</TableHead>
                            <TableHead className="text-gray-900">الاسم (إنجليزي)</TableHead>
                            <TableHead className="text-gray-900">ترتيب العرض</TableHead>
                            <TableHead className="text-gray-900">الحالة</TableHead>
                            <TableHead className="text-gray-900">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categories
                            .sort((a, b) => a.display_order - b.display_order)
                            .map((category) => (
                              <TableRow key={category.id} className="border-gray-200">
                                <TableCell className="text-gray-900 font-medium">
                                  {category.name}
                                </TableCell>
                                <TableCell className="text-gray-600">
                                  {category.name_en || '-'}
                                </TableCell>
                                <TableCell className="text-gray-600">
                                  {category.display_order}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      category.is_active
                                        ? 'bg-green-900/50 text-green-500 border-green-700'
                                        : 'bg-red-900/50 text-red-500 border-red-700'
                                    }
                                  >
                                    {category.is_active ? 'نشط' : 'غير نشط'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditCategory(category)}
                                      className="text-blue-400 hover:text-blue-300"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        if (confirm('هل أنت متأكد من حذف هذا التصنيف؟')) {
                                          handleDeleteCategory(category.id);
                                        }
                                      }}
                                      disabled={deletingCategoryId === category.id}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      {deletingCategoryId === category.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
        onSave={handleSaveProduct}
        categories={categories}
      />

      {/* Add Subscription Dialog */}
      <Dialog open={addSubscriptionDialogOpen} onOpenChange={setAddSubscriptionDialogOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>إدارة المخزون والاشتراكات</DialogTitle>
            <DialogDescription className="text-gray-600">
              إضافة مخزون جديد أو إدارة المخزون الحالي للمنتج
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden min-h-0">
            {/* Left Side: Add New */}
            <div className="flex flex-col gap-4 border-l pl-6 overflow-y-auto">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-blue-600" />
                  إضافة مخزون جديد
                </h3>
                <Label>رمز المنتج *</Label>
                <Select
                  value={selectedProductCode}
                  onValueChange={setSelectedProductCode}
                  required
                >
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-2">
                    <SelectValue placeholder="اختر رمز المنتج" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.product_code}>
                        {p.product_code} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>رمز الاشتراك *</Label>
                <Textarea
                  value={subscriptionCode}
                  onChange={(e) => setSubscriptionCode(e.target.value)}
                  placeholder="أدخل رمز الاشتراك... يمكن أن يحتوي على تعليمات أو بريد إلكتروني وكلمة مرور"
                  className="bg-white border-gray-300 text-gray-900 mt-2 min-h-[150px] font-mono whitespace-pre-wrap break-words"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  يمكنك إدخال عدة أسطر للتعليمات أو معلومات إضافية
                </p>
              </div>
              <Button onClick={handleAddSubscription} className="bg-blue-600 hover:bg-blue-700 w-full mt-4">
                <Plus className="h-4 w-4 ml-2" />
                إضافة للمخزون
              </Button>
            </div>

            {/* Right Side: Current Inventory */}
            <div className="flex flex-col min-h-0">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-green-600" />
                المخزون الحالي
                {selectedProductCode && (
                  <Badge variant="secondary" className="mr-2">
                    {subscriptionCodes.filter(sc => sc.product_code === selectedProductCode).length}
                  </Badge>
                )}
              </h3>

              {!selectedProductCode ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <Package className="h-12 w-12 mb-2 opacity-50" />
                  <p>اختر منتج لعرض المخزون</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto pr-2 flex-1">
                  {subscriptionCodes
                    .filter(sc => sc.product_code === selectedProductCode)
                    .map((code) => (
                      <SubscriptionItem
                        key={code.id}
                        code={code}
                        onSave={handleInlineUpdateSubscription}
                        onDelete={handleDeleteSubscriptionCode}
                      />
                    ))}
                  {subscriptionCodes.filter(sc => sc.product_code === selectedProductCode).length === 0 && (
                    <div className="text-center py-8 bg-gray-50 rounded text-gray-500">
                      لا يوجد مخزون لهذا المنتج
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setAddSubscriptionDialogOpen(false);
                setSelectedProductCode('');
                setSubscriptionCode('');
              }}
              className="bg-gray-200 border-gray-300 text-gray-900"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={editSubscriptionDialogOpen} onOpenChange={setEditSubscriptionDialogOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl">
          <DialogHeader>
            <DialogTitle>تعديل اشتراك</DialogTitle>
            <DialogDescription className="text-gray-600">
              قم بتعديل رمز المنتج أو رمز الاشتراك
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>رمز المنتج *</Label>
              <Select
                value={selectedProductCode}
                onValueChange={setSelectedProductCode}
                required
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-2">
                  <SelectValue placeholder="اختر رمز المنتج" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.product_code}>
                      {p.product_code} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>رمز الاشتراك *</Label>
              <Textarea
                value={subscriptionCode}
                onChange={(e) => setSubscriptionCode(e.target.value)}
                placeholder="أدخل رمز الاشتراك... يمكن أن يحتوي على تعليمات أو بريد إلكتروني وكلمة مرور"
                className="bg-white border-gray-300 text-gray-900 mt-2 min-h-[150px] font-mono whitespace-pre-wrap break-words"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                يمكنك إدخال عدة أسطر للتعليمات أو معلومات إضافية
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditSubscriptionDialogOpen(false);
                setEditingSubscription(null);
                setSelectedProductCode('');
                setSubscriptionCode('');
              }}
              className="bg-gray-200 border-gray-300 text-gray-900"
            >
              إلغاء
            </Button>
            <Button onClick={handleUpdateSubscription} className="bg-blue-600 hover:bg-blue-700">
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Form Dialog */}
      <CategoryFormDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
        onSave={handleSaveCategory}
      />

    </div>
  );
}

// Product Form Dialog Component
function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSave,
  categories = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (data: any) => void;
  categories?: Category[];
}) {
  const [formData, setFormData] = useState({
    product_code: '',
    name: '',
    description: '',
    price: '',
    discounted_price: '',
    promo_banner_text: '',
    duration: '',
    category_id: '',
    section: '1',
    section_title: '',
    image: '',
    image2: '',
    gradient: 'from-blue-500 to-cyan-500',
    badge_color: 'bg-blue-500',
    icon_name: 'sparkles',
    is_package: false,
    features: '',
    is_active: true,
    display_order: '0',
  });

  const [durationType, setDurationType] = useState<'predefined' | 'custom'>('predefined');
  const [customDuration, setCustomDuration] = useState('');

  const predefinedDurations = [
    { value: '1 شهر', label: '1 شهر' },
    { value: '3 أشهر', label: '3 أشهر' },
    { value: '6 أشهر', label: '6 أشهر' },
    { value: '12 شهر', label: '12 شهر' },
    { value: 'مدى الحياة', label: 'مدى الحياة' },
  ];

  useEffect(() => {
    if (product) {
      const duration = product.duration || '';
      const isPredefined = predefinedDurations.some(d => d.value === duration);

      setFormData({
        product_code: product.product_code,
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        discounted_price: product.discounted_price?.toString() || '',
        promo_banner_text: product.promo_banner_text || '',
        duration: duration,
        category_id: product.category_id || '',
        section: product.section.toString(),
        section_title: product.section_title,
        image: product.image,
        image2: product.image2 || '',
        gradient: product.gradient,
        badge_color: product.badge_color,
        icon_name: product.icon_name,
        is_package: product.is_package,
        features: product.features?.join('\n') || '',
        is_active: product.is_active,
        display_order: product.display_order.toString(),
      });

      if (isPredefined) {
        setDurationType('predefined');
        setCustomDuration('');
      } else {
        setDurationType('custom');
        setCustomDuration(duration);
      }
    } else {
      setFormData({
        product_code: '',
        name: '',
        description: '',
        price: '',
        discounted_price: '',
        promo_banner_text: '',
        duration: '',
        category_id: categories.length > 0 ? categories[0].id : '',
        section: '1',
        section_title: '',
        image: '',
        image2: '',
        gradient: 'from-blue-500 to-cyan-500',
        badge_color: 'bg-blue-500',
        icon_name: 'sparkles',
        is_package: false,
        features: '',
        is_active: true,
        display_order: '0',
      });
      setDurationType('predefined');
      setCustomDuration('');
    }
  }, [product, open, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Get duration value based on type
    const durationValue = durationType === 'predefined'
      ? formData.duration
      : customDuration;

    if (!durationValue || durationValue.trim() === '') {
      alert('يرجى إدخال المدة');
      return;
    }

    const submitData = {
      ...formData,
      duration: durationValue,
      price: parseFloat(formData.price),
      discounted_price: formData.discounted_price ? parseFloat(formData.discounted_price) : null,
      promo_banner_text: formData.promo_banner_text || null,
      section: parseInt(formData.section),
      display_order: parseInt(formData.display_order),
      features: formData.is_package && formData.features
        ? formData.features.split('\n').map(f => f.trim()).filter(f => f)
        : null,
      image2: formData.image2 || null,
    };
    onSave(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'تعديل المنتج' : 'إضافة منتج جديد'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>رمز المنتج *</Label>
              <Input
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                required
                className="bg-white border-gray-300 text-gray-900 mt-2"
                disabled={!!product}
              />
            </div>
            <div>
              <Label>الاسم *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-white border-gray-300 text-gray-900 mt-2"
              />
            </div>
            <div className="col-span-2">
              <Label>الوصف</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-white border-gray-300 text-gray-900 mt-2 min-h-[120px]"
                rows={5}
                placeholder="أدخل وصف المنتج... يمكنك استخدام أسطر متعددة"
              />
            </div>
            <div>
              <Label>السعر (ريال) *</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                className="bg-white border-gray-300 text-gray-900 mt-2"
              />
            </div>
            <div>
              <Label>السعر المخفض (ريال) - اختياري</Label>
              <Input
                type="number"
                value={formData.discounted_price}
                onChange={(e) => setFormData({ ...formData, discounted_price: e.target.value })}
                className="bg-white border-gray-300 text-gray-900 mt-2"
                placeholder="أدخل السعر المخفض"
              />
              <p className="text-xs text-gray-500 mt-1">سيظهر السعر الأصلي محذوفاً والسعر المخفض بخط عريض</p>
            </div>
            <div className="col-span-2">
              <Label>نص البانر الترويجي - اختياري</Label>
              <Input
                value={formData.promo_banner_text}
                onChange={(e) => setFormData({ ...formData, promo_banner_text: e.target.value })}
                className="bg-white border-gray-300 text-gray-900 mt-2"
                placeholder="مثال: 3 أشهر مجاناً على رأسها"
              />
              <p className="text-xs text-gray-500 mt-1">سيظهر هذا النص كبانر صغير على بطاقة المنتج</p>
            </div>
            <div>
              <Label>المدة *</Label>
              <Select
                value={durationType === 'predefined' ? formData.duration : 'other'}
                onValueChange={(value) => {
                  if (value === 'other') {
                    setDurationType('custom');
                    setFormData({ ...formData, duration: '' });
                  } else {
                    setDurationType('predefined');
                    setFormData({ ...formData, duration: value });
                    setCustomDuration('');
                  }
                }}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-2">
                  <SelectValue placeholder="اختر المدة" />
                </SelectTrigger>
                <SelectContent>
                  {predefinedDurations.map(d => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
              {durationType === 'custom' && (
                <Input
                  value={customDuration}
                  onChange={(e) => {
                    setCustomDuration(e.target.value);
                    setFormData({ ...formData, duration: e.target.value });
                  }}
                  placeholder="أدخل المدة (مثل: 2 شهر، 18 شهر)"
                  className="bg-white border-gray-300 text-gray-900 mt-2"
                  required
                />
              )}
            </div>
            <div>
              <Label>التصنيف *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                required
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-2">
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter(cat => cat.is_active)
                    .sort((a, b) => a.display_order - b.display_order)
                    .map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ترتيب العرض</Label>
              <Input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                className="bg-white border-gray-300 text-gray-900 mt-2"
              />
            </div>
            <div>
              <Label>صورة URL</Label>
              <Input
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="bg-white border-gray-300 text-gray-900 mt-2"
              />
            </div>
            <div>
              <Label>صورة إضافية URL</Label>
              <Input
                value={formData.image2}
                onChange={(e) => setFormData({ ...formData, image2: e.target.value })}
                className="bg-white border-gray-300 text-gray-900 mt-2"
              />
            </div>
            <div>
              <Label>Gradient</Label>
              <Input
                value={formData.gradient}
                onChange={(e) => setFormData({ ...formData, gradient: e.target.value })}
                placeholder="from-blue-500 to-cyan-500"
                className="bg-white border-gray-300 text-gray-900 mt-2"
              />
            </div>
            <div>
              <Label>Badge Color</Label>
              <Input
                value={formData.badge_color}
                onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                placeholder="bg-blue-500"
                className="bg-white border-gray-300 text-gray-900 mt-2"
              />
            </div>
            <div className="col-span-2">
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="checkbox"
                  id="is_package"
                  checked={formData.is_package}
                  onChange={(e) => setFormData({ ...formData, is_package: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_package">باقة (Package)</Label>
              </div>
            </div>
            {formData.is_package && (
              <div className="col-span-2">
                <Label>المميزات (كل ميزة في سطر جديد)</Label>
                <Textarea
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  className="bg-white border-gray-300 text-gray-900 mt-2"
                  placeholder="ميزة 1&#10;ميزة 2&#10;ميزة 3"
                />
              </div>
            )}
            <div className="col-span-2">
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_active">نشط (يظهر في صفحة الاشتراك)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-gray-200 border-gray-300 text-gray-900"
            >
              إلغاء
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Category Form Dialog Component
function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  onSave: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    description: '',
    display_order: '0',
    is_active: true,
  });

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        name_en: category.name_en || '',
        description: category.description || '',
        display_order: category.display_order.toString(),
        is_active: category.is_active,
      });
    } else {
      setFormData({
        name: '',
        name_en: '',
        description: '',
        display_order: '0',
        is_active: true,
      });
    }
  }, [category, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      display_order: parseInt(formData.display_order),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 text-gray-900">
        <DialogHeader>
          <DialogTitle>{category ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>الاسم (عربي) *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="bg-white border-gray-300 text-gray-900 mt-2"
            />
          </div>
          <div>
            <Label>الاسم (إنجليزي)</Label>
            <Input
              value={formData.name_en}
              onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
              className="bg-white border-gray-300 text-gray-900 mt-2"
            />
          </div>
          <div>
            <Label>الوصف</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-white border-gray-300 text-gray-900 mt-2"
            />
          </div>
          <div>
            <Label>ترتيب العرض</Label>
            <Input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
              className="bg-white border-gray-300 text-gray-900 mt-2"
            />
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <input
              type="checkbox"
              id="cat_is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="cat_is_active">نشط</Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-gray-200 border-gray-300 text-gray-900"
            >
              إلغاء
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionItem({
  code,
  onSave,
  onDelete
}: {
  code: SubscriptionCode,
  onSave: (id: string, newCode: string, productCode: string) => void,
  onDelete: (id: string) => void
}) {
  const [val, setVal] = useState(code.subscription_code);
  const isDirty = val !== code.subscription_code;

  return (
    <Card className="bg-gray-50 border-gray-300 shadow-sm relative group hover:border-blue-300 transition-colors">
      <CardContent className="p-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Textarea
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="bg-white border-gray-200 text-sm font-mono min-h-[80px] resize-y"
            />
            {isDirty && (
              <p className="text-amber-600 text-xs mt-1">
                * تغييرات غير محفوظة
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onSave(code.id, val, code.product_code)}
              disabled={!isDirty}
              className={`h-8 w-8 ${isDirty ? 'text-green-600 hover:bg-green-50' : 'text-gray-300'}`}
              title="حفظ التعديلات"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDelete(code.id)}
              className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-50"
              title="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


