import Link from 'next/link';
import { Instagram, MessageCircle } from 'lucide-react';

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
          <a
            href="https://www.instagram.com/maakaantv"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white transition"
            aria-label="Instagram"
          >
            <Instagram className="w-5 h-5" />
          </a>
          <a
            href={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ? `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white transition"
            aria-label="WhatsApp"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
        </div>

        <p className="text-center text-slate-500 text-sm mb-4">
          © 2025 مكان TV. جميع الحقوق محفوظة.
        </p>
        
        {/* Logos Attribution */}
        <div className="flex justify-center items-center gap-4 mt-4 flex-wrap">
          {/* Makaan TU Logo */}
          <div className="flex flex-col items-center opacity-80 hover:opacity-100 transition-opacity">
            <span className="text-white text-xs md:text-sm font-bold mb-0.5" style={{ fontFamily: 'var(--font-arabic)' }}>
              مَكَان
            </span>
            <div className="flex items-center gap-1">
              <span className="text-white text-[10px] md:text-xs font-bold tracking-wide">
                MAKAAN{' '}
                <span 
                  className="relative inline-block"
                  style={{
                    textShadow: `
                      -1px 0 0 cyan,
                      1px 0 0 magenta,
                      0 -1px 0 cyan,
                      0 1px 0 magenta
                    `,
                  }}
                >
                  <span className="relative z-10 text-white">TU</span>
                </span>
              </span>
              <svg width="8" height="8" viewBox="0 0 16 16" fill="white" className="mt-0.5">
                <path d="M8 0 L9.5 5.5 L15 7 L9.5 8.5 L8 14 L6.5 8.5 L1 7 L6.5 5.5 Z" />
              </svg>
            </div>
          </div>
          
          {/* TMDB Attribution */}
          <a 
            href="https://www.themoviedb.org" 
            target="_blank" 
            rel="noopener noreferrer"
            className="opacity-60 hover:opacity-100 transition-opacity"
            title="This product uses the TMDB API but is not endorsed or certified by TMDB"
          >
            <img 
              src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg" 
              alt="TMDB Logo" 
              className="h-3 md:h-4"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
