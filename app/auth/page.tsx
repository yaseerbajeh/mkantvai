import AuthForm from '@/components/AuthForm';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function AuthPage() {
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

        {/* Auth Form */}
        <AuthForm />

        {/* Back to home link */}
        <Link 
          href="/" 
          className="mt-8 flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group"
        >
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          العودة للصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}

