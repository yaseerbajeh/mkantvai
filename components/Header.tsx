'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, User, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOut();
    setIsLoading(false);
    router.refresh();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-slate-800">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <img 
            src="/logos/logo.png" 
            alt="Logo" 
            className="h-10 w-auto"
          />
        </Link>

        {/* Mobile Center Text - Only visible on mobile */}
        <div className="md:hidden">
          <h2 className="text-sm font-semibold text-white tracking-wide">
            مكان TV
          </h2>
        </div>

        <div className="hidden md:flex items-center gap-8">
        <Link href="/" className="text-slate-300 hover:text-white transition">
            الرئيسية
          </Link>
          <Link href="/#how-it-works" className="text-slate-300 hover:text-white transition">
            كيف يعمل
          </Link>
          <Link href="/#about" className="text-slate-300 hover:text-white transition">
            عن الموقع
          </Link>
          
          {user && (
            <Link href="/watchlist" className="text-slate-300 hover:text-white transition flex items-center gap-2">
              <Heart className="w-4 h-4" />
              قائمة المشاهدة
            </Link>
          )}
          
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-300">
                <User className="w-4 h-4" />
                <span className="text-sm">{user.email}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSignOut}
                disabled={isLoading}
                className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <LogOut className="w-4 h-4 ml-2" />
                تسجيل الخروج
              </Button>
            </div>
          ) : (
            <Link href="/auth">
              <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
                تسجيل الدخول
              </Button>
            </Link>
          )}
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-white"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <Link
              href="/#how-it-works"
              className="text-slate-300 hover:text-white transition py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              كيف يعمل
            </Link>
            <Link
              href="/#about"
              className="text-slate-300 hover:text-white transition py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              عن الموقع
            </Link>
            
            {user && (
              <Link
                href="/watchlist"
                className="text-slate-300 hover:text-white transition py-2 flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Heart className="w-4 h-4" />
                قائمة المشاهدة
              </Link>
            )}
            
            {user ? (
              <>
                <div className="flex items-center gap-2 text-slate-300 py-2">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{user.email}</span>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  disabled={isLoading}
                  className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 w-full"
                >
                  <LogOut className="w-4 h-4 ml-2" />
                  تسجيل الخروج
                </Button>
              </>
            ) : (
              <Link href="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="default" className="bg-blue-600 hover:bg-blue-700 w-full">
                  تسجيل الدخول
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
