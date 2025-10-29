import AuthForm from '@/components/AuthForm';
import Image from 'next/image';
import Link from 'next/link';

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Logo/Brand */}
      <Link href="/" className="flex flex-col items-center gap-3 mb-8">
        <Image 
          src="/logos/logo.png" 
          alt="Logo" 
          width={120} 
          height={120}
          className="rounded-lg"
          priority
        />
        <span className="text-xl font-bold text-white">مكان TV </span>
      </Link>

      {/* Auth Form */}
      <AuthForm />

      {/* Back to home link */}
      <Link 
        href="/" 
        className="mt-6 text-slate-300 hover:text-white transition text-sm"
      >
        ← العودة للصفحة الرئيسية
      </Link>
    </div>
  );
}

