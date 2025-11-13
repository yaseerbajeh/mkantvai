'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, signUp, signInWithGoogle } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, UserPlus, LogIn, User } from 'lucide-react';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AuthDialog({ open, onOpenChange, onSuccess }: AuthDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null);
  const [signInData, setSignInData] = useState({ email: '', password: '' });
  const [signUpData, setSignUpData] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInData.email || !signInData.password) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await signIn(signInData.email, signInData.password);

    if (result.error) {
      toast({
        title: 'خطأ',
        description: result.error.message || 'فشل تسجيل الدخول',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'نجح',
      description: 'تم تسجيل الدخول بنجاح',
    });

    setIsLoading(false);
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    } else {
      router.refresh();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpData.name || !signUpData.email || !signUpData.password || !signUpData.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول',
        variant: 'destructive',
      });
      return;
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: 'خطأ',
        description: 'كلمات المرور غير متطابقة',
        variant: 'destructive',
      });
      return;
    }

    if (signUpData.password.length < 6) {
      toast({
        title: 'خطأ',
        description: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await signUp(signUpData.email, signUpData.password, signUpData.name);

    if (result.error) {
      toast({
        title: 'خطأ',
        description: result.error.message || 'فشل إنشاء الحساب',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'نجح',
      description: 'تم إنشاء الحساب بنجاح!',
    });

    setIsLoading(false);
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    } else {
      router.refresh();
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading('google');
    const result = await signInWithGoogle();
    if (result.error) {
      toast({
        title: 'خطأ',
        description: result.error.message || 'فشل تسجيل الدخول مع Google',
        variant: 'destructive',
      });
      setOauthLoading(null);
    }
    // If successful, user will be redirected by OAuth flow
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">تسجيل الدخول أو إنشاء حساب</DialogTitle>
          <DialogDescription className="text-slate-300">
            يرجى تسجيل الدخول أو إنشاء حساب للمتابعة
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-700">
            <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
            <TabsTrigger value="signup">إنشاء حساب</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-4 mt-4">
            {/* OAuth Buttons */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={isLoading || oauthLoading !== null}
              className="w-full h-10 border-slate-600 bg-white hover:bg-gray-50 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center gap-3 transition-all"
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-300" />
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
                  <span className="text-slate-700 dark:text-slate-200 font-medium text-sm">سجل دخول باستخدام جوجل</span>
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-600"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-2 text-slate-400">أو</span>
              </div>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">البريد الإلكتروني</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={signInData.email}
                  onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="example@email.com"
                  dir="rtl"
                  disabled={isLoading || oauthLoading !== null}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">كلمة المرور</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={signInData.password}
                  onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="••••••••"
                  disabled={isLoading || oauthLoading !== null}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading || oauthLoading !== null}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                تسجيل الدخول
              </Button>

              <div className="text-center pt-2 flex flex-col items-center justify-center gap-1">
                <span className="text-slate-400 text-sm">ماعندك حساب؟</span>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setActiveTab('signup')}
                  className="text-sm text-blue-400 hover:text-blue-300 p-0 h-auto font-semibold"
                >
                  سجل
                </Button>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="signup" className="space-y-4 mt-4">
            {/* OAuth Buttons */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={isLoading || oauthLoading !== null}
              className="w-full h-10 border-slate-600 bg-white hover:bg-gray-50 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center gap-3 transition-all"
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-300" />
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
                  <span className="text-slate-700 dark:text-slate-200 font-medium text-sm">سجل دخول باستخدام جوجل</span>
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-600"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-800 px-2 text-slate-400">أو</span>
              </div>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">الاسم</Label>
                <Input
                  id="signup-name"
                  type="text"
                  value={signUpData.name}
                  onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="أدخل اسمك"
                  dir="rtl"
                  disabled={isLoading || oauthLoading !== null}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signUpData.email}
                  onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="example@email.com"
                  dir="rtl"
                  disabled={isLoading || oauthLoading !== null}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">كلمة المرور</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signUpData.password}
                  onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="••••••••"
                  disabled={isLoading || oauthLoading !== null}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm">تأكيد كلمة المرور</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  value={signUpData.confirmPassword}
                  onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white"
                  placeholder="••••••••"
                  disabled={isLoading || oauthLoading !== null}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={isLoading || oauthLoading !== null}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                إنشاء حساب
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

