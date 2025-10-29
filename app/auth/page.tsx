import AuthForm from '@/components/AuthForm';
import { Film } from 'lucide-react';
import Link from 'next/link';

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Logo/Brand */}
      <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white mb-8">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <Film className="w-6 h-6" />
        </div>
        اقتراحات الأفلام
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

