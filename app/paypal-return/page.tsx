'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle, Copy, ExternalLink } from 'lucide-react';

interface SubscriptionDetails {
  code: string;
  meta?: {
    duration?: string;
    type?: string;
  };
}

export default function PayPalReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { removeItem } = useCart();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [productCode, setProductCode] = useState<string | null>(null);

  // Get customer info from sessionStorage or URL params and auto-submit
  useEffect(() => {
    // Try to get from sessionStorage first (set before PayPal redirect)
    let name: string | null = null;
    let email: string | null = null;
    let whatsapp: string | null = null;
    let product: string | null = null;

    if (typeof window !== 'undefined') {
      const pendingOrder = sessionStorage.getItem('pending_order');
      if (pendingOrder) {
        try {
          const orderData = JSON.parse(pendingOrder);
          name = orderData.name;
          email = orderData.email;
          whatsapp = orderData.whatsapp;
          product = orderData.product_code;
          // Clear sessionStorage after reading
          sessionStorage.removeItem('pending_order');
        } catch (e) {
          console.error('Error parsing pending order:', e);
        }
      }
    }

    // Fallback to URL params if sessionStorage doesn't have it
    if (!name || !email || !whatsapp || !product) {
      name = searchParams.get('name') || name;
      email = searchParams.get('email') || email;
      whatsapp = searchParams.get('whatsapp') || whatsapp;
      product = searchParams.get('product_code') || product;
    }
    
    // Set product code
    if (product) {
      setProductCode(product);
    } else {
      // Default to SUB-BASIC-1M for backward compatibility
      setProductCode('SUB-BASIC-1M');
    }

    // If we have all customer info, auto-submit
    if (name && email && whatsapp && product && !submitted) {
      handleAutoSubmit(name, email, whatsapp);
    } else {
      // Just show loading if we have product but missing info
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleAutoSubmit = async (name: string, email: string, whatsapp: string) => {
    setLoading(true);

    try {
      // Create order via API
      const response = await fetch('/api/orders/create-from-paypal-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          whatsapp,
          product_code: productCode || 'SUB-BASIC-1M',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشل في إنشاء الطلب');
      }

      // Extract subscription details from response
      const subscription = (data.order as any)?.assigned_subscription || data.subscription;
      const orderNum = (data.order as any)?.order_number || data.order?.id?.slice(0, 8).toUpperCase();
      
      setSubscriptionDetails(subscription);
      setOrderNumber(orderNum);
      setSubmitted(true);
      
      // Remove the purchased product from cart if it exists
      if (productCode) {
        removeItem(productCode);
      }
      
      toast({
        title: 'نجح',
        description: subscription ? 'تم إنشاء الطلب بنجاح! تم تعيين الاشتراك تلقائياً' : 'تم إنشاء الطلب بنجاح! سيتم مراجعة طلبك قريباً',
      });

      // Don't auto-redirect if subscription is available - let them see the details
      if (!subscription) {
        setTimeout(() => {
          router.push('/my-orders');
        }, 3000);
      }
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'تم النسخ',
      description: 'تم نسخ رمز الاشتراك',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-2xl mx-auto">
          {submitted && subscriptionDetails ? (
            <div className="space-y-6">
              {/* Success Message */}
              <Card className="bg-gradient-to-br from-green-800/20 to-green-900/20 border-green-700">
                <CardContent className="pt-6 text-center">
                  <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">تم إتمام الطلب بنجاح! 🎉</h2>
                  <p className="text-slate-300">
                    تم تعيين الاشتراك لك تلقائياً
                  </p>
                </CardContent>
              </Card>

              {/* Subscription Details */}
              <Card className="bg-gradient-to-br from-blue-900/30 to-indigo-900/20 border-2 border-blue-600 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl text-white flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                    تفاصيل الاشتراك
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    احفظ هذه المعلومات في مكان آمن
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Subscription Code */}
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-blue-600/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-slate-400 text-sm">رمز الاشتراك</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(subscriptionDetails.code)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Copy className="h-4 w-4 ml-1" />
                        نسخ
                      </Button>
                    </div>
                    <p className="text-white font-mono font-bold text-2xl bg-slate-950 px-4 py-3 rounded border border-blue-600/50 text-center">
                      {subscriptionDetails.code}
                    </p>
                  </div>

                  {/* Subscription Meta Details */}
                  {subscriptionDetails.meta && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subscriptionDetails.meta.duration && (
                        <div className="bg-slate-900/50 p-4 rounded-lg">
                          <p className="text-slate-400 text-xs mb-2">مدة الاشتراك</p>
                          <p className="text-white font-semibold text-lg">{subscriptionDetails.meta.duration}</p>
                        </div>
                      )}
                      {subscriptionDetails.meta.type && (
                        <div className="bg-slate-900/50 p-4 rounded-lg">
                          <p className="text-slate-400 text-xs mb-2">نوع الاشتراك</p>
                          <p className="text-white font-semibold text-lg">{subscriptionDetails.meta.type}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order Number */}
                  {orderNumber && (
                    <div className="bg-slate-900/50 p-4 rounded-lg">
                      <p className="text-slate-400 text-xs mb-2">رقم الطلب</p>
                      <p className="text-white font-semibold">{orderNumber}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-4 flex gap-3">
                    <Button
                      onClick={() => router.push('/my-orders')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      size="lg"
                    >
                      <ExternalLink className="ml-2 h-4 w-4" />
                      عرض جميع الطلبات
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Important Note */}
              <Card className="bg-yellow-900/20 border-yellow-700">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-yellow-300 font-semibold mb-1">ملاحظة مهمة</p>
                      <p className="text-yellow-200/80 text-sm">
                        تم إرسال تفاصيل الاشتراك إلى بريدك الإلكتروني. يمكنك أيضاً مراجعة جميع طلباتك من صفحة "طلباتي".
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : submitted && !subscriptionDetails ? (
            <Card className="bg-gradient-to-br from-yellow-800/20 to-yellow-900/20 border-yellow-700">
              <CardContent className="pt-6 text-center">
                <AlertCircle className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">تم إنشاء الطلب</h2>
                <p className="text-slate-300 mb-4">
                  تم إنشاء الطلب بنجاح، لكن لم يتم تعيين الاشتراك بعد. سيتم مراجعة طلبك قريباً.
                </p>
                <Button
                  onClick={() => router.push('/my-orders')}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  عرض الطلبات
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700">
              <CardContent className="pt-6 text-center">
                <Loader2 className="h-16 w-16 animate-spin text-blue-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">جاري معالجة طلبك...</h2>
                <p className="text-slate-300">
                  يرجى الانتظار
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

