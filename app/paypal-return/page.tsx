'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function PayPalReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
  });

  // Pre-fill email if available from URL params
  useEffect(() => {
    const email = searchParams.get('email');
    if (email) {
      setFormData(prev => ({ ...prev, email }));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.whatsapp) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Create order via API
      const response = await fetch('/api/orders/create-from-paypal-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp,
          product_code: 'SUB-BASIC-1M',
          payment_link_id: '5ZMTA2LQS9UCN', // PayPal payment link ID
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشل في إنشاء الطلب');
      }

      setSubmitted(true);
      
      toast({
        title: 'نجح',
        description: 'تم إنشاء الطلب بنجاح! سيتم توجيهك إلى صفحة الطلبات',
      });

      // Redirect to my-orders after 2 seconds
      setTimeout(() => {
        router.push('/my-orders');
      }, 2000);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إنشاء الطلب',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-2xl mx-auto">
          {submitted ? (
            <Card className="bg-gradient-to-br from-green-800/20 to-green-900/20 border-green-700">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">تم إتمام الطلب بنجاح!</h2>
                <p className="text-slate-300 mb-4">
                  سيتم توجيهك إلى صفحة طلباتك خلال لحظات...
                </p>
                <Loader2 className="h-6 w-6 animate-spin text-white mx-auto" />
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700">
              <CardHeader>
                <CardTitle className="text-2xl text-white">إتمام الطلب</CardTitle>
                <CardDescription className="text-slate-300">
                  بعد إتمام الدفع عبر PayPal، يرجى إدخال بياناتك لإتمام الطلب
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                      className="bg-slate-900/50 border-slate-700 text-white"
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
                      className="bg-slate-900/50 border-slate-700 text-white"
                      placeholder="example@email.com"
                      dir="ltr"
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
                      className="bg-slate-900/50 border-slate-700 text-white"
                      placeholder="966xxxxxxxxx"
                      dir="ltr"
                    />
                    <p className="text-xs text-slate-400">مطلوب للتواصل معك</p>
                  </div>

                  <div className="pt-4">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          جاري المعالجة...
                        </>
                      ) : (
                        'إتمام الطلب'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

