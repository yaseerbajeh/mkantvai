'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updatePassword } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, AlertCircle, CheckCircle2, KeyRound, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Change password validation schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'يرجى إدخال كلمة المرور الحالية'),
  newPassword: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword'],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const changePasswordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/auth?redirect=/profile');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push('/auth?redirect=/profile');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleChangePassword = async (data: ChangePasswordFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    // First verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: data.currentPassword,
    });

    if (signInError) {
      setError('كلمة المرور الحالية غير صحيحة');
      setIsLoading(false);
      return;
    }

    // If current password is correct, update to new password
    const result = await updatePassword(data.newPassword);

    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    setSuccessMessage('تم تغيير كلمة المرور بنجاح!');
    changePasswordForm.reset();
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" dir="rtl">
        <Header />
        <div className="container mx-auto px-4 py-20 pt-32">
          <div className="flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-16 pt-28">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
              الملف الشخصي
            </h1>
            <p className="text-xl text-slate-300">
              إدارة إعدادات حسابك
            </p>
          </div>

          {/* User Info Card */}
          <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-slate-700/50 mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">معلومات الحساب</CardTitle>
                  <CardDescription className="text-slate-300">{user?.email}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Change Password Card */}
          <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-slate-700/50">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <KeyRound className="h-6 w-6 text-blue-500" />
                <CardTitle className="text-2xl text-white">تغيير كلمة المرور</CardTitle>
              </div>
              <CardDescription className="text-slate-300">
                قم بتغيير كلمة المرور الخاصة بك لحماية حسابك
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={changePasswordForm.handleSubmit(handleChangePassword)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-slate-200 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    كلمة المرور الحالية
                  </Label>
                  <Input
                    id="current-password"
                    type="password"
                    placeholder="••••••••"
                    {...changePasswordForm.register('currentPassword')}
                    disabled={isLoading}
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                    dir="rtl"
                  />
                  {changePasswordForm.formState.errors.currentPassword && (
                    <p className="text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {changePasswordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-slate-200 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    كلمة المرور الجديدة
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    {...changePasswordForm.register('newPassword')}
                    disabled={isLoading}
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                    dir="rtl"
                  />
                  {changePasswordForm.formState.errors.newPassword && (
                    <p className="text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {changePasswordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-200 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    تأكيد كلمة المرور الجديدة
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    {...changePasswordForm.register('confirmPassword')}
                    disabled={isLoading}
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 h-12 text-right"
                    dir="rtl"
                  />
                  {changePasswordForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {changePasswordForm.formState.errors.confirmPassword.message}
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
                      تغيير كلمة المرور
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

