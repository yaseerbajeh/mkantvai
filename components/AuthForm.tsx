'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, signUp, resetPassword, signInWithGoogle, signInWithTwitter } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

// Sign in validation schema
const signInSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

// Sign up validation schema
const signUpSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword'],
});

// Forgot password validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
});

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'twitter' | null>(null);

  // Sign in form
  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Sign up form
  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Forgot password form
  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const result = await signIn(data.email, data.password);

    if (result.error) {
      // Check for specific error types
      const errorMessage = result.error.message.toLowerCase();
      const errorCode = result.error.code?.toLowerCase() || '';
      
      // Check if it's an unverified email issue (Supabase returns 400 for email_not_confirmed)
      if (errorMessage.includes('email not confirmed') || 
          errorMessage.includes('email_not_confirmed') ||
          errorMessage.includes('verification') ||
          errorCode.includes('email_not_confirmed')) {
        setError('يرجى التحقق من بريدك الإلكتروني أولاً');
      } 
      // Check for invalid credentials (wrong password or account doesn't exist)
      // Supabase returns the same error for both cases for security reasons
      else if (errorMessage.includes('invalid login credentials') || 
               errorMessage.includes('invalid credentials') ||
               errorCode.includes('invalid_credentials') ||
               errorCode.includes('400')) {
        // Since Supabase doesn't differentiate, we'll show incorrect password
        // This is more common - user trying to sign in likely has an account
        setError('  لا يوجد حساب بهذا الإيميل أو كلمة المرور غير صحيحة');
      } 
      // Check for user not found (more specific error)
      else if (errorMessage.includes('user not found')) {
        setError('no_account');
      } else {
        setError(result.error.message);
      }
      setIsLoading(false);
      return;
    }

    setSuccessMessage('تم تسجيل الدخول بنجاح!');
    setTimeout(() => {
      router.push(redirectTo);
      router.refresh();
    }, 500);
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const result = await signUp(data.email, data.password);

    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    // Check if email confirmation is required
    if (result.data?.user && !result.data.session) {
      setSuccessMessage('تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب.');
      setIsLoading(false);
      signUpForm.reset();
    } else {
      // If no email confirmation needed, redirect to redirect URL or home
      setSuccessMessage('تم إنشاء الحساب بنجاح! يتم تسجيل الدخول...');
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 1000);
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setForgotPasswordLoading(true);
    setForgotPasswordError(null);
    setForgotPasswordSuccess(null);

    const result = await resetPassword(data.email);

    if (result.error) {
      setForgotPasswordError(result.error.message);
      setForgotPasswordLoading(false);
      return;
    }

    setForgotPasswordSuccess('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
    setForgotPasswordLoading(false);
    forgotPasswordForm.reset();
    
    // Close dialog after 3 seconds
    setTimeout(() => {
      setShowForgotPassword(false);
      setForgotPasswordSuccess(null);
    }, 3000);
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading('google');
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error.message);
      setOauthLoading(null);
    }
    // If successful, user will be redirected by OAuth flow
  };

  const handleTwitterSignIn = async () => {
    setOauthLoading('twitter');
    setError(null);
    const result = await signInWithTwitter();
    if (result.error) {
      setError(result.error.message);
      setOauthLoading(null);
    }
    // If successful, user will be redirected by OAuth flow
  };

  return (
    <Card className="w-full max-w-md bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-2 border-slate-700/50 shadow-2xl backdrop-blur-sm" dir="rtl">
      <CardHeader className="space-y-4 pb-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
            <LogIn className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
            مرحباً بك
          </CardTitle>
        </div>
        <CardDescription className="text-center text-slate-300 text-base">
          سجل الدخول أو أنشئ حساباً جديداً للمتابعة
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as 'signin' | 'signup');
          setError(null);
          setSuccessMessage(null);
        }} dir="rtl">
          <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
            <TabsTrigger 
              value="signin" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white rounded-md transition-all"
            >
              <LogIn className="h-4 w-4 ml-2" />
              تسجيل الدخول
            </TabsTrigger>
            <TabsTrigger 
              value="signup"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white rounded-md transition-all"
            >
              <UserPlus className="h-4 w-4 ml-2" />
              إنشاء حساب
            </TabsTrigger>
          </TabsList>

          {/* Sign In Tab */}
          <TabsContent value="signin" className="mt-6 space-y-5">
            {/* OAuth Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isLoading || oauthLoading !== null}
                className="h-12 border-slate-600 bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700 p-0 flex items-center justify-center transition-all"
              >
                {oauthLoading === 'google' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-600 dark:text-slate-300" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTwitterSignIn}
                disabled={isLoading || oauthLoading !== null}
                className="h-12 border-slate-600 bg-black hover:bg-gray-900 dark:bg-slate-900 dark:hover:bg-slate-800 p-0 flex items-center justify-center transition-all"
              >
                {oauthLoading === 'twitter' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                )}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-600"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800/95 px-2 text-slate-400">أو</span>
              </div>
            </div>

            <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-slate-200 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  البريد الإلكتروني
                </Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="example@email.com"
                  {...signInForm.register('email')}
                  disabled={isLoading || oauthLoading !== null}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                  dir="rtl"
                />
                {signInForm.formState.errors.email && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {signInForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password" className="text-slate-200 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  كلمة المرور
                </Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  {...signInForm.register('password')}
                  disabled={isLoading || oauthLoading !== null}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                  dir="rtl"
                />
                {signInForm.formState.errors.password && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {signInForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 p-0 h-auto"
                >
                  نسيت كلمة المرور؟
                </Button>
              </div>

              {error && error === 'no_account' && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/50">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300 flex items-center justify-between gap-4">
                    <span>لا يوجد لديك حساب يرجى التسجيل</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('signup')}
                      className="border-red-400 text-red-300 hover:bg-red-900/50"
                    >
                      التسجيل
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {error && error !== 'no_account' && (
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
                disabled={isLoading || oauthLoading !== null}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    جاري تسجيل الدخول...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 ml-2" />
                    تسجيل الدخول
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Sign Up Tab */}
          <TabsContent value="signup" className="mt-6 space-y-5">
            {/* OAuth Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isLoading || oauthLoading !== null}
                className="h-12 border-slate-600 bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700 p-0 flex items-center justify-center transition-all"
              >
                {oauthLoading === 'google' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-600 dark:text-slate-300" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTwitterSignIn}
                disabled={isLoading || oauthLoading !== null}
                className="h-12 border-slate-600 bg-black hover:bg-gray-900 dark:bg-slate-900 dark:hover:bg-slate-800 p-0 flex items-center justify-center transition-all"
              >
                {oauthLoading === 'twitter' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                )}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-600"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800/95 px-2 text-slate-400">أو</span>
              </div>
            </div>

            <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-slate-200 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  البريد الإلكتروني
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="example@email.com"
                  {...signUpForm.register('email')}
                  disabled={isLoading || oauthLoading !== null}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                  dir="rtl"
                />
                {signUpForm.formState.errors.email && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {signUpForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-slate-200 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  كلمة المرور
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  {...signUpForm.register('password')}
                  disabled={isLoading || oauthLoading !== null}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                  dir="rtl"
                />
                {signUpForm.formState.errors.password && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {signUpForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password" className="text-slate-200 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  تأكيد كلمة المرور
                </Label>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  {...signUpForm.register('confirmPassword')}
                  disabled={isLoading || oauthLoading !== null}
                  className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                  dir="rtl"
                />
                {signUpForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {signUpForm.formState.errors.confirmPassword.message}
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
                disabled={isLoading || oauthLoading !== null}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    جاري إنشاء الحساب...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 ml-2" />
                    إنشاء حساب
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-2 border-slate-700/50 text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent flex items-center gap-2">
              <KeyRound className="h-6 w-6 text-blue-400" />
              إعادة تعيين كلمة المرور
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-slate-200 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                البريد الإلكتروني
              </Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="example@email.com"
                {...forgotPasswordForm.register('email')}
                disabled={forgotPasswordLoading}
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                dir="rtl"
              />
              {forgotPasswordForm.formState.errors.email && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {forgotPasswordForm.formState.errors.email.message}
                </p>
              )}
            </div>

            {forgotPasswordError && (
              <Alert variant="destructive" className="bg-red-900/30 border-red-500/50">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300">{forgotPasswordError}</AlertDescription>
              </Alert>
            )}

            {forgotPasswordSuccess && (
              <Alert className="bg-green-900/30 border-green-500/50">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-300">{forgotPasswordSuccess}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordError(null);
                  setForgotPasswordSuccess(null);
                  forgotPasswordForm.reset();
                }}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                disabled={forgotPasswordLoading}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold"
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 ml-2" />
                    إرسال الرابط
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

