'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { Sparkles, Clock, AlertCircle, CheckCircle2, Loader2, Copy, ArrowRight, LogIn, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

function TrialPageContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trialCode, setTrialCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        setLoading(false);
        // Don't redirect, just show the message
      } else {
        setUser(session.user);
        // Check if user already has a trial code
        checkExistingTrial(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setLoading(false);
      } else {
        setUser(session.user);
        if (session.user) {
          checkExistingTrial(session.user.id);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const checkExistingTrial = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/trial', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (response.ok && result.trial_code) {
        setTrialCode(result.trial_code);
        setExpiresAt(result.expires_at);
        setUsername(result.username || null);
        setPassword(result.password || null);
        setLink(result.link || null);
      }
    } catch (error) {
      console.error('Error checking existing trial:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrialCode = async () => {
    if (!user) {
      setError('يجب تسجيل الدخول أولاً');
      return;
    }

    setFetching(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('يجب تسجيل الدخول أولاً');
        setFetching(false);
        return;
      }

      const response = await fetch('/api/trial', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error messages
        if (result.error === 'لا يوجد تجارب حاليا, جرب في وقت لاحق') {
          setError('لا يوجد تجارب حاليا, جرب في وقت لاحق');
        } else {
          setError(result.error || 'حدث خطأ أثناء جلب رمز التجربة');
        }
        return;
      }

      setTrialCode(result.trial_code);
      setExpiresAt(result.expires_at);
      setUsername(result.username || null);
      setPassword(result.password || null);
      setLink(result.link || null);
      toast({
        title: 'تم بنجاح!',
        description: 'تم جلب رمز التجربة بنجاح وتم إرساله إلى بريدك الإلكتروني',
      });
    } catch (error: any) {
      console.error('Error fetching trial code:', error);
      setError('حدث خطأ غير متوقع');
    } finally {
      setFetching(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'تم النسخ!',
        description: 'تم نسخ رمز التجربة إلى الحافظة',
      });
    });
  };

  const formatExpiresAt = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs < 0) {
      return 'انتهت صلاحية الرمز';
    }

    if (diffHours > 0) {
      return `متبقي ${diffHours} ساعة و ${diffMinutes} دقيقة`;
    }
    return `متبقي ${diffMinutes} دقيقة`;
  };

  const calculateTrialDuration = (dateString: string | null) => {
    if (!dateString) return '3 ساعات';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffMs < 0) {
      return 'انتهت';
    }
    
    if (diffHours === 1) {
      return 'ساعة واحدة';
    } else if (diffHours < 24) {
      return `${diffHours} ساعات`;
    } else {
      const days = Math.floor(diffHours / 24);
      const hours = diffHours % 24;
      if (hours === 0) {
        return `${days} يوم`;
      }
      return `${days} يوم و ${hours} ساعة`;
    }
  };

  const formatExpiresAtDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <Header />
        <div className="container mx-auto px-4 py-20 pt-32">
          <div className="flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  // Show message if user is not authenticated
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" dir="rtl">
        <Header />
        <main className="container mx-auto px-4 py-16 pt-28">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-block mb-6">
                <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold rounded-full">
                  تجربة مجانية
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
                اطلب تجربة مجانية
              </h1>
              <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto">
                جرب خدمتنا مجاناً لمدة 3 ساعات
              </p>
            </div>

            {/* Authentication Required Card */}
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-blue-500/50">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="h-6 w-6 text-blue-500" />
                  <CardTitle className="text-2xl text-white">يجب تسجيل الدخول</CardTitle>
                </div>
                <CardDescription className="text-slate-300">
                  يجب تسجيل الدخول لطلب رمز تجربة مجاني
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-slate-300 text-center">
                    تحتاج إلى تسجيل الدخول لطلب رمز تجربة مجاني
                  </p>
                  <Link href="/auth?redirect=/trial" className="block">
                    <Button
                      size="lg"
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-6 text-lg"
                    >
                      <LogIn className="h-5 w-5 ml-2" />
                      تسجيل الدخول / إنشاء حساب
                      <ArrowRight className="h-5 w-5 mr-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-16 pt-28">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-block mb-6">
              <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold rounded-full">
                تجربة مجانية
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
              اطلب تجربة مجانية
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto">
              جرب خدمتنا مجاناً
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert className="mb-6 border-red-500/50 bg-red-900/20">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
          )}

          {/* Trial Code Card */}
          {trialCode ? (
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-green-500/50">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <CardTitle className="text-2xl text-white">رمز التجربة الخاص بك</CardTitle>
                </div>
                <CardDescription className="text-slate-300">
                  <span className="text-xs text-slate-400 mt-2 block">
                    تم إرسال رمز التجربة إلى بريدك الإلكتروني
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-900/50 rounded-lg p-6 mb-4 border border-slate-700">
                  <div className="flex items-center justify-between gap-4">
                    <code className="text-2xl md:text-3xl font-mono font-bold text-green-400 break-all">
                      {trialCode}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(trialCode || '')}
                      className="flex-shrink-0"
                    >
                      <Copy className="h-4 w-4 ml-2" />
                      نسخ
                    </Button>
                  </div>
                </div>
                
                {/* Credentials Section */}
                {(username || password || link) && (
                  <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-lg p-6 mb-4 border border-blue-500/30">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <LogIn className="h-5 w-5 text-blue-400" />
                      معلومات الدخول:
                    </h3>
                    <div className="space-y-4">
                      {username && (
                        <div>
                          <label className="text-sm text-slate-400 mb-1 block">اسم المستخدم:</label>
                          <div className="flex items-center justify-between gap-4 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                            <code className="text-lg font-mono font-bold text-blue-400 break-all flex-1">
                              {username}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(username)}
                              className="flex-shrink-0"
                            >
                              <Copy className="h-4 w-4 text-slate-400" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {password && (
                        <div>
                          <label className="text-sm text-slate-400 mb-1 block">كلمة المرور:</label>
                          <div className="flex items-center justify-between gap-4 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                            <code className="text-lg font-mono font-bold text-blue-400 break-all flex-1">
                              {password}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(password)}
                              className="flex-shrink-0"
                            >
                              <Copy className="h-4 w-4 text-slate-400" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {link && (
                        <div>
                          <label className="text-sm text-slate-400 mb-1 block">الرابط:</label>
                          <div className="flex items-center justify-between gap-4 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-lg font-medium text-blue-400 hover:text-blue-300 break-all flex-1 underline"
                            >
                              {link}
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(link)}
                              className="flex-shrink-0"
                            >
                              <Copy className="h-4 w-4 text-slate-400" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30 mb-4">
                  <Clock className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-slate-300">
                    <p className="font-semibold mb-1">مدة التجربة: {calculateTrialDuration(expiresAt)}</p>
                    <p className="mb-1">تاريخ الانتهاء: {formatExpiresAtDate(expiresAt)}</p>
                    <p className="text-slate-400 text-xs mt-2">{formatExpiresAt(expiresAt)}</p>
                  </div>
                </div>
                
                {/* Installation Method CTA */}
                <div className="mb-6">
                  <Link href="/tarkeeb" className="block">
                    <Button
                      size="lg"
                      className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-bold py-6 text-lg"
                    >
                      <Wrench className="h-5 w-5 ml-2" />
                      طريقة التركيب
                      <ArrowRight className="h-5 w-5 mr-2" />
                    </Button>
                  </Link>
                </div>
                
                {/* Subscribe CTA */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <p className="text-center text-lg text-slate-300 mb-4" style={{ fontFamily: 'var(--font-arabic)' }}>
                    الامور كلها تمام ؟ تقدر تطلب الاشتراك من هنا
                  </p>
                  <Link href="/subscribe" className="block">
                    <Button
                      size="lg"
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-6 text-lg"
                    >
                      <Sparkles className="h-5 w-5 ml-2" />
                      اطلب الاشتراك الآن
                      <ArrowRight className="h-5 w-5 mr-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-slate-700/50">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="h-6 w-6 text-blue-500" />
                  <CardTitle className="text-2xl text-white">احصل على رمز التجربة</CardTitle>
                </div>
                <CardDescription className="text-slate-300">
                  اضغط على الزر أدناه للحصول على رمز تجربة مجاني
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                    <Clock className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-slate-300">
                      <p className="font-semibold mb-1">مميزات التجربة:</p>
                      <ul className="list-disc list-inside space-y-1 text-slate-400">
                        <li>تجربة مجانية محدودة المدة</li>
                        <li>وصول كامل لجميع الميزات</li>
                        <li>جودة فائقة</li>
                        <li>تجربة واحدة فقط لكل مستخدم</li>
                      </ul>
                    </div>
                  </div>
                  <Button
                    onClick={fetchTrialCode}
                    disabled={fetching}
                    size="lg"
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-6 text-lg"
                  >
                    {fetching ? (
                      <>
                        <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                        جاري الجلب...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 ml-2" />
                        احصل على رمز التجربة الآن
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Export with dynamic import to prevent hydration issues
export default dynamic(() => Promise.resolve(TrialPageContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Header />
      <div className="container mx-auto px-4 py-20 pt-32">
        <div className="flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        </div>
      </div>
    </div>
  )
});

