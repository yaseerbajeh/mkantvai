'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import LeadCard from '@/components/leads/LeadCard';
import { 
  Loader2, 
  Search,
  Plus,
  ShoppingCart,
  UserPlus,
  MessageCircle,
  CheckCircle2,
  XCircle,
  X,
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
  status: 'new' | 'contacted' | 'converted' | 'lost' | 'non_converted';
  importance?: 'low' | 'medium' | 'high' | 'urgent';
  reminder_date?: string;
  converted_at?: string;
  non_converted_at?: string;
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
  
  // Manual lead creation dialog
  const [manualLeadDialogOpen, setManualLeadDialogOpen] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    products: [] as Product[],
    total_amount: 0,
    importance: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    reminder_date: '',
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

  const handleAddComment = async (leadId: string, comment: string) => {
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
        body: JSON.stringify({ comment }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إضافة التعليق');
      }

      toast({
        title: 'نجح',
        description: 'تم إضافة التعليق بنجاح',
      });

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إضافة التعليق',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDeleteLead = async (leadId: string) => {
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
    }
  };

  const handleUpdateStatus = async (leadId: string, status: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء تحديث الحالة');
      }

      toast({
        title: 'نجح',
        description: 'تم تحديث الحالة بنجاح',
      });

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث الحالة',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleUpdateImportance = async (leadId: string, importance: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ importance }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء تحديث الأهمية');
      }

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث الأهمية',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleUpdateReminder = async (leadId: string, reminderDate: string | null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('غير مصرح');
      }

      const response = await fetch(`/api/admin/leads/${leadId}/reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reminder_date: reminderDate }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء تحديث التذكير');
      }

      toast({
        title: 'نجح',
        description: reminderDate ? 'تم تعيين التذكير بنجاح' : 'تم إلغاء التذكير',
      });

      await fetchLeads();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تحديث التذكير',
        variant: 'destructive',
      });
      throw error;
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
        importance: 'medium',
        reminder_date: '',
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

  // Helper to check if lead is within 24 hours
  const isWithin24Hours = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  };

  // Helper to check if lead is considered "new" (status is new AND within 24 hours)
  const isNewLead = (lead: Lead) => {
    return lead.status === 'new' && isWithin24Hours(lead.created_at);
  };

  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    // Filter by tab
    if (activeTab === 'abandoned_cart') {
      filtered = filtered.filter(lead => lead.source === 'abandoned_cart');
    } else if (activeTab === 'whatsapp') {
      filtered = filtered.filter(lead => lead.source === 'whatsapp');
    } else if (activeTab === 'manual') {
      filtered = filtered.filter(lead => lead.source === 'manual');
    } else if (activeTab === 'converted') {
      filtered = filtered.filter(lead => lead.status === 'converted');
    } else if (activeTab === 'non_converted') {
      filtered = filtered.filter(lead => lead.status === 'non_converted');
    } else {
      // For all other tabs (including 'all'), hide converted leads
      // They can still be viewed in the 'converted' tab
      filtered = filtered.filter(lead => lead.status !== 'converted');
    }

    // For "new" status filtering, only show leads that are actually new (within 24 hours)
    // This is handled by the isNewLead function above

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
    const newLeads = leads.filter(l => isNewLead(l)).length; // Only count leads within 24 hours
    const contacted = leads.filter(l => l.status === 'contacted').length;
    const converted = leads.filter(l => l.status === 'converted').length;
    const nonConverted = leads.filter(l => l.status === 'non_converted').length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';

    return { 
      total, 
      abandonedCart, 
      whatsapp, 
      manual, 
      newLeads, 
      contacted, 
      converted, 
      nonConverted,
      conversionRate 
    };
  }, [leads]);

  const tabCounts = useMemo(() => {
    return {
      all: leads.length,
      abandoned_cart: leads.filter(l => l.source === 'abandoned_cart').length,
      whatsapp: leads.filter(l => l.source === 'whatsapp').length,
      manual: leads.filter(l => l.source === 'manual').length,
      converted: leads.filter(l => l.status === 'converted').length,
      non_converted: leads.filter(l => l.status === 'non_converted').length,
    };
  }, [leads]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" dir="rtl">
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-[1800px] mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">إدارة العملاء المحتملين (CRM)</h1>
              <p className="text-slate-300">تتبع وإدارة العملاء المحتملين من مصادر مختلفة</p>
            </div>
            <Dialog open={manualLeadDialogOpen} onOpenChange={setManualLeadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة عميل محتمل
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-white text-2xl">إضافة عميل محتمل جديد</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 mb-2 block">الاسم *</Label>
                      <Input
                        value={manualLeadForm.name}
                        onChange={(e) => setManualLeadForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="اسم العميل"
                        className="bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-2 block">البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={manualLeadForm.email}
                        onChange={(e) => setManualLeadForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@example.com"
                        className="bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-2 block">واتساب</Label>
                      <Input
                        value={manualLeadForm.whatsapp}
                        onChange={(e) => setManualLeadForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                        placeholder="+966501234567"
                        className="bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-2 block">الأهمية</Label>
                      <Select
                        value={manualLeadForm.importance}
                        onValueChange={(value: any) => setManualLeadForm(prev => ({ ...prev, importance: value }))}
                      >
                        <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">منخفض</SelectItem>
                          <SelectItem value="medium">متوسط</SelectItem>
                          <SelectItem value="high">عالي</SelectItem>
                          <SelectItem value="urgent">عاجل</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300 mb-2 block">تاريخ التذكير (اختياري)</Label>
                      <Input
                        type="datetime-local"
                        value={manualLeadForm.reminder_date}
                        onChange={(e) => setManualLeadForm(prev => ({ ...prev, reminder_date: e.target.value }))}
                        className="bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300 mb-2 block">المنتجات</Label>
                    <div className="flex gap-2">
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
                      <div className="mt-3 space-y-2">
                        {manualLeadForm.products.map((product, index) => (
                          <div key={index} className="flex items-center justify-between bg-slate-900 p-3 rounded">
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
                        <div className="text-slate-300 font-semibold mt-3 text-lg">
                          الإجمالي: {manualLeadForm.total_amount} ريال
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-700">
                    <Button
                      onClick={handleCreateManualLead}
                      disabled={creatingLead || !manualLeadForm.name.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                    >
                      {creatingLead ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin ml-2" />
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
            <Card className="bg-blue-900/20 border-blue-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-blue-500">{statistics.total}</div>
                    <div className="text-slate-300 mt-1 text-xs">إجمالي</div>
                  </div>
                  <UserPlus className="h-6 w-6 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-orange-900/20 border-orange-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-orange-500">{statistics.abandonedCart}</div>
                    <div className="text-slate-300 mt-1 text-xs">سلات</div>
                  </div>
                  <ShoppingCart className="h-6 w-6 text-orange-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-900/20 border-green-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green-500">{statistics.whatsapp}</div>
                    <div className="text-slate-300 mt-1 text-xs">واتساب</div>
                  </div>
                  <MessageCircle className="h-6 w-6 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-900/20 border-purple-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-purple-500">{statistics.manual}</div>
                    <div className="text-slate-300 mt-1 text-xs">يدوي</div>
                  </div>
                  <UserPlus className="h-6 w-6 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-900/20 border-yellow-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-yellow-500">{statistics.newLeads}</div>
                    <div className="text-slate-300 mt-1 text-xs">جديد</div>
                  </div>
                  <UserPlus className="h-6 w-6 text-yellow-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-indigo-900/20 border-indigo-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-indigo-500">{statistics.contacted}</div>
                    <div className="text-slate-300 mt-1 text-xs">تم الاتصال</div>
                  </div>
                  <MessageCircle className="h-6 w-6 text-indigo-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-teal-900/20 border-teal-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-teal-500">{statistics.converted}</div>
                    <div className="text-slate-300 mt-1 text-xs">محول</div>
                  </div>
                  <CheckCircle2 className="h-6 w-6 text-teal-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-900/20 border-red-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-red-500">{statistics.conversionRate}%</div>
                    <div className="text-slate-300 mt-1 text-xs">نسبة التحويل</div>
                  </div>
                  <XCircle className="h-6 w-6 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
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

          {/* Main Content with Right Sidebar */}
          <div className="flex gap-6">
            {/* Main Content Area - Cards Grid */}
            <div className="flex-1">
              {filteredLeads.length === 0 ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="py-16 text-center">
                    <p className="text-slate-300 text-lg">لا توجد عملاء محتملين</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onUpdate={fetchLeads}
                      onDelete={handleDeleteLead}
                      onAddComment={handleAddComment}
                      onUpdateStatus={handleUpdateStatus}
                      onUpdateImportance={handleUpdateImportance}
                      onUpdateReminder={handleUpdateReminder}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Sidebar - Tabs */}
            <div className="w-64 flex-shrink-0">
              <Card className="bg-slate-800/50 border-slate-700 sticky top-32">
                <CardHeader>
                  <CardTitle className="text-xl text-white">التصنيفات</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex flex-col">
                    <button
                      onClick={() => setActiveTab('all')}
                      className={`text-right px-4 py-3 transition-colors border-r-4 ${
                        activeTab === 'all'
                          ? 'bg-slate-700 border-blue-500 text-white'
                          : 'border-transparent text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">الكل</span>
                        <Badge className="bg-slate-600 text-slate-200 text-xs">
                          {tabCounts.all}
                        </Badge>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('abandoned_cart')}
                      className={`text-right px-4 py-3 transition-colors border-r-4 ${
                        activeTab === 'abandoned_cart'
                          ? 'bg-slate-700 border-orange-500 text-white'
                          : 'border-transparent text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">السلات المتروكة</span>
                        <Badge className="bg-orange-600 text-orange-200 text-xs">
                          {tabCounts.abandoned_cart}
                        </Badge>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('whatsapp')}
                      className={`text-right px-4 py-3 transition-colors border-r-4 ${
                        activeTab === 'whatsapp'
                          ? 'bg-slate-700 border-green-500 text-white'
                          : 'border-transparent text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">واتساب</span>
                        <Badge className="bg-green-600 text-green-200 text-xs">
                          {tabCounts.whatsapp}
                        </Badge>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('manual')}
                      className={`text-right px-4 py-3 transition-colors border-r-4 ${
                        activeTab === 'manual'
                          ? 'bg-slate-700 border-purple-500 text-white'
                          : 'border-transparent text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">يدوي</span>
                        <Badge className="bg-purple-600 text-purple-200 text-xs">
                          {tabCounts.manual}
                        </Badge>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('converted')}
                      className={`text-right px-4 py-3 transition-colors border-r-4 ${
                        activeTab === 'converted'
                          ? 'bg-slate-700 border-teal-500 text-white'
                          : 'border-transparent text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">محول</span>
                        <Badge className="bg-teal-600 text-teal-200 text-xs">
                          {tabCounts.converted}
                        </Badge>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('non_converted')}
                      className={`text-right px-4 py-3 transition-colors border-r-4 ${
                        activeTab === 'non_converted'
                          ? 'bg-slate-700 border-red-500 text-white'
                          : 'border-transparent text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">غير محول</span>
                        <Badge className="bg-red-600 text-red-200 text-xs">
                          {tabCounts.non_converted}
                        </Badge>
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
