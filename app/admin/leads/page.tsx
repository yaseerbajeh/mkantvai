'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, 
  Search,
  Mail,
  MessageCircle,
  Trash2,
  Plus,
  ShoppingCart,
  UserPlus,
  MessageSquare,
  X
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface Product {
  id?: string;
  product_code?: string;
  product_name: string;
  price: number;
  quantity: number;
}

interface Comment {
  text: string;
  added_by: string;
  added_at: string;
}

interface Lead {
  id: string;
  source: 'abandoned_cart' | 'whatsapp' | 'manual';
  name: string;
  email?: string;
  whatsapp?: string;
  products: Product[];
  total_amount: number;
  comments: Comment[];
  status: 'new' | 'contacted' | 'converted' | 'lost';
  source_reference_id?: string;
  created_at: string;
  updated_at: string;
}

interface ProductOption {
  id: string;
  product_code: string;
  name: string;
  price: number;
}

export default function CRMLeadsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [commentDialogOpen, setCommentDialogOpen] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [deletingLead, setDeletingLead] = useState<string | null>(null);
  
  // Manual lead creation dialog
  const [manualLeadDialogOpen, setManualLeadDialogOpen] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    products: [] as Product[],
    total_amount: 0,
  });
  const [selectedProduct, setSelectedProduct] = useState<{ product: ProductOption | null; quantity: number }>({
    product: null,
    quantity: 1,
  });

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
            router.push('/');
            return;
          }
        }

        setUser(session.user);
        await Promise.all([fetchLeads(), fetchProducts()]);
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

  const fetchLeads = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/leads', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'فشل جلب العملاء المحتملين';
        const errorDetails = errorData.details || '';
        
        // Check if table doesn't exist
        if (errorMessage.includes('غير موجود') || errorMessage.includes('does not exist')) {
          toast({
            title: 'خطأ في قاعدة البيانات',
            description: errorMessage + (errorDetails ? `\n${errorDetails}` : ''),
            variant: 'destructive',
          });
        } else {
          throw new Error(errorMessage);
        }
        return;
      }

      const { leads: fetchedLeads } = await response.json();
      setLeads(fetchedLeads || []);
    } catch (error: any) {
      console.error('Fetch leads error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء جلب العملاء المحتملين',
        variant: 'destructive',
      });
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/admin/products', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const { products: fetchedProducts } = await response.json();
        setProducts(fetchedProducts || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleAddComment = async (leadId: string) => {
    if (!commentText.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال تعليق',
        variant: 'destructive',
      });
      return;
    }

    setAddingComment(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ comment: commentText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إضافة التعليق');
      }

      toast({
        title: 'نجح',
        description: 'تم إضافة التعليق بنجاح',
      });

      setCommentText('');
      setCommentDialogOpen(null);
      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إضافة التعليق',
        variant: 'destructive',
      });
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العميل المحتمل؟')) {
      return;
    }

    setDeletingLead(leadId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'حدث خطأ أثناء حذف العميل المحتمل');
      }

      toast({
        title: 'نجح',
        description: 'تم حذف العميل المحتمل بنجاح',
      });

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء حذف العميل المحتمل',
        variant: 'destructive',
      });
    } finally {
      setDeletingLead(null);
    }
  };

  const handleAddProductToManualLead = () => {
    if (!selectedProduct.product) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار منتج',
        variant: 'destructive',
      });
      return;
    }

    const newProduct: Product = {
      product_name: selectedProduct.product.name,
      product_code: selectedProduct.product.product_code,
      price: selectedProduct.product.price,
      quantity: selectedProduct.quantity,
    };

    setManualLeadForm(prev => ({
      ...prev,
      products: [...prev.products, newProduct],
      total_amount: prev.total_amount + (selectedProduct.product!.price * selectedProduct.quantity),
    }));

    setSelectedProduct({ product: null, quantity: 1 });
  };

  const handleRemoveProductFromManualLead = (index: number) => {
    const product = manualLeadForm.products[index];
    setManualLeadForm(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
      total_amount: prev.total_amount - (product.price * product.quantity),
    }));
  };

  const handleCreateManualLead = async () => {
    if (!manualLeadForm.name.trim()) {
      toast({
        title: 'خطأ',
        description: 'الاسم مطلوب',
        variant: 'destructive',
      });
      return;
    }

    setCreatingLead(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          source: 'manual',
          name: manualLeadForm.name,
          email: manualLeadForm.email || null,
          whatsapp: manualLeadForm.whatsapp || null,
          products: manualLeadForm.products,
          total_amount: manualLeadForm.total_amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إنشاء العميل المحتمل');
      }

      toast({
        title: 'نجح',
        description: 'تم إنشاء العميل المحتمل بنجاح',
      });

      setManualLeadDialogOpen(false);
      setManualLeadForm({
        name: '',
        email: '',
        whatsapp: '',
        products: [],
        total_amount: 0,
      });
      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إنشاء العميل المحتمل',
        variant: 'destructive',
      });
    } finally {
      setCreatingLead(false);
    }
  };

  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    // Filter by source
    if (activeTab !== 'all') {
      filtered = filtered.filter(lead => lead.source === activeTab);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.name.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.whatsapp?.toLowerCase().includes(query) ||
        lead.products.some(p => p.product_name.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [leads, activeTab, searchQuery]);

  const statistics = useMemo(() => {
    const total = leads.length;
    const abandonedCart = leads.filter(l => l.source === 'abandoned_cart').length;
    const whatsapp = leads.filter(l => l.source === 'whatsapp').length;
    const manual = leads.filter(l => l.source === 'manual').length;
    const newLeads = leads.filter(l => l.status === 'new').length;
    const contacted = leads.filter(l => l.status === 'contacted').length;
    const converted = leads.filter(l => l.status === 'converted').length;

    return { total, abandonedCart, whatsapp, manual, newLeads, contacted, converted };
  }, [leads]);

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
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">إدارة العملاء المحتملين (CRM)</h1>
              <p className="text-slate-300">تتبع وإدارة العملاء المحتملين من مصادر مختلفة</p>
            </div>
            <Dialog open={manualLeadDialogOpen} onOpenChange={setManualLeadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  إضافة عميل محتمل
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white">إضافة عميل محتمل جديد</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-slate-300">الاسم *</Label>
                    <Input
                      value={manualLeadForm.name}
                      onChange={(e) => setManualLeadForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="اسم العميل"
                      className="bg-slate-900 border-slate-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      value={manualLeadForm.email}
                      onChange={(e) => setManualLeadForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="bg-slate-900 border-slate-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">واتساب</Label>
                    <Input
                      value={manualLeadForm.whatsapp}
                      onChange={(e) => setManualLeadForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                      placeholder="+966501234567"
                      className="bg-slate-900 border-slate-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">المنتجات</Label>
                    <div className="flex gap-2 mt-1">
                      <select
                        value={selectedProduct.product?.id || ''}
                        onChange={(e) => {
                          const product = products.find(p => p.id === e.target.value);
                          setSelectedProduct(prev => ({ ...prev, product: product || null }));
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2"
                      >
                        <option value="">اختر منتج</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {product.price} ريال
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="1"
                        value={selectedProduct.quantity}
                        onChange={(e) => setSelectedProduct(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                        placeholder="الكمية"
                        className="w-24 bg-slate-900 border-slate-700 text-white"
                      />
                      <Button
                        onClick={handleAddProductToManualLead}
                        disabled={!selectedProduct.product}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        إضافة
                      </Button>
                    </div>
                    {manualLeadForm.products.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {manualLeadForm.products.map((product, index) => (
                          <div key={index} className="flex items-center justify-between bg-slate-900 p-2 rounded">
                            <span className="text-slate-300 text-sm">
                              {product.product_name} (x{product.quantity}) - {product.price * product.quantity} ريال
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveProductFromManualLead(index)}
                              className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <div className="text-slate-300 font-semibold mt-2">
                          الإجمالي: {manualLeadForm.total_amount} ريال
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={handleCreateManualLead}
                      disabled={creatingLead || !manualLeadForm.name.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                    >
                      {creatingLead ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          جاري الإنشاء...
                        </>
                      ) : (
                        'إنشاء عميل محتمل'
                      )}
                    </Button>
                    <Button
                      onClick={() => setManualLeadDialogOpen(false)}
                      variant="outline"
                      className="border-slate-700 text-slate-300"
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
            <Card className="bg-blue-900/20 border-blue-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-blue-500">{statistics.total}</div>
                    <div className="text-slate-300 mt-2 text-sm">إجمالي العملاء</div>
                  </div>
                  <UserPlus className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-orange-900/20 border-orange-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-orange-500">{statistics.abandonedCart}</div>
                    <div className="text-slate-300 mt-2 text-sm">سلات متروكة</div>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-orange-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-900/20 border-green-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-green-500">{statistics.whatsapp}</div>
                    <div className="text-slate-300 mt-2 text-sm">واتساب</div>
                  </div>
                  <MessageCircle className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-900/20 border-purple-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-purple-500">{statistics.manual}</div>
                    <div className="text-slate-300 mt-2 text-sm">يدوي</div>
                  </div>
                  <UserPlus className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-900/20 border-yellow-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-yellow-500">{statistics.newLeads}</div>
                    <div className="text-slate-300 mt-2 text-sm">جديد</div>
                  </div>
                  <UserPlus className="h-8 w-8 text-yellow-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-indigo-900/20 border-indigo-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-indigo-500">{statistics.contacted}</div>
                    <div className="text-slate-300 mt-2 text-sm">تم الاتصال</div>
                  </div>
                  <MessageCircle className="h-8 w-8 text-indigo-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-teal-900/20 border-teal-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold text-teal-500">{statistics.converted}</div>
                    <div className="text-slate-300 mt-2 text-sm">محول</div>
                  </div>
                  <UserPlus className="h-8 w-8 text-teal-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث بالاسم أو البريد أو الواتساب أو المنتج..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Leads Table with Tabs */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-2xl text-white">
                العملاء المحتملين ({filteredLeads.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4 mb-4 bg-slate-900">
                  <TabsTrigger value="all" className="data-[state=active]:bg-slate-700">الكل</TabsTrigger>
                  <TabsTrigger value="abandoned_cart" className="data-[state=active]:bg-slate-700">السلات المتروكة</TabsTrigger>
                  <TabsTrigger value="whatsapp" className="data-[state=active]:bg-slate-700">واتساب</TabsTrigger>
                  <TabsTrigger value="manual" className="data-[state=active]:bg-slate-700">يدوي</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                  {filteredLeads.length === 0 ? (
                    <p className="text-slate-300 text-center py-8">لا توجد عملاء محتملين</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700 hover:bg-slate-700/50">
                            <TableHead className="text-white">العميل</TableHead>
                            <TableHead className="text-white">المنتجات</TableHead>
                            <TableHead className="text-white">المبلغ</TableHead>
                            <TableHead className="text-white">المصدر</TableHead>
                            <TableHead className="text-white">منذ</TableHead>
                            <TableHead className="text-white">التعليقات</TableHead>
                            <TableHead className="text-white">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLeads.map((lead) => (
                            <TableRow key={lead.id} className="border-slate-700 hover:bg-slate-700/50">
                              <TableCell className="text-white">
                                <div className="space-y-1">
                                  <div className="font-semibold">{lead.name}</div>
                                  {lead.email && (
                                    <div className="text-xs text-slate-400 flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {lead.email}
                                    </div>
                                  )}
                                  {lead.whatsapp && (
                                    <div className="text-xs text-slate-400 flex items-center gap-1">
                                      <MessageCircle className="h-3 w-3" />
                                      {lead.whatsapp}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-300 text-sm">
                                <div className="space-y-1">
                                  {lead.products.length > 0 ? (
                                    lead.products.map((product, idx) => (
                                      <div key={idx} className="text-xs">
                                        • {product.product_name} {product.quantity > 1 && `(x${product.quantity})`}
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-slate-500 text-xs">لا توجد منتجات</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-white">
                                {lead.total_amount ? `${lead.total_amount.toLocaleString()} ريال` : '0 ريال'}
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  lead.source === 'abandoned_cart' 
                                    ? 'bg-orange-900/50 text-orange-500 border-orange-700'
                                    : lead.source === 'whatsapp'
                                    ? 'bg-green-900/50 text-green-500 border-green-700'
                                    : 'bg-purple-900/50 text-purple-500 border-purple-700'
                                }>
                                  {lead.source === 'abandoned_cart' ? 'سلة متروكة' : lead.source === 'whatsapp' ? 'واتساب' : 'يدوي'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-400 text-xs">
                                منذ {formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ar })}
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-slate-700 text-slate-300">
                                  {lead.comments?.length || 0} تعليق
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Dialog open={commentDialogOpen === lead.id} onOpenChange={(open) => {
                                    setCommentDialogOpen(open ? lead.id : null);
                                    if (!open) setCommentText('');
                                  }}>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="outline" className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700 h-7 text-xs">
                                        <MessageSquare className="h-3 w-3 mr-1" />
                                        تعليق
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
                                      <DialogHeader>
                                        <DialogTitle className="text-white">إضافة تعليق</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 mt-4">
                                        <Textarea
                                          value={commentText}
                                          onChange={(e) => setCommentText(e.target.value)}
                                          placeholder="اكتب تعليقك هنا..."
                                          className="bg-slate-900 border-slate-700 text-white min-h-[100px]"
                                        />
                                        <div className="space-y-2">
                                          <p className="text-sm text-slate-400 font-semibold">التعليقات السابقة:</p>
                                          {lead.comments && lead.comments.length > 0 ? (
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                              {lead.comments.map((comment, idx) => (
                                                <div key={idx} className="bg-slate-900 p-3 rounded text-xs">
                                                  <p className="text-slate-300">{comment.text}</p>
                                                  <p className="text-slate-500 text-xs mt-1">
                                                    {comment.added_by} - {formatDistanceToNow(new Date(comment.added_at), { addSuffix: true, locale: ar })}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-slate-500 text-sm">لا توجد تعليقات</p>
                                          )}
                                        </div>
                                        <Button
                                          onClick={() => handleAddComment(lead.id)}
                                          disabled={addingComment || !commentText.trim()}
                                          className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                                        >
                                          {addingComment ? (
                                            <>
                                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                              جاري الإضافة...
                                            </>
                                          ) : (
                                            'إضافة تعليق'
                                          )}
                                        </Button>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-red-600 hover:bg-red-700 text-white border-red-700 h-7 text-xs"
                                    onClick={() => handleDeleteLead(lead.id)}
                                    disabled={deletingLead === lead.id}
                                  >
                                    {deletingLead === lead.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        حذف
                                      </>
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

