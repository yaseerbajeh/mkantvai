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
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface Product {
  id: string;
  product_code: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  section: number;
  section_title: string;
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
  const [subscriptionCodes, setSubscriptionCodes] = useState<SubscriptionCode[]>([]);
  const [subscriptionCounts, setSubscriptionCounts] = useState<{ [key: string]: number }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [subscriptionCodesDialogOpen, setSubscriptionCodesDialogOpen] = useState(false);
  const [selectedProductCode, setSelectedProductCode] = useState<string>('');
  const [bulkCodes, setBulkCodes] = useState<string>('');

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

  const handleAddSubscriptionCodes = async () => {
    if (!selectedProductCode || !bulkCodes.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رمز المنتج ورموز الاشتراكات',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('غير مصرح');

      const codes = bulkCodes
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      const response = await fetch('/api/admin/products/subscription-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          product_code: selectedProductCode,
          codes,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'فشل في إضافة رموز الاشتراكات');
      }

      toast({
        title: 'نجح',
        description: `تم إضافة ${result.added} رمز اشتراك`,
      });

      setSubscriptionCodesDialogOpen(false);
      setBulkCodes('');
      fetchSubscriptionCodes();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ',
        variant: 'destructive',
      });
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
    const matchesSection = sectionFilter === 'all' || product.section.toString() === sectionFilter;
    const matchesActive = activeFilter === 'all' || 
      (activeFilter === 'active' && product.is_active) ||
      (activeFilter === 'inactive' && !product.is_active);
    return matchesSearch && matchesSection && matchesActive;
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
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">إدارة المنتجات والاشتراكات</h1>
            <Button onClick={handleCreateProduct} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 ml-2" />
              إضافة منتج جديد
            </Button>
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="bg-slate-800 border-slate-700">
              <TabsTrigger value="products" className="data-[state=active]:bg-slate-700">
                <Package className="h-4 w-4 ml-2" />
                المنتجات
              </TabsTrigger>
              <TabsTrigger value="subscription-codes" className="data-[state=active]:bg-slate-700">
                <Key className="h-4 w-4 ml-2" />
                رموز الاشتراكات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-6">
              {/* Filters */}
              <Card className="bg-slate-800/50 border-slate-700 mb-6">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="بحث بالاسم أو الكود..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-10 bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                    <Select value={sectionFilter} onValueChange={setSectionFilter}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="القسم" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأقسام</SelectItem>
                        <SelectItem value="1">القسم 1 - IPTV</SelectItem>
                        <SelectItem value="2">القسم 2 - المميزة</SelectItem>
                        <SelectItem value="3">القسم 3 - السنوية</SelectItem>
                        <SelectItem value="4">القسم 4 - البكجات</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={activeFilter} onValueChange={setActiveFilter}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
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
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-2xl text-white">
                    المنتجات ({filteredProducts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredProducts.length === 0 ? (
                    <p className="text-slate-300 text-center py-8">لا توجد منتجات</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-white">الكود</TableHead>
                            <TableHead className="text-white">الاسم</TableHead>
                            <TableHead className="text-white">السعر</TableHead>
                            <TableHead className="text-white">القسم</TableHead>
                            <TableHead className="text-white">الحالة</TableHead>
                            <TableHead className="text-white">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.map((product) => (
                            <TableRow key={product.id} className="border-slate-700">
                              <TableCell className="font-mono text-sm text-white">
                                {product.product_code}
                              </TableCell>
                              <TableCell className="text-white">{product.name}</TableCell>
                              <TableCell className="text-white">{product.price} ريال</TableCell>
                              <TableCell className="text-slate-300">{product.section_title}</TableCell>
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
                                    onClick={() => handleToggleActive(product)}
                                    className="bg-slate-800 border-slate-700 text-white"
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
                                    className="bg-slate-800 border-slate-700 text-white"
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
              <Card className="bg-slate-800/50 border-slate-700 mb-6">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl text-white">رموز الاشتراكات</CardTitle>
                    <Button
                      onClick={() => {
                        setSelectedProductCode('');
                        setBulkCodes('');
                        setSubscriptionCodesDialogOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة رموز
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(subscriptionCounts).map(([productCode, count]) => (
                      <Card key={productCode} className="bg-slate-900/50 border-slate-700">
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center mb-4">
                            <div>
                              <h3 className="text-lg font-bold text-white">{productCode}</h3>
                              <p className="text-slate-300 text-sm">
                                {count} رمز متاح
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {subscriptionCodes
                              .filter(sc => sc.product_code === productCode)
                              .slice(0, 10)
                              .map((code) => (
                                <div
                                  key={code.id}
                                  className="flex justify-between items-center p-2 bg-slate-800 rounded"
                                >
                                  <span className="text-slate-300 font-mono text-sm">
                                    {code.subscription_code}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteSubscriptionCode(code.id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            {subscriptionCodes.filter(sc => sc.product_code === productCode).length > 10 && (
                              <p className="text-slate-400 text-sm text-center">
                                و {subscriptionCodes.filter(sc => sc.product_code === productCode).length - 10} رمز آخر...
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {Object.keys(subscriptionCounts).length === 0 && (
                      <p className="text-slate-300 text-center py-8">لا توجد رموز اشتراكات</p>
                    )}
                  </div>
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
      />

      {/* Subscription Codes Dialog */}
      <Dialog open={subscriptionCodesDialogOpen} onOpenChange={setSubscriptionCodesDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>إضافة رموز اشتراكات</DialogTitle>
            <DialogDescription className="text-slate-400">
              أدخل رموز الاشتراكات (كل رمز في سطر جديد)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>رمز المنتج</Label>
              <Input
                value={selectedProductCode}
                onChange={(e) => setSelectedProductCode(e.target.value)}
                placeholder="SUB-BASIC-1M"
                className="bg-slate-900 border-slate-700 text-white mt-2"
              />
            </div>
            <div>
              <Label>رموز الاشتراكات</Label>
              <Textarea
                value={bulkCodes}
                onChange={(e) => setBulkCodes(e.target.value)}
                placeholder="SUB-BASIC-1M-001&#10;SUB-BASIC-1M-002&#10;SUB-BASIC-1M-003"
                className="bg-slate-900 border-slate-700 text-white mt-2 min-h-[200px] font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSubscriptionCodesDialogOpen(false)}
              className="bg-slate-700 border-slate-600 text-white"
            >
              إلغاء
            </Button>
            <Button onClick={handleAddSubscriptionCodes} className="bg-blue-600 hover:bg-blue-700">
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Product Form Dialog Component
function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    product_code: '',
    name: '',
    description: '',
    price: '',
    duration: '',
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

  useEffect(() => {
    if (product) {
      setFormData({
        product_code: product.product_code,
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        duration: product.duration,
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
    } else {
      setFormData({
        product_code: '',
        name: '',
        description: '',
        price: '',
        duration: '',
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
    }
  }, [product, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      price: parseFloat(formData.price),
      section: parseInt(formData.section),
      display_order: parseInt(formData.display_order),
      features: formData.is_package && formData.features
        ? formData.features.split('\n').map(f => f.trim()).filter(f => f)
        : null,
      image2: formData.image2 || null,
    };
    onSave(submitData);
  };

  const sectionTitles: { [key: string]: string } = {
    '1': 'اشتراكات IPTV',
    '2': 'الاشتراكات المميزة',
    '3': 'الاشتراكات السنوية',
    '4': 'البكجات',
  };

  useEffect(() => {
    if (sectionTitles[formData.section]) {
      setFormData(prev => ({ ...prev, section_title: sectionTitles[formData.section] }));
    }
  }, [formData.section]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
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
                className="bg-slate-900 border-slate-700 text-white mt-2"
                disabled={!!product}
              />
            </div>
            <div>
              <Label>الاسم *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-slate-900 border-slate-700 text-white mt-2"
              />
            </div>
            <div className="col-span-2">
              <Label>الوصف</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-2"
              />
            </div>
            <div>
              <Label>السعر (ريال) *</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                className="bg-slate-900 border-slate-700 text-white mt-2"
              />
            </div>
            <div>
              <Label>المدة</Label>
              <Input
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-2"
              />
            </div>
            <div>
              <Label>القسم *</Label>
              <Select value={formData.section} onValueChange={(value) => setFormData({ ...formData, section: value })}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - IPTV</SelectItem>
                  <SelectItem value="2">2 - المميزة</SelectItem>
                  <SelectItem value="3">3 - السنوية</SelectItem>
                  <SelectItem value="4">4 - البكجات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ترتيب العرض</Label>
              <Input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-2"
              />
            </div>
            <div>
              <Label>صورة URL</Label>
              <Input
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-2"
              />
            </div>
            <div>
              <Label>صورة إضافية URL</Label>
              <Input
                value={formData.image2}
                onChange={(e) => setFormData({ ...formData, image2: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-2"
              />
            </div>
            <div>
              <Label>Gradient</Label>
              <Input
                value={formData.gradient}
                onChange={(e) => setFormData({ ...formData, gradient: e.target.value })}
                placeholder="from-blue-500 to-cyan-500"
                className="bg-slate-900 border-slate-700 text-white mt-2"
              />
            </div>
            <div>
              <Label>Badge Color</Label>
              <Input
                value={formData.badge_color}
                onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                placeholder="bg-blue-500"
                className="bg-slate-900 border-slate-700 text-white mt-2"
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
                  className="bg-slate-900 border-slate-700 text-white mt-2"
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
              className="bg-slate-700 border-slate-600 text-white"
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

