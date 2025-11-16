'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithOtp, verifyOtp } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, LogIn, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

// OTP validation schema - OTP is optional, only validated when provided
const otpSchema = z.object({
  email: z.string().min(1, 'يرجى إدخال البريد الإلكتروني').email('البريد الإلكتروني غير صالح'),
  otp: z.union([
    z.literal(''), // Allow empty string
    z.string().min(6, 'رمز التحقق يجب أن يكون 6 أحرف على الأقل')
  ]).optional(),
});

type OtpFormData = z.infer<typeof otpSchema>;

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [emailForOtp, setEmailForOtp] = useState('');

  const form = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    mode: 'onSubmit',
    defaultValues: {
      email: '',
      otp: '',
    },
  });

  const handleSendOtp = async (email: string) => {
    setSendingOtp(true);
    setError(null);
    setSuccessMessage(null);

    const result = await signInWithOtp(email);

    if (result.error) {
      setError(result.error.message);
      setSendingOtp(false);
      return;
    }

    setOtpSent(true);
    setEmailForOtp(email);
    setSuccessMessage('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
    setSendingOtp(false);
  };

  const handleVerifyOtp = async (otp: string) => {
    setVerifyingOtp(true);
    setError(null);
    setSuccessMessage(null);

    const result = await verifyOtp(emailForOtp, otp, 'email');

    if (result.error) {
      setError(result.error.message);
      setVerifyingOtp(false);
      return;
    }

    setSuccessMessage('تم تسجيل الدخول بنجاح!');
    setVerifyingOtp(false);
    setTimeout(() => {
      router.push(redirectTo);
      router.refresh();
    }, 1000);
  };

  const handleSubmit = async (data: OtpFormData) => {
    if (!otpSent) {
      if (!data.email || !data.email.trim()) {
        form.setError('email', { message: 'يرجى إدخال البريد الإلكتروني' });
        return;
      }
      await handleSendOtp(data.email);
      return;
    }

    if (!data.otp || !data.otp.trim() || data.otp.length < 6) {
      form.setError('otp', { message: 'يرجى إدخال رمز التحقق المكون من 6 أرقام' });
      return;
    }

    await handleVerifyOtp(data.otp);
  };

  const handleSendNewOtp = async () => {
    setOtpSent(false);
    setError(null);
    setSuccessMessage(null);
    form.reset();
    // Automatically resend if we have the email
    if (emailForOtp) {
      await handleSendOtp(emailForOtp);
    }
  };

  return (
    <Card className="w-full max-w-md bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-2 border-slate-700/50 shadow-2xl backdrop-blur-sm" dir="rtl">
      <CardHeader className="space-y-4 pb-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
            <LogIn className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
            تسجيل الدخول
          </CardTitle>
        </div>
        <CardDescription className="text-center text-slate-300 text-base">
          سجل الدخول للمتابعة
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {!otpSent ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  {...form.register('email')}
                  disabled={sendingOtp}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                  dir="rtl"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/50">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              {successMessage && (
                <Alert className="bg-green-900/30 border-green-500/50">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <AlertDescription className="text-green-300">{successMessage}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                onClick={(e) => {
                  // Prevent double submission but allow form to validate and submit
                  if (sendingOtp) {
                    e.preventDefault();
                    return;
                  }
                  // Let the form handle submission naturally
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold h-12 text-lg shadow-lg" 
                disabled={sendingOtp}
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5 ml-2" />
                    إرسال رمز التحقق
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-slate-200 flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  رمز التحقق
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="أدخل رمز التحقق المكون من 6 أرقام"
                  {...form.register('otp')}
                  disabled={verifyingOtp}
                  maxLength={6}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-center text-lg tracking-widest"
                  dir="ltr"
                />
                {form.formState.errors.otp && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {form.formState.errors.otp.message}
                  </p>
                )}
                <p className="text-xs text-slate-400 text-center">
                  تم إرسال رمز التحقق إلى {emailForOtp}
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/50">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              {successMessage && (
                <Alert className="bg-green-900/30 border-green-500/50">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <AlertDescription className="text-green-300">{successMessage}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold h-12 text-lg shadow-lg" 
                disabled={verifyingOtp}
              >
                {verifyingOtp ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    جاري التحقق...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 ml-2" />
                    تحقق من الرمز
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <Button
                  type="button"
                  variant="link"
                  onClick={handleSendNewOtp}
                  className="text-sm text-blue-400 hover:text-blue-300 p-0 h-auto"
                  disabled={sendingOtp}
                >
                  إرسال رمز جديد
                </Button>
              </div>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
