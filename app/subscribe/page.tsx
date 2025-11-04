'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Sparkles, Zap, Crown, Star, Check, ArrowRight, ImageIcon, Package, Loader2, ShoppingCart } from 'lucide-react';
import { formatPriceWithSar } from '@/lib/utils';
import { useCart } from '@/lib/cart-context';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import AuthDialog from '@/components/AuthDialog';

const sectionGradients = [
  'from-purple-600/20 via-blue-600/20 to-purple-600/20',
  'from-red-600/20 via-rose-200/20 to-red-600/20',
  'from-green-600/20 via-emerald-600/20 to-green-600/20',
  'from-blue-600/20 via-cyan-600/20 to-teal-600/20',
];

// Icon mapping
const iconMap: { [key: string]: any } = {
  sparkles: Sparkles,
  star: Star,
  check: Check,
  package: Package,
  crown: Crown,
  zap: Zap,
};

export default function SubscribePage() {
  const router = useRouter();
  const { addItem } = useCart();
  const [productsBySection, setProductsBySection] = useState<{ [key: number]: any[] }>({});
  const [sectionTitles, setSectionTitles] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  
  // Check user authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Add cache-busting timestamp and no-cache option
        const response = await fetch('/api/products', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'فشل في جلب المنتجات');
        }

        // Group products by section
        const grouped: { [key: number]: any[] } = {};
        const titles: { [key: number]: string } = {};

        result.products.forEach((product: any) => {
          if (!grouped[product.section]) {
            grouped[product.section] = [];
            titles[product.section] = product.section_title;
          }
          grouped[product.section].push({
            ...product,
            code: product.product_code,
            badgeColor: product.badge_color,
            isPackage: product.is_package,
            icon: iconMap[product.icon_name] || Sparkles,
            available_stock: product.available_stock || 0,
          });
        });

        setProductsBySection(grouped);
        setSectionTitles(titles);
      } catch (error: any) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header />
      <main className="container mx-auto px-4 py-16 pt-28">
        <div className="max-w-7xl mx-auto">
          {/* Hero Header */}
          <div className="text-center mb-16">
            <div className="inline-block mb-6">
              <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold rounded-full">
                خطط الاشتراك الحصرية
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
              خطط الاشتراك
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto">
              اختر الباقة المناسبة لك واستمتع بمحتوى حصري وجودة فائقة
            </p>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
              <p className="text-slate-300">جاري تحميل المنتجات...</p>
            </div>
          ) : (
            /* Product Sections */
            Object.keys(productsBySection).map((sectionKey) => {
              const sectionIndex = parseInt(sectionKey) - 1;
              const section = productsBySection[parseInt(sectionKey)];
              const sectionGradient = sectionGradients[sectionIndex] || sectionGradients[0];
              const isPackageSection = parseInt(sectionKey) === 4; // 4th section is packages
              
              if (!section || section.length === 0) return null;
              
              return (
                <div key={sectionKey} className="mb-20">
                  {/* Section Header */}
                  <div className="mb-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 inline-block">
                      {sectionTitles[parseInt(sectionKey)] || `القسم ${sectionKey}`}
                    </h2>
                    <div className={`h-1 w-24 mx-auto mt-4 bg-gradient-to-r ${section[0].gradient} rounded-full`} />
                  </div>

                  {/* Products Grid - Packages: 2 columns (long cards), Others: 3 columns */}
                  <div className={isPackageSection ? "flex flex-nowrap overflow-x-auto md:grid md:grid-cols-2 gap-6 md:gap-8 -mx-4 md:mx-0 px-4 md:px-0" : "flex flex-nowrap overflow-x-auto md:grid md:grid-cols-3 gap-3 md:gap-6 -mx-4 md:mx-0 px-4 md:px-0"}>
                    {section.map((product: any) => {
                      const Icon = product.icon || Sparkles;
                    
                    // Package section - long detailed cards
                    if (isPackageSection && product.isPackage) {
                      return (
                        <Card key={product.id} className="group relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-slate-700/50 hover:border-slate-500 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-2 h-full flex flex-col min-w-[280px] md:min-w-0">
                            {/* Gradient overlay */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} opacity-0 group-hover:opacity-15 transition-opacity duration-300 pointer-events-none`} />
                            
                            {/* Badge */}
                            <div className="absolute top-4 right-4 z-10">
                              <span className={`${product.badgeColor} text-white text-xs md:text-sm font-bold px-4 py-2 rounded-full shadow-lg`}>
                                {product.duration}
                              </span>
                            </div>

                            {/* Package Header with Logos - Clickable Link */}
                            <Link href={`/subscribe/${product.code}`} className="block cursor-pointer">
                              <div className={`relative h-48 md:h-64 w-full overflow-hidden ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-gradient-to-br from-slate-700 to-slate-800' : `bg-gradient-to-br ${product.gradient}`} p-6 md:p-8`}>
                                <div className="h-full flex flex-col justify-between">
                                  <div className="flex items-center justify-center gap-4 md:gap-6 flex-wrap">
                                    {product.logos?.map((logo: string, idx: number) => (
                                      <div key={idx} className={`${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-slate-600/50' : 'bg-white/10'} backdrop-blur-sm rounded-xl p-4 md:p-6 border ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'border-slate-500/30' : 'border-white/20'} group-hover:scale-110 transition-transform duration-300`}>
                                        <img
                                          src={logo}
                                          alt={`${product.name} logo ${idx + 1}`}
                                          className={`h-12 w-12 md:h-16 md:w-16 object-contain ${logo.endsWith('.png') || logo.endsWith('.jpeg') || logo.endsWith('.jpg') ? '' : 'brightness-0 invert'}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-center">
                                    <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-2">{product.name}</h3>
                                    <p className={`${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'text-slate-200' : 'text-white/90'} text-sm md:text-base`}>{product.description}</p>
                                  </div>
                                </div>
                              </div>
                            </Link>

                            <CardHeader className="pb-4 pt-6 px-6 md:px-8">
                              <Link href={`/subscribe/${product.code}`} className="block cursor-pointer">
                                <CardTitle className="text-xl md:text-2xl text-white mb-3 group-hover:text-amber-300 transition-colors">
                                  المميزات الحصرية
                                </CardTitle>
                              </Link>
                              <ul className="space-y-2 md:space-y-3">
                                {product.features?.map((feature: string, idx: number) => (
                                  <li key={idx} className="flex items-center text-slate-300 text-sm md:text-base">
                                    <Check className="h-4 w-4 md:h-5 md:w-5 text-green-400 ml-2 flex-shrink-0" />
                                    <span>{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardHeader>

                            <CardContent className="mt-auto pb-6 md:pb-8 px-6 md:px-8">
                              {/* Price */}
                              <div className="mb-6 text-center p-4 md:p-6 bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-xl border border-slate-600/50">
                                {(() => {
                                  return (
                                    <>
                                      <div className="flex items-baseline justify-center gap-2 md:gap-3 mb-2">
                                        <span className="text-4xl md:text-6xl font-extrabold text-white">{product.price}</span>
                                        <span className="text-xl md:text-2xl text-slate-400">ريال</span>
                                      </div>
                                      <p className="text-slate-400 text-sm md:text-base">قيمة استثنائية</p>
                                    </>
                                  );
                                })()}
                              </div>

                              {/* Stock Display */}
                              {product.available_stock !== undefined && (
                                <div className="mb-4 md:mb-6 p-3 md:p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400 text-sm md:text-base">المخزون المتاح:</span>
                                    <span className={`font-bold text-sm md:text-base ${product.available_stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {product.available_stock > 0 ? `${product.available_stock} متاح` : 'نفد المخزون'}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* CTA Buttons */}
                              <div className="space-y-2 relative z-10">
                                <Button 
                                  disabled={product.available_stock === 0}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    router.push(`/subscribe/${product.code}`);
                                  }}
                                  className={`w-full ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-slate-600 hover:bg-slate-700 border border-slate-500' : `bg-gradient-to-r ${product.gradient} hover:opacity-90`} text-white font-bold py-4 md:py-6 text-base md:text-lg shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:scale-105 ${product.available_stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <span>{product.available_stock === 0 ? 'نفد المخزون' : 'اطلب الباقة الآن'}</span>
                                  {product.available_stock > 0 && <ArrowRight className="mr-2 h-5 w-5 md:h-6 md:w-6 group-hover:translate-x-1 transition-transform" />}
                                </Button>
                                <Button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation(); // Prevent navigation to product page
                                  if (!user) {
                                    setAuthDialogOpen(true);
                                    return;
                                  }
                                  if (product.available_stock > 0) {
                                    addItem({
                                      product_code: product.code,
                                      product_name: product.name,
                                      price: product.price,
                                      quantity: 1,
                                      image: product.image,
                                    });
                                  }
                                }}
                                  disabled={product.available_stock === 0}
                                  className={`w-full bg-red-600 hover:bg-red-700 text-white py-3 md:py-4 text-sm md:text-base relative z-20 ${product.available_stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <ShoppingCart className="mr-2 h-4 w-4 md:h-5 md:w-5 text-white" />
                                  <span className="text-white">{product.available_stock === 0 ? 'نفد المخزون' : 'أضف إلى السلة'}</span>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                      );
                    }
                    
                    // Regular product cards (sections 1-3)
                    return (
                      <Card key={product.id} className="group relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 h-full flex flex-col min-w-[280px] md:min-w-0">
                          {/* Gradient overlay */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none`} />
                          
                          {/* Badge */}
                          <div className="absolute top-2 right-2 z-10">
                            <span className={`${product.badgeColor} text-white text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-full shadow-lg`}>
                              {product.duration}
                            </span>
                          </div>

                          {/* Product Image - Clickable Link */}
                          <Link href={`/subscribe/${product.code}`} className="block">
                            <div className="relative h-32 md:h-48 w-full overflow-hidden bg-gradient-to-br from-slate-700 to-slate-800 cursor-pointer">
                            {/* Section 1: Two images side by side */}
                            {'image2' in product && product.image2 ? (
                              <div className="h-full w-full flex relative">
                                {/* Left image */}
                                <div className="relative w-1/2 h-full overflow-hidden">
                                  <Image
                                    src={product.image}
                                    alt={`${product.name} - Image 1`}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500 md:scale-90"
                                    sizes="(max-width: 768px) 16vw, 15vw"
                                  />
                                </div>
                                {/* Right image */}
                                <div className="relative w-1/2 h-full overflow-hidden">
                                  <Image
                                    src={product.image2}
                                    alt={`${product.name} - Image 2`}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500 md:scale-90"
                                    sizes="(max-width: 768px) 16vw, 15vw"
                                  />
                                </div>
                                {/* IPTV Logo overlay for Section 1 */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <img
                                    src="/logos/iptv.png"
                                    alt="IPTV"
                                    className="h-12 w-12 md:h-16 md:w-16 object-contain opacity-80"
                                  />
                                </div>
                              </div>
                            ) : 'image' in product && product.image ? (
                              // Section 2 & 3: Single image or logo
                              product.image.endsWith('.svg') ? (
                                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 p-4">
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    className="h-16 md:h-24 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                                  />
                                </div>
                              ) : (
                                <div className="relative h-full w-full">
                                  <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                    sizes="(max-width: 768px) 33vw, 30vw"
                                  />
                                </div>
                              )
                            ) : (
                              <div className={`h-full w-full bg-gradient-to-br ${product.gradient} flex items-center justify-center`}>
                                <ImageIcon className="w-10 h-10 md:w-16 md:h-16 text-white/30" />
                              </div>
                            )}
                            </div>
                          </Link>

                          <CardHeader className="pb-2 pt-3 md:pb-3 md:pt-6 px-3 md:px-6">
                            <Link href={`/subscribe/${product.code}`} className="block cursor-pointer">
                              <CardTitle className="text-sm md:text-xl text-white mb-1 md:mb-2 group-hover:text-blue-300 transition-colors line-clamp-2">
                                {product.name}
                              </CardTitle>
                              <CardDescription className="text-slate-400 text-xs md:text-sm min-h-[32px] md:min-h-[40px] line-clamp-2">
                                {product.description}
                              </CardDescription>
                            </Link>
                          </CardHeader>

                          <CardContent className="mt-auto pb-3 md:pb-6 px-3 md:px-6">
                            {/* Price */}
                            <div className="mb-3 md:mb-6 text-center">
                              {(() => {
                                const { sarText } = formatPriceWithSar(product.price);
                                return (
                                  <>
                                    <div className="flex items-baseline justify-center gap-1 md:gap-2">
                                      <span className="text-2xl md:text-5xl font-extrabold text-white">{product.price}</span>
                                      <span className="text-sm md:text-xl text-slate-400">ريال</span>
                                    </div>
                                    {product.duration !== '1 شهر' && (
                                      <p className="text-xs md:text-sm text-slate-500 mt-1 md:mt-2">
                                        {Math.round(product.price / (product.duration.includes('3') ? 3 : product.duration.includes('6') ? 6 : 12))} ريال/شهر
                                      </p>
                                    )}
                                  </>
                                );
                              })()}
                            </div>

                            {/* Stock Display */}
                            {product.available_stock !== undefined && (
                              <div className="mb-3 md:mb-4 p-2 md:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 text-xs md:text-sm">المخزون:</span>
                                  <span className={`font-bold text-xs md:text-sm ${product.available_stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {product.available_stock > 0 ? `${product.available_stock} متاح` : 'نفد'}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* CTA Buttons */}
                            <div className="space-y-2 relative z-10">
                              <Button 
                                disabled={product.available_stock === 0}
                                onClick={(e) => {
                                  e.preventDefault();
                                  router.push(`/subscribe/${product.code}`);
                                }}
                                className={`w-full bg-gradient-to-r ${product.gradient} hover:opacity-90 text-white font-semibold py-3 md:py-6 text-sm md:text-lg shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-105 ${product.available_stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <span>{product.available_stock === 0 ? 'نفد المخزون' : 'اطلب الآن'}</span>
                                {product.available_stock > 0 && <ArrowRight className="mr-1 md:mr-2 h-3 w-3 md:h-5 md:w-5 group-hover:translate-x-1 transition-transform" />}
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!user) {
                                    setAuthDialogOpen(true);
                                    return;
                                  }
                                  if (product.available_stock > 0) {
                                    addItem({
                                      product_code: product.code,
                                      product_name: product.name,
                                      price: product.price,
                                      quantity: 1,
                                      image: product.image,
                                    });
                                  }
                                }}
                                disabled={product.available_stock === 0}
                                className={`w-full bg-red-600 hover:bg-red-700 text-white py-2 md:py-3 text-xs md:text-sm relative z-20 ${product.available_stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <ShoppingCart className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4 text-white" />
                                <span className="text-white">{product.available_stock === 0 ? 'نفد المخزون' : 'أضف إلى السلة'}</span>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                    );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
      <Footer />
      
      {/* Auth Dialog */}
      <AuthDialog 
        open={authDialogOpen} 
        onOpenChange={setAuthDialogOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
