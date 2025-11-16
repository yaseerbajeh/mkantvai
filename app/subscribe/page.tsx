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
  const [productsByCategory, setProductsByCategory] = useState<{ [key: string]: any[] }>({});
  const [categoryTitles, setCategoryTitles] = useState<{ [key: string]: string }>({});
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

        // Group products by category (use productsByCategory if available, otherwise fall back to productsBySection)
        const grouped: { [key: string]: any[] } = {};
        const titles: { [key: string]: string } = {};

        // Use productsByCategory if available (new format), otherwise use productsBySection (backward compatibility)
        const productsToGroup = result.productsByCategory || result.productsBySection || {};
        const titlesToUse = result.categoryTitles || result.sectionTitles || {};

        // If API already grouped by category, use that
        if (result.productsByCategory) {
          Object.keys(result.productsByCategory).forEach((categoryId) => {
            const categoryProducts = result.productsByCategory[categoryId];
            grouped[categoryId] = categoryProducts.map((product: any) => ({
              ...product,
              code: product.product_code,
              badgeColor: product.badge_color,
              isPackage: product.is_package,
              icon: iconMap[product.icon_name] || Sparkles,
              available_stock: product.available_stock || 0,
              purchase_count: product.purchase_count || 0,
            }));
            // Get category name from first product's category or from titles
            const firstProduct = categoryProducts[0];
            titles[categoryId] = titlesToUse[categoryId] || firstProduct?.categories?.name || firstProduct?.section_title || 'غير محدد';
          });
        } else {
          // Fallback: group by section (backward compatibility)
          result.products.forEach((product: any) => {
            const categoryId = product.category_id || `section-${product.section}`;
            const categoryName = product.categories?.name || product.section_title || `القسم ${product.section}`;
            
            if (!grouped[categoryId]) {
              grouped[categoryId] = [];
              titles[categoryId] = categoryName;
            }
            grouped[categoryId].push({
              ...product,
              code: product.product_code,
              badgeColor: product.badge_color,
              isPackage: product.is_package,
              icon: iconMap[product.icon_name] || Sparkles,
              available_stock: product.available_stock || 0,
              purchase_count: product.purchase_count || 0,
            });
          });
        }

        setProductsByCategory(grouped);
        setCategoryTitles(titles);
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
          {/* Hero Banner */}
          <div className="relative mb-20 overflow-hidden rounded-3xl">
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-cyan-600/20 bg-[length:200%_200%] animate-gradient-shift">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.3),transparent_50%)] animate-pulse-slow" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.3),transparent_50%)] animate-pulse-slow" style={{ animationDelay: '1s' }} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.2),transparent_50%)] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            {/* Content */}
            <div className="relative z-10 px-6 md:px-12 py-16 md:py-24">
              {/* Main Headline */}
              <div className="text-center mb-12">
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 bg-gradient-to-r from-white via-blue-200 to-cyan-200 bg-clip-text text-transparent animate-fade-in">
                  خطط الاشتراك الحصرية
                </h1>
                <p className="text-xl md:text-2xl lg:text-3xl text-slate-200 max-w-3xl mx-auto mb-8 leading-relaxed">
                  اختر الباقة المناسبة لك واستمتع بمحتوى حصري وجودة فائقة
                </p>
                <div className="flex flex-wrap justify-center gap-4 mb-8">
                  <Button
                    onClick={() => {
                      const firstCategory = Object.keys(productsByCategory)[0];
                      if (firstCategory) {
                        document.getElementById(`category-${firstCategory}`)?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold px-8 py-6 text-lg md:text-xl shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105"
                    disabled={loading || Object.keys(productsByCategory).length === 0}
                  >
                    <span>استكشف الخطط</span>
                    <ArrowRight className="mr-2 h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Categories Showcase */}
              {!loading && Object.keys(productsByCategory).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-12">
                  {Object.keys(productsByCategory).slice(0, 4).map((categoryId, idx) => {
                    const category = productsByCategory[categoryId];
                    const categoryTitle = categoryTitles[categoryId] || 'غير محدد';
                    const firstProduct = category[0];
                    if (!firstProduct) return null;

                    const delay = idx * 100;
                    const productCount = category.length;

                    // Get category-specific icon based on category title
                    const getCategoryIcon = (title: string) => {
                      const titleLower = title.toLowerCase();
                      // Match Netflix variations: نتـFlix, نتflix, netflix, نتفليكس
                      if (titleLower.includes('نت') && (titleLower.includes('flix') || titleLower.includes('فليكس'))) {
                        return '/logos/netflix.svg';
                      } else if (titleLower.includes('netflix')) {
                        return '/logos/netflix.svg';
                      } else if (titleLower.includes('شاه') || titleLower.includes('shahid')) {
                        return 'https://c.top4top.io/p_35923vyyf1.jpeg';
                      } else if (titleLower.includes('أروما') || titleLower.includes('iptv') || titleLower.includes('اروما')) {
                        return '/logos/iptv.png';
                      }
                      return null;
                    };

                    const categoryIcon = getCategoryIcon(categoryTitle);
                    const isNetflixCategory = categoryIcon === '/logos/netflix.svg';

                    return (
                      <div
                        key={categoryId}
                        onClick={() => {
                          document.getElementById(`category-${categoryId}`)?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="group relative cursor-pointer"
                      >
                        <div
                          className="relative h-full bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-slate-500 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-2 overflow-hidden"
                          style={{ animationDelay: `${delay}ms` }}
                        >
                          {/* Netflix Icon Overlay for Netflix category - Always visible, behind gradient */}
                          {isNetflixCategory && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none z-0">
                              <img
                                src="/logos/netflix.svg"
                                alt="Netflix"
                                className="h-32 w-32 md:h-40 md:w-40 object-contain"
                              />
                            </div>
                          )}
                          
                          {/* Gradient Overlay */}
                          <div className={`absolute inset-0 bg-gradient-to-br ${firstProduct.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none z-0`} />
                          
                          {/* Category Icon/Logo */}
                          <div className="flex items-center justify-center mb-4 h-16">
                            {categoryIcon ? (
                              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 group-hover:scale-110 transition-transform">
                                <img
                                  src={categoryIcon}
                                  alt={`${categoryTitle} logo`}
                                  className="h-12 w-12 object-contain"
                                />
                              </div>
                            ) : firstProduct.logos && firstProduct.logos.length > 0 ? (
                              <div className="flex items-center gap-2">
                                {firstProduct.logos.slice(0, 2).map((logo: string, logoIdx: number) => (
                                  <div key={logoIdx} className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 group-hover:scale-110 transition-transform">
                                    <img
                                      src={logo}
                                      alt={`${categoryTitle} logo`}
                                      className="h-8 w-8 object-contain"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 group-hover:scale-110 transition-transform">
                                <Package className="h-10 w-10 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Category Info */}
                          <div className="relative z-10 text-center">
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                              {categoryTitle}
                            </h3>
                            <p className="text-sm text-slate-400 mb-4">
                              {productCount} {productCount === 1 ? 'منتج' : 'منتجات'} متاحة
                            </p>
                            <div className="flex items-center justify-center gap-2 text-blue-400">
                              <span className="text-sm font-semibold">استكشف الفئة</span>
                              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Loading State for Categories */}
              {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-12">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-48 bg-slate-800/50 rounded-2xl animate-pulse" />
                  ))}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
              <p className="text-slate-300">جاري تحميل المنتجات...</p>
            </div>
          ) : (
            /* Product Categories */
            Object.keys(productsByCategory).map((categoryId, categoryIndex) => {
              const category = productsByCategory[categoryId];
              const sectionIndex = categoryIndex % sectionGradients.length;
              const sectionGradient = sectionGradients[sectionIndex];
              // Check if this category contains package products
              const isPackageSection = category.some((p: any) => p.isPackage || p.is_package);
              
              if (!category || category.length === 0) return null;
              
              return (
                <div key={categoryId} id={`category-${categoryId}`} className="mb-20 scroll-mt-20">
                  {/* Category Header */}
                  <div className="mb-8 text-center">
                    <div className="flex items-center justify-center gap-4 mb-2">
                      <h2 className="text-3xl md:text-4xl font-bold text-white inline-block">
                        {categoryTitles[categoryId] || 'غير محدد'}
                      </h2>
                      <Link href={`/subscribe/category/${categoryId}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white text-sm md:text-base"
                        >
                          عرض الكل
                          <ArrowRight className="h-4 w-4 mr-2" />
                        </Button>
                      </Link>
                    </div>
                    <div className={`h-1 w-24 mx-auto mt-4 bg-gradient-to-r ${category[0].gradient} rounded-full`} />
                  </div>

                  {/* Products Grid - Packages: 2 columns (long cards), Others: 3 columns */}
                  <div className={isPackageSection ? "grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-8" : "grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-6"}>
                    {category.map((product: any) => {
                      const Icon = product.icon || Sparkles;
                    
                    // Package section - long detailed cards
                    if (isPackageSection && product.isPackage) {
                      return (
                        <Card key={product.id} className="group relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-slate-700/50 hover:border-slate-500 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-2 h-full flex flex-col">
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
                                  <div className="flex items-center justify-center gap-2 md:gap-3 flex-nowrap w-full">
                                    {product.logos?.map((logo: string, idx: number) => (
                                      <div key={idx} className={`${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-slate-600/50' : 'bg-white/10'} backdrop-blur-sm rounded-lg p-2 md:p-3 border ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'border-slate-500/30' : 'border-white/20'} group-hover:scale-110 transition-transform duration-300`}>
                                        <img
                                          src={logo}
                                          alt={`${product.name} logo ${idx + 1}`}
                                          className={`h-8 w-8 md:h-12 md:w-12 object-contain ${logo.endsWith('.png') || logo.endsWith('.jpeg') || logo.endsWith('.jpg') ? '' : 'brightness-0 invert'}`}
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

                              {/* Purchase Count Display */}
                              {product.purchase_count !== undefined && product.purchase_count > 0 && (
                                <div className="mb-4 md:mb-6 p-2 md:p-3 bg-blue-900/20 rounded-lg border border-blue-700/50">
                                  <div className="flex items-center justify-center">
                                    <span className="text-blue-300 text-xs md:text-sm font-semibold">
                                      تم شراؤه من قبل {product.purchase_count} شخص
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
                      <Card key={product.id} className="group relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 h-full flex flex-col">
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

                            {/* Purchase Count Display */}
                            {product.purchase_count !== undefined && product.purchase_count > 0 && (
                              <div className="mb-3 md:mb-4 p-2 md:p-3 bg-blue-900/20 rounded-lg border border-blue-700/50">
                                <div className="flex items-center justify-center">
                                  <span className="text-blue-300 text-xs font-semibold">
                                    تم شراؤه من قبل {product.purchase_count} شخص
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
