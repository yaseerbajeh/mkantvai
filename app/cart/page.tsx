'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useCart } from '@/lib/cart-context';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Minus, ShoppingBag, Tag, X, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import AuthDialog from '@/components/AuthDialog';
import { convertSarToUsd } from '@/lib/utils';

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

export default function CartPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { items, removeItem, updateQuantity, clearCart, getTotal } = useCart();
  const [user, setUser] = useState<User | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [total, setTotal] = useState(0);
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Check user authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        // Get whatsapp from user metadata if available
        setWhatsapp(session.user.user_metadata?.whatsapp || '');
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setWhatsapp(session.user.user_metadata?.whatsapp || '');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const subtotal = getTotal();
    setSubtotal(subtotal);
    
    let discountAmount = 0;
    if (appliedPromo) {
      if (appliedPromo.discount_type === 'percentage') {
        discountAmount = (subtotal * appliedPromo.discount_value) / 100;
        if (appliedPromo.max_discount_amount) {
          discountAmount = Math.min(discountAmount, appliedPromo.max_discount_amount);
        }
      } else {
        discountAmount = appliedPromo.discount_value;
      }
    }
    setDiscount(discountAmount);
    setTotal(Math.max(0, subtotal - discountAmount));
  }, [items, appliedPromo, getTotal]);

  const validateForm = () => {
    if (!user) {
      return false;
    }
    // WhatsApp is optional but recommended
    return true;
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoError('يرجى إدخال رمز الخصم');
      return;
    }

    setPromoLoading(true);
    setPromoError('');

    try {
      const response = await fetch(`/api/promo-codes/validate?code=${encodeURIComponent(promoCode)}&amount=${subtotal}`);
      const data = await response.json();

      if (!response.ok) {
        setPromoError(data.error || 'رمز الخصم غير صحيح');
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo(data.promoCode);
      toast({
        title: 'تم التطبيق',
        description: 'تم تطبيق رمز الخصم بنجاح',
      });
    } catch (error) {
      setPromoError('حدث خطأ أثناء التحقق من رمز الخصم');
      setAppliedPromo(null);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  };

  const createOrder = async () => {
    if (!user) {
      setAuthDialogOpen(true);
      throw new Error('User not authenticated');
    }

    if (!validateForm()) {
      toast({
        title: 'خطأ',
        description: 'يرجى تسجيل الدخول',
        variant: 'destructive',
      });
      throw new Error('Form validation failed');
    }

    setCreatingOrder(true);

    try {
      // Convert total from SAR to USD for PayPal
      const totalUsd = convertSarToUsd(total);
      
      const response = await fetch('/api/orders/create-cart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          customerInfo: {
            name: user.user_metadata?.full_name || user.email || '',
            email: user.email || '',
            whatsapp: whatsapp || '',
          },
          promoCodeId: appliedPromo?.id || null,
          discountAmount: discount,
          totalAmount: total, // Keep SAR amount for database
          totalAmountUsd: totalUsd, // Send USD amount for PayPal
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to create order:', data);
        const errorMessage = data.error || data.details || 'فشل إنشاء الطلب';
        throw new Error(errorMessage);
      }

      // Check if this is a free order (100% discount)
      if (data.isFreeOrder || total === 0 || total <= 0.01) {
        // Free order - already completed by backend
        clearCart();
        toast({
          title: 'تم الطلب بنجاح',
          description: 'تم إتمام الطلب بنجاح! سيتم إرسال تفاصيل الاشتراك إلى بريدك الإلكتروني',
        });
        router.push(`/my-orders`);
        return null; // No PayPal order ID for free orders
      }

      // Verify we have a PayPal order ID for paid orders
      if (!data.orderId) {
        console.error('No orderId returned from API:', data);
        throw new Error('فشل في الحصول على معرف الطلب من PayPal. يرجى التحقق من إعدادات PayPal.');
      }

      // Verify PayPal order ID format (should not be a UUID)
      // PayPal order IDs are typically longer strings like "5O190127TN364715T"
      if (data.orderId.length < 10 || data.orderId.includes('-')) {
        console.error('Invalid PayPal order ID format:', data.orderId);
        throw new Error('معرف طلب PayPal غير صحيح. يرجى التحقق من إعدادات PayPal.');
      }

      // Log for debugging
      console.log('PayPal order created successfully:', data.orderId);

      return data.orderId; // This should be the PayPal order ID
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إنشاء الطلب',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setCreatingOrder(false);
    }
  };

  const onApprove = async (data: any) => {
    try {
      const response = await fetch('/api/orders/approve-cart-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: data.orderID,
          payerID: data.payerID,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في معالجة الدفع');
      }

      clearCart();
      toast({
        title: 'نجح الدفع',
        description: 'تم الدفع بنجاح! سيتم توجيهك إلى صفحة الطلب',
      });
      
      router.push(`/my-orders`);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء معالجة الدفع',
        variant: 'destructive',
      });
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <main className="container mx-auto px-4 py-24 pt-32">
          <Card className="bg-slate-800/50 border-slate-700 max-w-2xl mx-auto text-center py-12">
            <ShoppingBag className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">السلة فارغة</h2>
            <p className="text-slate-400 mb-6">لم تقم بإضافة أي منتجات إلى السلة بعد</p>
            <Button onClick={() => router.push('/subscribe')} className="bg-blue-600 hover:bg-blue-700">
              تصفح المنتجات
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">السلة</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <Card key={item.product_code} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{item.product_name}</h3>
                        <p className="text-slate-400">{item.price} ريال</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product_code, item.quantity - 1)}
                          className="border-slate-600 text-white hover:bg-slate-700"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-white w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.product_code, item.quantity + 1)}
                          className="border-slate-600 text-white hover:bg-slate-700"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.product_code)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-right">
                      <p className="text-white font-semibold">
                        المجموع: {item.price * item.quantity} ريال
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Checkout Section */}
            <div className="space-y-6">
              {/* User Info Display */}
              {user ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">معلومات العميل</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-slate-700/50 p-3 rounded border border-slate-600">
                      <p className="text-xs text-slate-400 mb-1">الاسم</p>
                      <p className="text-white font-medium">{user.user_metadata?.full_name || user.email || '-'}</p>
                    </div>
                    <div className="bg-slate-700/50 p-3 rounded border border-slate-600">
                      <p className="text-xs text-slate-400 mb-1">البريد الإلكتروني</p>
                      <p className="text-white font-medium">{user.email || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">رقم الواتساب (اختياري)</label>
                      <Input
                        placeholder="966xxxxxxxxx"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white"
                        dir="ltr"
                      />
                      <p className="text-xs text-slate-500 mt-1">مطلوب للتواصل بشأن الطلب</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">تسجيل الدخول مطلوب</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-300 mb-4">يرجى تسجيل الدخول لإتمام الطلب</p>
                    <Button
                      onClick={() => setAuthDialogOpen(true)}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      تسجيل الدخول / إنشاء حساب
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Promo Code */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    رمز الخصم
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!appliedPromo ? (
                    <>
                      <div className="flex gap-2">
                        <Input
                          placeholder="أدخل رمز الخصم"
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value);
                            setPromoError('');
                          }}
                          className="bg-slate-700 border-slate-600 text-white"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleApplyPromo();
                            }
                          }}
                        />
                        <Button 
                          onClick={handleApplyPromo} 
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={promoLoading}
                        >
                          {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تطبيق'}
                        </Button>
                      </div>
                      {promoError && (
                        <p className="text-red-400 text-sm">{promoError}</p>
                      )}
                    </>
                  ) : (
                    <div className="bg-green-900/30 border border-green-700 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                          <span className="text-green-300 font-semibold">{appliedPromo.code}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePromo}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-green-200 text-sm mt-2">
                        خصم: {appliedPromo.discount_type === 'percentage' 
                          ? `${appliedPromo.discount_value}%` 
                          : `${appliedPromo.discount_value} ريال`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Summary */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">ملخص الطلب</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-slate-300">
                    <span>المجموع الفرعي</span>
                    <span>{subtotal.toFixed(2)} ريال</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>الخصم</span>
                      <span>-{discount.toFixed(2)} ريال</span>
                    </div>
                  )}
                  <div className="border-t border-slate-700 pt-3 flex justify-between text-white font-bold text-lg">
                    <span>المجموع</span>
                    <div className="text-right">
                      {total === 0 || total <= 0.01 ? (
                        <div className="text-green-400">
                          <div>مجاناً</div>
                          <div className="text-sm text-green-300 font-normal mt-1">
                            رمز خصم 100% مطبق
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>{total.toFixed(2)} ريال</div>
                          <div className="text-sm text-slate-400 font-normal mt-1">
                            ما يساوي ${convertSarToUsd(total).toFixed(2)} دولار أمريكي
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Free Order Button (100% discount) */}
              {user && validateForm() && (total === 0 || total <= 0.01) && (
                <Button
                  onClick={async () => {
                    try {
                      await createOrder();
                      // createOrder already handles navigation and toast for free orders
                    } catch (error) {
                      // Error already handled in createOrder
                    }
                  }}
                  disabled={creatingOrder}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg font-semibold"
                >
                  {creatingOrder ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin ml-2" />
                      جاري المعالجة...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 ml-2" />
                      إتمام الطلب مجاناً
                    </>
                  )}
                </Button>
              )}

              {/* PayPal Checkout (for paid orders) */}
              {user && validateForm() && PAYPAL_CLIENT_ID && total > 0.01 && (
                <PayPalScriptProvider
                  options={{
                    clientId: PAYPAL_CLIENT_ID,
                    currency: 'USD',
                  }}
                >
                  <PayPalButtons
                    createOrder={async (data, actions) => {
                      try {
                        const orderId = await createOrder();
                        // Verify the orderId is a valid PayPal order ID format
                        if (!orderId || typeof orderId !== 'string') {
                          throw new Error('Invalid PayPal order ID received');
                        }
                        console.log('Returning PayPal order ID to SDK:', orderId);
                        return orderId;
                      } catch (error: any) {
                        console.error('PayPal createOrder error:', error);
                        toast({
                          title: 'خطأ في إنشاء الطلب',
                          description: error.message || 'حدث خطأ أثناء إنشاء طلب PayPal',
                          variant: 'destructive',
                        });
                        // Return empty string to prevent PayPal from proceeding
                        return '';
                      }
                    }}
                    onApprove={onApprove}
                    onError={(err) => {
                      console.error('PayPal Buttons onError:', err);
                      toast({
                        title: 'خطأ في الدفع',
                        description: 'حدث خطأ أثناء معالجة الدفع',
                        variant: 'destructive',
                      });
                    }}
                    onCancel={(data) => {
                      console.log('PayPal payment cancelled:', data);
                    }}
                    style={{
                      layout: 'vertical',
                      color: 'blue',
                      shape: 'rect',
                      label: 'paypal',
                    }}
                  />
                </PayPalScriptProvider>
              )}
              
              {!user && (
                <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg text-center">
                  <p className="text-yellow-400 text-sm">يرجى تسجيل الدخول لإتمام الطلب</p>
                </div>
              )}
              
              {user && validateForm() && !PAYPAL_CLIENT_ID && total > 0.01 && (
                <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-center">
                  <p className="text-red-400 text-sm">خطأ في إعدادات PayPal. يرجى الاتصال بالدعم</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      
      {/* Auth Dialog */}
      <AuthDialog 
        open={authDialogOpen} 
        onOpenChange={setAuthDialogOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

