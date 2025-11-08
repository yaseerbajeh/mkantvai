'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { 
  Smartphone, 
  Tv, 
  Laptop, 
  MessageCircle, 
  Download, 
  Play, 
  Store
} from 'lucide-react';

export default function TarkeebPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '966542668201';
  const whatsappMessage = encodeURIComponent('لأي استفسار أو مساعدة في التثبيت، تواصل معنا عبر واتساب');
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      <main className="container mx-auto px-4 py-24 pt-32">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              طريقة تثبيت التطبيق
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full mb-6"></div>
            <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto">
              اتبع التعليمات أدناه لتثبيت التطبيق على جهازك المفضل
            </p>
          </div>

          {/* iPhone/iPad Section */}
          <div className="mb-12">
            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-2 border-blue-500/30 rounded-2xl overflow-hidden hover:border-blue-400/50 transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-blue-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Smartphone className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl text-white">
                    لأجهزة iPhone / iPad
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {/* YouTube Video Placeholder */}
                  <div className="bg-slate-900/50 rounded-xl p-8 border-2 border-dashed border-slate-600">
                    <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Play className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg">فيديو يوتيوب - سيتم إضافته لاحقاً</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Android TV Section */}
          <div className="mb-12">
            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-2 border-green-500/30 rounded-2xl overflow-hidden hover:border-green-400/50 transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-b border-green-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Tv className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl text-white">
                    لأجهزة Android TV (شاشات الاندرويد أو جوالات الأندرويد)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  {/* Step-by-step Instructions */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-green-500/50 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                        1
                      </div>
                      <p className="text-slate-300 text-lg flex-1 pt-1">
                        افتح متجر Google Play على جهاز Android
                      </p>
                    </div>
                    
                    {/* Photo Placeholder 1 */}
                    <div className="bg-slate-900/50 rounded-xl p-8 border-2 border-dashed border-slate-600">
                      <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <Store className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                          <p className="text-slate-400">صورة - سيتم رفعها لاحقاً</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-green-500/50 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                        2
                      </div>
                      <p className="text-slate-300 text-lg flex-1 pt-1">
                        ابحث عن تطبيق Downloader
                      </p>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-green-500/50 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                        3
                      </div>
                      <p className="text-slate-300 text-lg flex-1 pt-1">
                        ثبت التطبيق وافتحه
                      </p>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-green-500/50 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                        4
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-300 text-lg pt-1 mb-2">
                          افتح التطبيق واكتب هذا الكود
                        </p>
                        <div className="bg-slate-800 px-4 py-3 rounded-lg border-2 border-green-500/50">
                          <code className="text-green-400 text-xl font-mono font-bold">16589</code>
                        </div>
                      </div>
                    </div>

                    {/* Photo Placeholder 2 */}
                    <div className="bg-slate-900/50 rounded-xl p-8 border-2 border-dashed border-slate-600">
                      <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <Store className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                          <p className="text-slate-400">صورة - سيتم رفعها لاحقاً</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-green-500/50 transition-colors">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                        5
                      </div>
                      <p className="text-slate-300 text-lg flex-1 pt-1">
                        ثم تكتب رمز الاشتراك هنا ويضبط
                      </p>
                    </div>

                    {/* Photo Placeholder 3 */}
                    <div className="bg-slate-900/50 rounded-xl p-8 border-2 border-dashed border-slate-600">
                      <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <Store className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                          <p className="text-slate-400">صورة - سيتم رفعها لاحقاً</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Laptop (Windows/Mac) Section */}
          <div className="mb-12">
            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-2 border-purple-500/30 rounded-2xl overflow-hidden hover:border-purple-400/50 transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-purple-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Laptop className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl text-white">
                    لأجهزة اللابتوب (Windows / Mac)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      1
                    </div>
                    <p className="text-slate-300 text-lg flex-1 pt-1">
                      افتح متصفح الإنترنت (Chrome أو Edge أو Safari)
                    </p>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-300 text-lg pt-1 mb-3">
                        ادخل على الرابط وحمل التطبيق:
                      </p>
                      <a 
                        href="https://www.iptvsmarters.com/IPTVSmartersPro-Setup-1.1.1.exe"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <Download className="w-5 h-5" />
                        <span>تحميل التطبيق</span>
                      </a>
                      <p className="text-slate-400 text-sm mt-2 break-all">
                        https://www.iptvsmarters.com/IPTVSmartersPro-Setup-1.1.1.exe
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      3
                    </div>
                    <p className="text-slate-300 text-lg flex-1 pt-1">
                      بعد التحميل سجل دخول باستخدام البيانات اللي حصلت عليها
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Smart TVs (LG/Samsung) Section */}
          <div className="mb-12">
            <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-2 border-red-500/30 rounded-2xl overflow-hidden hover:border-red-400/50 transition-all duration-300">
              <CardHeader className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border-b border-red-500/30">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Tv className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl text-white">
                    لشاشات LG / Samsung (سمارت)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-red-500/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                      1
                    </div>
                    <p className="text-slate-300 text-lg flex-1 pt-1">
                      افتح متجر التطبيقات على الشاشة (LG Content Store أو Samsung Apps)
                    </p>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-red-500/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                      2
                    </div>
                    <p className="text-slate-300 text-lg flex-1 pt-1">
                      ابحث عن تطبيق IPTV SMARTERS
                    </p>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-red-500/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                      3
                    </div>
                    <p className="text-slate-300 text-lg flex-1 pt-1">
                      ثبت التطبيق وافتحه
                    </p>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-red-500/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                      4
                    </div>
                    <p className="text-slate-300 text-lg flex-1 pt-1">
                      بعد التحميل سجل دخول باستخدام البيانات اللي حصلت عليها
                    </p>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-red-500/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                      5
                    </div>
                    <p className="text-slate-300 text-lg flex-1 pt-1">
                      بعد التفعيل، أعد تشغيل التطبيق وستظهر القنوات
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Contact Section */}
          <div className="mb-12">
            <Card className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-2 border-green-500/50 rounded-2xl overflow-hidden">
              <CardContent className="pt-8 pb-8">
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <MessageCircle className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                      لأي استفسار أو مساعدة في التثبيت
                    </h3>
                    <p className="text-slate-300 text-lg mb-6">
                      تواصل معنا عبر واتساب
                    </p>
                  </div>
                  <a 
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block"
                  >
                    <Button 
                      size="lg" 
                      className="bg-green-600 hover:bg-green-700 text-white text-lg px-8 py-6 h-auto rounded-xl shadow-lg hover:scale-105 transition-all duration-200 flex items-center gap-3 mx-auto"
                    >
                      <MessageCircle className="w-6 h-6" />
                      تواصل معنا على واتساب
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

