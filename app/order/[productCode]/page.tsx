'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PayPalButton from '@/components/PayPalButton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { signIn, signUp } from '@/lib/auth';
import { Loader2, User, Mail, MessageCircle, X, CreditCard } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { formatPriceWithSar, convertSarToUsd } from '@/lib/utils';

// Product data (matching the 4-section structure)
const productsData: { [key: string]: any } = {
  'SUB-BASIC-1M': { name: 'اشتراك IPTV - 1 شهر', price: 49, duration: '1 شهر', code: 'SUB-BASIC-1M' },
  'SUB-BASIC-3M': { name: 'اشتراك IPTV - 3 أشهر', price: 129, duration: '3 أشهر', code: 'SUB-BASIC-3M' },
  'SUB-BASIC-6M': { name: 'اشتراك IPTV - 6 أشهر', price: 229, duration: '6 أشهر', code: 'SUB-BASIC-6M' },
  'SUB-PREMIUM-1M': { name: 'اشتراك مميز - 1 شهر', price: 79, duration: '1 شهر', code: 'SUB-PREMIUM-1M' },
  'SUB-PREMIUM-3M': { name: 'اشتراك مميز - 3 أشهر', price: 199, duration: '3 أشهر', code: 'SUB-PREMIUM-3M' },
  'SUB-PREMIUM-6M': { name: 'اشتراك مميز - 6 أشهر', price: 349, duration: '6 أشهر', code: 'SUB-PREMIUM-6M' },
  'SUB-ANNUAL-BASIC': { name: 'اشتراك سنوي - أساسي', price: 399, duration: '12 شهر', code: 'SUB-ANNUAL-BASIC' },
  'SUB-ANNUAL-PREMIUM': { name: 'اشتراك سنوي - مميز', price: 699, duration: '12 شهر', code: 'SUB-ANNUAL-PREMIUM' },
  'SUB-ANNUAL-VIP': { name: 'اشتراك سنوي - VIP', price: 1199, duration: '12 شهر', code: 'SUB-ANNUAL-VIP' },
  'SUB-PACKAGE-PREMIUM': { name: 'البكج الفاخر', price: 299, duration: 'باقة متكاملة', code: 'SUB-PACKAGE-PREMIUM' },
  'SUB-PACKAGE-LEGENDARY': { name: 'البكج الاسطوري', price: 199, duration: 'باقة مميزة', code: 'SUB-PACKAGE-LEGENDARY' },
};

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const productCode = params.productCode as string;
  const product = productsData[productCode];
  
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [showAuthOptions, setShowAuthOptions] = useState(false);
  const [choseVisitorCheckout, setChoseVisitorCheckout] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    email: '',
  });

  const [authData, setAuthData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setFormData({
          name: session.user.user_metadata?.full_name || '',
          whatsapp: '',
          email: session.user.email || '',
        });
      } else {
        // Show auth options popup if not signed in and hasn't chosen visitor checkout
        if (!choseVisitorCheckout) {
          setShowAuthOptions(true);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const handleSignIn = async () => {
    if (!authData.email || !authData.password) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const result = await signIn(authData.email, authData.password);
    
    if (result.error) {
      toast({
        title: 'خطأ',
        description: result.error.message,
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    toast({
      title: 'نجح',
      description: 'تم تسجيل الدخول بنجاح',
    });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      setFormData({
        name: session.user.user_metadata?.full_name || '',
        whatsapp: '',
        email: session.user.email || '',
      });
      setShowAuthOptions(false);
    }
    
    setAuthDialogOpen(false);
    setSubmitting(false);
    router.refresh();
  };

  const handleSignUp = async () => {
    if (!authData.email || !authData.password || !authData.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول',
        variant: 'destructive',
      });
      return;
    }

    if (authData.password !== authData.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'كلمات المرور غير متطابقة',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const result = await signUp(authData.email, authData.password);
    
    if (result.error) {
      toast({
        title: 'خطأ',
        description: result.error.message,
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    toast({
      title: 'نجح',
      description: 'تم إنشاء الحساب بنجاح',
    });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      setFormData({
        name: session.user.user_metadata?.full_name || '',
        whatsapp: '',
        email: session.user.email || '',
      });
      setShowAuthOptions(false);
    }
    
    setAuthDialogOpen(false);
    setSubmitting(false);
    router.refresh();
  };

  const handleVisitorCheckout = () => {
    setAuthDialogOpen(false);
    setShowAuthOptions(false);
    setChoseVisitorCheckout(true); // Mark that user chose visitor checkout
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) {
      toast({
        title: 'خطأ',
        description: 'المنتج غير موجود',
        variant: 'destructive',
      });
      return;
    }

    // Validate WhatsApp is required
    if (!formData.whatsapp || formData.whatsapp.trim() === '') {
      toast({
        title: 'خطأ',
        description: 'رقم الواتساب مطلوب لإكمال الطلب',
        variant: 'destructive',
      });
      return;
    }

    // Validate all required fields for visitor checkout
    if (!user && (!formData.name || !formData.email)) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          whatsapp: formData.whatsapp,
          email: formData.email,
          product_name: product.name,
          product_code: product.code,
          price: product.price,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء إنشاء الطلب');
      }

      router.push(`/orders/${data.order.id}`);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إنشاء الطلب',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-2xl mx-auto text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
            <p className="text-slate-300 mt-4">جاري التحميل...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-red-900/20 border-red-700">
              <CardContent className="pt-6">
                <p className="text-red-400 text-center">المنتج غير موجود</p>
                <Button onClick={() => router.push('/subscribe')} className="mt-4 w-full">
                  العودة إلى صفحة الاشتراكات
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Still loading
  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-2xl mx-auto">
          {/* Product Summary */}
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-xl text-white">{product.name}</CardTitle>
              <CardDescription className="text-slate-300">
                {(() => {
                  const { usdPrice } = formatPriceWithSar(product.price);
                  return `المدة: ${product.duration} | السعر: ${product.price} ريال (ما يساوي $${usdPrice})`;
                })()}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Order Form */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-2xl text-white">معلومات الطلب</CardTitle>
              <CardDescription className="text-slate-300">
                {user ? 'تم ملء المعلومات تلقائياً من حسابك' : 'يرجى ملء جميع الحقول'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-200">
                    الاسم الكامل <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="أدخل اسمك الكامل"
                    dir="rtl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">
                    البريد الإلكتروني <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="example@email.com"
                    dir="ltr"
                    disabled={!!user}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="text-slate-200">
                    رقم الواتساب <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    required
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="966xxxxxxxxx"
                    dir="ltr"
                  />
                  <p className="text-slate-400 text-xs">مطلوب لإكمال عملية الطلب</p>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري المعالجة...
                    </>
                  ) : (
                    'إرسال الطلب'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* PayPal Payment Section */}
          <Card className="bg-slate-800/50 border-slate-700 mt-6">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                الدفع عبر PayPal
              </CardTitle>
              <CardDescription className="text-slate-300">
                ادفع مباشرة عبر PayPal بطريقة آمنة وسريعة
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Validate form data before allowing PayPal payment */}
              {(!formData.name || !formData.email || !formData.whatsapp) ? (
                <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg text-yellow-400 text-center">
                  <p className="text-sm">يرجى ملء جميع الحقول أعلاه قبل استخدام PayPal</p>
                </div>
              ) : (
                <PayPalButton
                  productCode={product.code}
                  productName={product.name}
                  price={convertSarToUsd(product.price)}
                  currency="USD"
                  orderDetails={{
                    name: formData.name,
                    email: formData.email,
                    whatsapp: formData.whatsapp,
                  }}
                  className="mt-4"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />

      {/* Auth Options Dialog - shown when not signed in */}
      <Dialog open={showAuthOptions && !user} onOpenChange={setShowAuthOptions}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">إتمام الطلب</DialogTitle>
            <DialogDescription className="text-slate-300">
              {product.name} - {product.price} ريال
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              size="lg"
              onClick={() => {
                setShowAuthOptions(false);
                setAuthDialogOpen(true);
              }}
            >
              <User className="ml-2 h-5 w-5" />
              تسجيل الدخول / إنشاء حساب
            </Button>
            <Button 
              variant="outline" 
              className="w-full border-slate-700 text-slate-300 hover:text-white"
              size="lg"
              onClick={handleVisitorCheckout}
            >
              <Mail className="ml-2 h-5 w-5" />
              إتمام الطلب كزائر
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Dialog - Sign In / Sign Up */}
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">تسجيل الدخول أو إنشاء حساب</DialogTitle>
            <DialogDescription className="text-slate-300">
              اختر طريقة المتابعة
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
              <TabsTrigger value="signup">إنشاء حساب</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">البريد الإلكتروني</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={authData.email}
                  onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">كلمة المرور</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={authData.password}
                  onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  dir="ltr"
                />
              </div>
              <Button 
                onClick={handleSignIn} 
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : 'تسجيل الدخول'}
              </Button>
              <Button 
                variant="outline"
                onClick={handleVisitorCheckout}
                className="w-full border-slate-700 text-slate-300 hover:text-white"
              >
                إتمام الطلب كزائر
              </Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={authData.email}
                  onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">كلمة المرور</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={authData.password}
                  onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm">تأكيد كلمة المرور</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  value={authData.confirmPassword}
                  onChange={(e) => setAuthData({ ...authData, confirmPassword: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                  dir="ltr"
                />
              </div>
              <Button 
                onClick={handleSignUp} 
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : 'إنشاء حساب'}
              </Button>
              <Button 
                variant="outline"
                onClick={handleVisitorCheckout}
                className="w-full border-slate-700 text-slate-300 hover:text-white"
              >
                إتمام الطلب كزائر
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

    </div>
  );
}

