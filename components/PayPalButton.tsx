'use client';

import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface PayPalButtonProps {
  productCode: string;
  productName: string;
  price: number;
  currency?: string;
  orderDetails?: {
    name: string;
    email: string;
    whatsapp: string;
  };
  className?: string;
  onSuccess?: (orderId: string) => void;
  onError?: (error: string) => void;
}

// Internal component that uses PayPal hooks
function PayPalButtonInternal({ productCode, productName, price, currency = 'USD', orderDetails, onSuccess, onError }: Omit<PayPalButtonProps, 'className'>) {
  const router = useRouter();
  const { toast } = useToast();
  const [{ isPending }] = usePayPalScriptReducer();

  const createOrder = async () => {
    try {
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productCode,
          productName,
          price,
          currency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to create order';
        const errorDetails = data.details ? `${errorMessage}: ${data.details}` : errorMessage;
        console.error('PayPal order creation error:', {
          status: response.status,
          error: data,
        });
        throw new Error(errorDetails);
      }

      return data.orderId;
    } catch (error: any) {
      console.error('PayPal order creation error:', error);
      const errorMessage = error.message || 'فشل في إنشاء الطلب';
      toast({
        title: 'خطأ في الدفع',
        description: errorMessage.includes('Payment service not configured') 
          ? 'لم يتم تكوين PayPal. يرجى التحقق من إعدادات الخادم.'
          : errorMessage.includes('authenticate')
          ? 'فشل في المصادقة مع PayPal. تحقق من صحة بيانات الاعتماد.'
          : errorMessage,
        variant: 'destructive',
      });
      if (onError) onError(errorMessage);
      throw error;
    }
  };

  const onApprove = async (data: { orderID: string }) => {
    try {
      const response = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: data.orderID,
          orderDetails: orderDetails ? {
            ...orderDetails,
            product_code: productCode,
            product_name: productName,
            price: price,
          } : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || 'Failed to capture payment';
        const errorDetails = result.details ? `${errorMessage}: ${result.details}` : errorMessage;
        console.error('PayPal capture error:', {
          status: response.status,
          error: result,
        });
        throw new Error(errorDetails);
      }

      toast({
        title: 'نجح',
        description: 'تم الدفع بنجاح!',
      });

      if (result.order) {
        // Redirect to order confirmation page
        router.push(`/orders/${result.order.id}`);
      } else if (onSuccess) {
        onSuccess(data.orderID);
      } else {
        router.push('/my-orders');
      }
    } catch (error: any) {
      console.error('PayPal capture error:', error);
      const errorMessage = error.message || 'فشل في معالجة الدفع';
      toast({
        title: 'خطأ في الدفع',
        description: errorMessage.includes('Payment service not configured')
          ? 'لم يتم تكوين PayPal. يرجى التحقق من إعدادات الخادم.'
          : errorMessage.includes('authenticate')
          ? 'فشل في المصادقة مع PayPal. تحقق من صحة بيانات الاعتماد.'
          : errorMessage,
        variant: 'destructive',
      });
      if (onError) onError(errorMessage);
    }
  };

  const onPayPalError = (err: any) => {
    console.error('PayPal SDK error:', err);
    const errorMessage = err.message || err.details || 'حدث خطأ أثناء معالجة الدفع';
    toast({
      title: 'خطأ في الدفع',
      description: errorMessage,
      variant: 'destructive',
    });
    if (onError) onError(errorMessage);
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="mr-2 text-slate-300">جاري تحميل PayPal...</span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
      <PayPalButtons
        createOrder={createOrder}
        onApprove={onApprove}
        onError={onPayPalError}
        style={{
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
        }}
      />
    </div>
  );
}

export default function PayPalButton({ className, ...props }: PayPalButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    return (
      <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg text-yellow-400 text-center">
        PayPal غير متاح - يرجى تكوين PAYPAL_CLIENT_ID
      </div>
    );
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId: clientId,
        currency: props.currency || 'USD',
        intent: 'capture',
        locale: 'ar_SA',
      }}
    >
      <div 
        className={className}
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        <PayPalButtonInternal {...props} />
      </div>
    </PayPalScriptProvider>
  );
}

