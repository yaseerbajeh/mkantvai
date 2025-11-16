'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, User, Heart, Package, Store, Shield, Settings, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';

export default function Header() {
  const router = useRouter();
  const { getItemCount } = useCart();
  const cartCount = getItemCount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = (user: SupabaseUser | null | undefined) => {
    if (!user?.email) {
      setIsAdmin(false);
      return;
    }

    const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
    if (adminEmailsStr) {
      const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
      setIsAdmin(adminEmails.includes(user.email));
    } else {
      // If no admin emails configured, don't show admin panel
      setIsAdmin(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await signOut();
    setIsLoading(false);
    router.refresh();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-slate-800">
      <nav className="container mx-auto px-4 h-12 flex items-center justify-between overflow-visible">
        {/* Left side: Logo and الرئيسية */}
        <div className="flex items-center gap-4">
          {/* Logo - Size is independent from header height (h-10) */}
          {/* Change logo size by modifying the h-* class below without affecting header height */}
          <Link href="/" className="flex items-center">
            <img 
              src="https://f.top4top.io/p_3601uhadl1.png" 
              alt="Mkantv Plus Logo" 
              className="h-36 w-auto object-contain"
            />
          </Link>
          
          {/* الرئيسية - Desktop only, on left side */}
          <Link href="/" className="hidden md:block text-slate-300 hover:text-white transition">
            الرئيسية
          </Link>
        </div>

        {/* Right side: My Orders, Store, and User info/Auth */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* My Orders and Store - Always visible on right side */}
          {user && (
            <Link href="/my-orders" className="text-slate-300 hover:text-white transition flex items-center gap-1.5 md:gap-2">
              <Package className="w-4 h-4 md:w-4 md:h-4" />
              <span className="hidden sm:inline text-sm md:text-base">طلباتي</span>
            </Link>
          )}
          <Link href="/subscribe" className="text-slate-300 hover:text-white transition flex items-center gap-1.5 md:gap-2">
            <Store className="w-4 h-4 md:w-4 md:h-4" />
            <span className="hidden sm:inline text-sm md:text-base">المتجر</span>
          </Link>
          
          {/* Cart Icon */}
          <Link href="/cart" className="relative text-slate-300 hover:text-white transition flex items-center gap-1.5 md:gap-2">
            <ShoppingCart className="w-4 h-4 md:w-4 md:h-4" />
            <span className="hidden sm:inline text-sm md:text-base">السلة</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </Link>
          
          {/* Admin Panel - Only visible to admins */}
          {isAdmin && (
            <Link href="/admin" className="text-slate-300 hover:text-white transition flex items-center gap-1.5 md:gap-2">
              <Shield className="w-4 h-4 md:w-4 md:h-4" />
              <span className="hidden sm:inline text-sm md:text-base">لوحة الإدارة</span>
            </Link>
          )}
          
          {/* User info / Auth */}
          {user ? (
            <div className="hidden md:flex items-center gap-4">
              <Link href="/profile" className="flex items-center gap-2 text-slate-300 hover:text-white transition">
                <Settings className="w-4 h-4" />
                <span className="text-sm">الإعدادات</span>
              </Link>
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
            <Link href="/auth" className="hidden md:block">
              <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
                تسجيل الدخول
              </Button>
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
          <Link
              href="/"
              className="text-slate-300 hover:text-white transition py-2 text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              الرئيسية
            </Link>
            <Link
              href="/subscribe"
              className="text-slate-300 hover:text-white transition py-2 text-base font-medium flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Store className="w-4 h-4" />
              المتجر
            </Link>
            <Link
              href="/cart"
              className="relative text-slate-300 hover:text-white transition py-2 text-base font-medium flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ShoppingCart className="w-4 h-4" />
              السلة
              {cartCount > 0 && (
                <span className="mr-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </Link>
            {user ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-slate-300 hover:text-white transition py-2 flex items-center gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Shield className="w-4 h-4" />
                    لوحة الإدارة
                  </Link>
                )}
                <Link
                  href="/my-orders"
                  className="text-slate-300 hover:text-white transition py-2 flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Package className="w-4 h-4" />
                  طلباتي
                </Link>
                <Link
                  href="/profile"
                  className="text-slate-300 hover:text-white transition py-2 flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  الإعدادات
                </Link>
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
