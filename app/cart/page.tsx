'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useCart } from '@/lib/cart-context';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Plus, Minus, ShoppingBag, Tag, X, CheckCircle2, Loader2, MessageCircle, HelpCircle } from 'lucide-react';
import Image from 'next/image';
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
  const [whatsappConfirm, setWhatsappConfirm] = useState('');
  const [confirmingPhone, setConfirmingPhone] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [total, setTotal] = useState(0);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);

  // Add styles to ensure dialog appears above PayPal
  useEffect(() => {
    if (helpDialogOpen) {
      const style = document.createElement('style');
      style.id = 'help-dialog-z-index-fix';
      style.textContent = `
        [data-radix-dialog-overlay] {
          z-index: 99998 !important;
        }
        [data-radix-dialog-content] {
          z-index: 99999 !important;
        }
        div[id*="paypal"],
        div[class*="paypal"],
        iframe[src*="paypal"],
        [id*="zoid-paypal"] {
          z-index: 1 !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
      return () => {
        const existingStyle = document.getElementById('help-dialog-z-index-fix');
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }
  }, [helpDialogOpen]);

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

  const handleConfirmPhone = async () => {
    if (!user) {
      toast({
        title: 'خطأ',
        description: 'يرجى تسجيل الدخول أولاً',
        variant: 'destructive',
      });
      setAuthDialogOpen(true);
      return;
    }

    if (!whatsappConfirm.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رقم الواتساب',
        variant: 'destructive',
      });
      return;
    }

    setConfirmingPhone(true);

    try {
      // Format phone number: remove any non-digits, remove leading zeros
      const cleaned = whatsappConfirm.replace(/\D/g, '').replace(/^0+/, '');
      
      // Validate: must be exactly 9 digits
      if (cleaned.length !== 9) {
        toast({
          title: 'خطأ',
          description: 'يجب أن يتكون الرقم من 9 أرقام فقط. مثال: 542668201',
          variant: 'destructive',
        });
        setConfirmingPhone(false);
        return;
      }

      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('غير مصرح. يرجى تسجيل الدخول');
      }

      const response = await fetch('/api/user/phone', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone: cleaned }), // Send just the 9 digits, API will add 966 prefix
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشل حفظ رقم الهاتف');
      }

      // Update local state with formatted number (with 966 prefix for display)
      setWhatsapp(`966${cleaned}`);

      toast({
        title: 'نجح',
        description: 'تم حفظ رقم الهاتف بنجاح',
      });
    } catch (error: any) {
      console.error('Error confirming phone:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء حفظ رقم الهاتف',
        variant: 'destructive',
      });
    } finally {
      setConfirmingPhone(false);
    }
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
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 md:mb-6">السلة</h1>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {/* Cart Items */}
            <div className="col-span-1 lg:col-span-2 space-y-3 md:space-y-4 order-2 lg:order-1">
              {items.map((item) => (
                <Card key={item.product_code} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-2 md:p-4">
                    <div className="flex items-center gap-2 md:gap-4">
                      {/* Product Image */}
                      {item.image && (
                        <div className="relative w-16 h-16 md:w-24 md:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-700">
                          <Image
                            src={item.image}
                            alt={item.product_name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 64px, 96px"
                          />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col gap-1 md:flex-row md:items-center md:justify-between min-w-0">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm md:text-lg font-semibold text-white truncate">{item.product_name}</h3>
                          <p className="text-xs md:text-base text-slate-400">{item.price} ريال</p>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.product_code, item.quantity - 1)}
                            className="border-slate-600 bg-white text-black hover:bg-slate-200 h-7 w-7 md:h-9 md:w-9 p-0"
                          >
                            <Minus className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                          <span className="text-white w-6 md:w-8 text-center text-xs md:text-base">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.product_code, item.quantity + 1)}
                            className="border-slate-600 bg-white text-black hover:bg-slate-200 h-7 w-7 md:h-9 md:w-9 p-0"
                          >
                            <Plus className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.product_code)}
                            className="text-red-400 hover:text-red-300 h-7 w-7 md:h-9 md:w-9 p-0"
                          >
                            <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 md:mt-2 text-right">
                      <p className="text-white font-semibold text-xs md:text-base">
                        المجموع: {item.price * item.quantity} ريال
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Checkout Section */}
            <div className="space-y-3 md:space-y-6 order-1 lg:order-2">
              {/* User Info Display */}
              {user ? (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="p-3 md:p-6">
                    <CardTitle className="text-white text-sm md:text-base">معلومات العميل</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 md:space-y-4 p-3 md:p-6 pt-0">
                    <div className="bg-slate-700/50 p-2 md:p-3 rounded border border-slate-600">
                      <p className="text-xs text-slate-400 mb-1">الاسم</p>
                      <p className="text-white font-medium text-xs md:text-sm truncate">{user.user_metadata?.full_name || user.email || '-'}</p>
                    </div>
                    <div className="bg-slate-700/50 p-2 md:p-3 rounded border border-slate-600">
                      <p className="text-xs text-slate-400 mb-1">البريد الإلكتروني</p>
                      <p className="text-white font-medium text-xs md:text-sm truncate">{user.email || '-'}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="p-3 md:p-6">
                    <CardTitle className="text-white text-sm md:text-base">تسجيل الدخول لإتمام الطلب</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 md:p-6 pt-0">
                    <p className="text-slate-300 mb-3 md:mb-4 text-xs md:text-sm">يرجى تسجيل الدخول لإتمام عملية الدفع</p>
                    <Button
                      onClick={() => setAuthDialogOpen(true)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-xs md:text-base py-2 md:py-3"
                    >
                      تسجيل الدخول / إنشاء حساب
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* WhatsApp Collection Card */}
              {items.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader className="p-3 md:p-6">
                    <CardTitle className="text-white text-sm md:text-base">رقم الواتساب</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 md:space-y-3 p-3 md:p-6 pt-0">
                    <p className="text-xs md:text-sm text-slate-300">اكتب رقمك الواتس للتواصل معك بعد الشراء</p>
                    <p className="text-xs text-slate-400">اكتب رقمك بدون الصفر. مثال 542668201</p>
                    <div className="flex gap-1.5 md:gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute right-2 md:right-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs md:text-sm">966</span>
                        <Input
                          placeholder="542668201"
                          value={whatsappConfirm.replace(/^966/, '')}
                          onChange={(e) => {
                            // Remove any non-digit characters and leading zeros, limit to 9 digits
                            const cleaned = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
                            setWhatsappConfirm(cleaned);
                          }}
                          maxLength={9}
                          className="bg-slate-700 border-slate-600 text-white pr-10 md:pr-12 text-xs md:text-sm h-8 md:h-10"
                          dir="ltr"
                          disabled={confirmingPhone || !user}
                        />
                      </div>
                      <Button
                        onClick={handleConfirmPhone}
                        disabled={confirmingPhone || !user || !whatsappConfirm.trim() || whatsappConfirm.replace(/\D/g, '').length !== 9}
                        className="bg-blue-600 hover:bg-blue-700 text-xs md:text-sm px-2 md:px-4 h-8 md:h-10"
                      >
                        {confirmingPhone ? (
                          <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                        ) : (
                          'تأكيد'
                        )}
                      </Button>
                    </div>
                    {!user && (
                      <p className="text-xs text-slate-400">يرجى تسجيل الدخول أولاً</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Promo Code */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="p-3 md:p-6">
                  <CardTitle className="text-white text-sm md:text-base flex items-center gap-1.5 md:gap-2">
                    <Tag className="h-4 w-4 md:h-5 md:w-5" />
                    رمز الخصم
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 md:space-y-3 p-3 md:p-6 pt-0">
                  {!appliedPromo ? (
                    <>
                      <div className="flex gap-1.5 md:gap-2">
                        <Input
                          placeholder="أدخل رمز الخصم"
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value);
                            setPromoError('');
                          }}
                          className="bg-slate-700 border-slate-600 text-white text-xs md:text-sm h-8 md:h-10"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleApplyPromo();
                            }
                          }}
                        />
                        <Button 
                          onClick={handleApplyPromo} 
                          className="bg-blue-600 hover:bg-blue-700 text-xs md:text-sm px-2 md:px-4 h-8 md:h-10"
                          disabled={promoLoading}
                        >
                          {promoLoading ? <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" /> : 'تطبيق'}
                        </Button>
                      </div>
                      {promoError && (
                        <p className="text-red-400 text-xs md:text-sm">{promoError}</p>
                      )}
                    </>
                  ) : (
                    <div className="bg-green-900/30 border border-green-700 rounded p-2 md:p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 md:gap-2">
                          <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-400" />
                          <span className="text-green-300 font-semibold text-xs md:text-sm">{appliedPromo.code}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePromo}
                          className="text-red-400 hover:text-red-300 h-6 w-6 md:h-8 md:w-8 p-0"
                        >
                          <X className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                      </div>
                      <p className="text-green-200 text-xs md:text-sm mt-1 md:mt-2">
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
                <CardHeader className="p-3 md:p-6">
                  <CardTitle className="text-white text-sm md:text-base">ملخص الطلب</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 md:space-y-3 p-3 md:p-6 pt-0">
                  <div className="flex justify-between text-slate-300 text-xs md:text-sm">
                    <span>المجموع الفرعي</span>
                    <span>{subtotal.toFixed(2)} ريال</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-400 text-xs md:text-sm">
                      <span>الخصم</span>
                      <span>-{discount.toFixed(2)} ريال</span>
                    </div>
                  )}
                  <div className="border-t border-slate-700 pt-2 md:pt-3 flex justify-between text-white font-bold text-sm md:text-lg">
                    <span>المجموع</span>
                    <div className="text-right">
                      {total === 0 || total <= 0.01 ? (
                        <div className="text-green-400">
                          <div className="text-xs md:text-base">مجاناً</div>
                          <div className="text-xs md:text-sm text-green-300 font-normal mt-1">
                            رمز خصم 100% مطبق
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs md:text-base">{total.toFixed(2)} ريال</div>
                          <div className="text-xs md:text-sm text-slate-400 font-normal mt-1">
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
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 md:py-6 text-sm md:text-lg font-semibold"
                >
                  {creatingOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin ml-2" />
                      جاري المعالجة...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 ml-2" />
                      إتمام الطلب مجاناً
                    </>
                  )}
                </Button>
              )}

              {/* PayPal Checkout (for paid orders) */}
              {!user && PAYPAL_CLIENT_ID && total > 0.01 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-3 md:p-6 pt-3 md:pt-6">
                    <p className="text-slate-300 mb-3 md:mb-4 text-center text-xs md:text-sm">يرجى تسجيل الدخول لإتمام عملية الدفع</p>
                    <Button
                      onClick={() => setAuthDialogOpen(true)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-xs md:text-base py-2 md:py-3"
                    >
                      تسجيل الدخول / إنشاء حساب
                    </Button>
                  </CardContent>
                </Card>
              )}
              {user && validateForm() && PAYPAL_CLIENT_ID && total > 0.01 && (
                <div dir="rtl" className="paypal-rtl-wrapper scale-90 md:scale-100 origin-top">
                  <PayPalScriptProvider
                    options={{
                      clientId: PAYPAL_CLIENT_ID,
                      currency: 'USD',
                      locale: 'en_SA',
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
                </div>
              )}

              {/* Help Button */}
              {user && validateForm() && PAYPAL_CLIENT_ID && total > 0.01 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHelpDialogOpen(true)}
                  className="w-full mt-2 md:mt-3 border-slate-600 text-black hover:bg-slate-700 hover:text-white text-xs md:text-sm py-2 md:py-3"
                >
                  <HelpCircle className="h-3 w-3 md:h-4 md:w-4 ml-2" />
                  ماعرفت تدفع؟
                </Button>
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

      {/* Payment Help Dialog */}
      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent 
          className="bg-slate-800 border-slate-700 max-w-3xl max-h-[90vh] overflow-y-auto" 
          style={{ zIndex: 99999 }}
        >
          <DialogHeader>
            <DialogTitle className="text-white text-xl">تعليمات الدفع</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {/* Payment Instructions Image */}
            <div className="flex justify-center">
              <img 
                src="https://l.top4top.io/p_3608pvaoj1.jpg" 
                alt="Payment Instructions" 
                className="max-w-full h-auto rounded-lg shadow-lg"
              />
            </div>
            
            {/* Go Back and Complete Payment Button */}
            <Button
              onClick={() => setHelpDialogOpen(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              size="lg"
            >
              ارجع وأكمل الدفع
            </Button>
            
            {/* WhatsApp Contact Button */}
            <Button
              onClick={() => {
                const whatsappNumber = '966542668201';
                const message = encodeURIComponent('مرحباً، أحتاج مساعدة في الدفع');
                window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              <MessageCircle className="h-5 w-5 ml-2" />
              باقي ماعرفت ؟ كلمنا واتس اب
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

