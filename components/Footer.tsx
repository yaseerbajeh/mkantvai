import Link from 'next/link';
import { Facebook, Twitter, Instagram } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-12 mt-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 mb-8">
          <Link href="/contact" className="text-slate-400 hover:text-white transition">
            اتصل بنا
          </Link>
          <Link href="/privacy" className="text-slate-400 hover:text-white transition">
            سياسة الخصوصية
          </Link>
          <Link href="/terms" className="text-slate-400 hover:text-white transition">
            شروط الخدمة
          </Link>
        </div>

        <div className="flex justify-center items-center gap-6 mb-8">
          <a href="#" className="text-slate-400 hover:text-white transition">
            <Facebook className="w-5 h-5" />
          </a>
          <a href="#" className="text-slate-400 hover:text-white transition">
            <Twitter className="w-5 h-5" />
          </a>
          <a href="#" className="text-slate-400 hover:text-white transition">
            <Instagram className="w-5 h-5" />
          </a>
        </div>

        <p className="text-center text-slate-500 text-sm">
          © ٢٠٢٤ اقتراحات الأفلام. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
