'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updatePassword } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, AlertCircle, CheckCircle2, KeyRound, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Create a separate Supabase client for reset password page that doesn't auto-detect sessions
// This prevents auto-login when recovery tokens are in the URL
const supabaseReset = typeof window !== 'undefined' ? createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // Disable auto-detection for recovery tokens
      storage: window.localStorage,
    },
  }
) : null;

// Password reset validation schema
const resetPasswordSchema = z.object({
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // Handle password recovery from email link
    const handleRecovery = async () => {
      // First, check URL hash for recovery token (Supabase uses hash fragments)
      // We need to handle this BEFORE Supabase auto-processes it
      const hash = window.location.hash;
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        if (accessToken && type === 'recovery') {
          // Immediately clear the hash to prevent Supabase from auto-processing
          window.history.replaceState(null, '', window.location.pathname);
          
          // Set the session using the recovery tokens manually
          // This creates a temporary session that allows password reset only
          const { error: sessionError } = await supabaseReset?.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          }) || { error: new Error('Supabase client not initialized') };
          
          if (sessionError) {
            setIsValidToken(false);
            setError('رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية');
            return;
          }
          
          setIsValidToken(true);
          return;
        }
      }
      
      // Check URL search params (for callback route redirects)
      const urlParams = new URLSearchParams(window.location.search);
      const recoveryType = urlParams.get('type');
      
      // Check if there's already a valid session
      const { data: { session } } = await supabaseReset?.auth.getSession() || { data: { session: null } };
      
      if (session) {
        // If we have type=recovery in URL, this is from callback route
        if (recoveryType === 'recovery') {
          setIsValidToken(true);
          // Clear the query params
          window.history.replaceState(null, '', window.location.pathname);
        } else {
          // Session exists but no recovery indicator
          // Check if we're on the reset password page - if so, show form
          // This handles the case where user might already be logged in
          setIsValidToken(true);
        }
      } else {
        // No session and no recovery token - invalid
        setIsValidToken(false);
        setError('رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية');
      }
    };

    // Run immediately to catch hash before Supabase processes it
    handleRecovery();
  }, []);

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Verify we have a session
    const { data: { session } } = await supabaseReset?.auth.getSession() || { data: { session: null } };
    if (!session) {
      setError('انتهت صلاحية رابط إعادة التعيين. يرجى طلب رابط جديد');
      setIsLoading(false);
      return;
    }

    const result = await updatePassword(data.password);

    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    setSuccessMessage('تم تغيير كلمة المرور بنجاح! يتم تسجيل الدخول...');
    
    // Wait a moment then redirect
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 2000);
  };

  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="relative z-10 w-full max-w-md">
          <Link href="/" className="flex flex-col items-center gap-4 mb-10 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <Image 
                src="/logos/logo.png" 
                alt="Logo" 
                width={100} 
                height={100}
                className="rounded-lg relative z-10 shadow-2xl group-hover:scale-105 transition-transform"
                priority
              />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
              مكان TV
            </span>
          </Link>

          <Card className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-2 border-red-500/50 shadow-2xl backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-center gap-3 mb-2">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <CardTitle className="text-2xl text-white">رابط غير صالح</CardTitle>
              </div>
              <CardDescription className="text-center text-slate-300">
                رابط إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/50">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300">
                    يرجى طلب رابط جديد لإعادة تعيين كلمة المرور
                  </AlertDescription>
                </Alert>
                <Link href="/auth" className="block">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold">
                    العودة إلى صفحة تسجيل الدخول
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4" dir="rtl">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 -left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand */}
        <Link href="/" className="flex flex-col items-center gap-4 mb-10 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <Image 
              src="/logos/logo.png" 
              alt="Logo" 
              width={100} 
              height={100}
              className="rounded-lg relative z-10 shadow-2xl group-hover:scale-105 transition-transform"
              priority
            />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
            مكان TV
          </span>
        </Link>

        {/* Reset Password Card */}
        <Card className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-2 border-slate-700/50 shadow-2xl backdrop-blur-sm">
          <CardHeader className="space-y-4 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                <KeyRound className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
                إعادة تعيين كلمة المرور
              </CardTitle>
            </div>
            <CardDescription className="text-center text-slate-300 text-base">
              أدخل كلمة المرور الجديدة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="reset-password" className="text-slate-200 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  كلمة المرور الجديدة
                </Label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="••••••••"
                  {...resetPasswordForm.register('password')}
                  disabled={isLoading}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                  dir="rtl"
                />
                {resetPasswordForm.formState.errors.password && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {resetPasswordForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password" className="text-slate-200 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  تأكيد كلمة المرور
                </Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  {...resetPasswordForm.register('confirmPassword')}
                  disabled={isLoading}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                  dir="rtl"
                />
                {resetPasswordForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {resetPasswordForm.formState.errors.confirmPassword.message}
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
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold h-12 text-lg shadow-lg" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    جاري التحديث...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-5 w-5 ml-2" />
                    تحديث كلمة المرور
                  </>
                )}
              </Button>
            </form>

            {/* Back to login link */}
            <Link 
              href="/auth" 
              className="mt-6 flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group"
            >
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              العودة إلى تسجيل الدخول
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

