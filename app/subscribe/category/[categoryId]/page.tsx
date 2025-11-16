'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Sparkles, Zap, Crown, Star, Check, ArrowRight, ImageIcon, Package, Loader2, ShoppingCart, ArrowLeft } from 'lucide-react';
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

export default function CategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.categoryId as string;
  const { addItem } = useCart();
  const [products, setProducts] = useState<any[]>([]);
  const [categoryTitle, setCategoryTitle] = useState<string>('');
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
    const fetchCategoryProducts = async () => {
      try {
        setLoading(true);
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

        // Get products for this category
        const productsByCategory = result.productsByCategory || result.productsBySection || {};
        const categoryTitles = result.categoryTitles || result.sectionTitles || {};
        
        const categoryProducts = productsByCategory[categoryId] || [];
        
        // Transform products
        const transformedProducts = categoryProducts.map((product: any) => ({
          ...product,
          code: product.product_code,
          badgeColor: product.badge_color,
          isPackage: product.is_package,
          icon: iconMap[product.icon_name] || Sparkles,
          available_stock: product.available_stock || 0,
          purchase_count: product.purchase_count || 0,
        }));

        setProducts(transformedProducts);
        setCategoryTitle(categoryTitles[categoryId] || 'غير محدد');
      } catch (error) {
        console.error('Error fetching category products:', error);
      } finally {
        setLoading(false);
      }
    };

    if (categoryId) {
      fetchCategoryProducts();
    }
  }, [categoryId]);

  // Check if category contains package products
  const isPackageSection = products.some((p: any) => p.isPackage || p.is_package);
  const sectionIndex = 0;
  const sectionGradient = sectionGradients[sectionIndex];

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black pt-24 pb-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (products.length === 0) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black pt-24 pb-12">
          <div className="container mx-auto px-4">
            <div className="text-center py-20">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">لا توجد منتجات</h1>
              <p className="text-slate-400 mb-8">لم يتم العثور على منتجات في هذه الفئة</p>
              <Link href="/subscribe">
                <Button variant="outline" className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  العودة للمتجر
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-black via-slate-900 to-black pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Back Button */}
          <div className="mb-8">
            <Link href="/subscribe">
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                العودة للمتجر
              </Button>
            </Link>
          </div>

          {/* Category Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 inline-block">
              {categoryTitle}
            </h1>
            <div className={`h-1 w-24 mx-auto mt-4 bg-gradient-to-r ${products[0]?.gradient || 'from-blue-600 to-cyan-600'} rounded-full`} />
          </div>

          {/* Products Grid - Packages: 2 columns (long cards), Others: 3 columns */}
          <div className={isPackageSection ? "grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-8" : "grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-6"}>
            {products.map((product: any) => {
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
                        <div className="flex items-baseline justify-center gap-2 md:gap-3 mb-2">
                          <span className="text-4xl md:text-6xl font-extrabold text-white">{product.price}</span>
                          <span className="text-xl md:text-2xl text-slate-400">ريال</span>
                        </div>
                        <p className="text-slate-400 text-sm md:text-base">قيمة استثنائية</p>
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

                      {/* Action Buttons */}
                      <div className="space-y-3">
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
                          className={`w-full ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-slate-600 hover:bg-slate-700 border border-slate-500' : `bg-gradient-to-r ${product.gradient} hover:opacity-90`} text-white font-bold py-4 md:py-6 text-base md:text-lg shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:scale-105 ${product.available_stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span>{product.available_stock === 0 ? 'نفد المخزون' : 'اطلب الباقة الآن'}</span>
                          {product.available_stock > 0 && <ArrowRight className="mr-2 h-5 w-5 md:h-6 md:w-6 group-hover:translate-x-1 transition-transform" />}
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

              // Regular product cards
              return (
                <Card key={product.id} className="group relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-slate-700/50 hover:border-slate-500 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-2 h-full flex flex-col">
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} opacity-0 group-hover:opacity-15 transition-opacity duration-300 pointer-events-none`} />

                  {/* Product Image */}
                  <Link href={`/subscribe/${product.code}`} className="block cursor-pointer">
                    <div className="relative h-48 md:h-64 w-full overflow-hidden bg-gradient-to-br from-slate-700 to-slate-800">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-300"
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon className="h-16 w-16 text-slate-600" />
                        </div>
                      )}
                    </div>
                  </Link>

                  <CardHeader className="pb-4 pt-6 px-4 md:px-6">
                    <Link href={`/subscribe/${product.code}`} className="block cursor-pointer">
                      <CardTitle className="text-xl md:text-2xl text-white mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">
                        {product.name}
                      </CardTitle>
                      {product.description && (
                        <CardDescription className="text-slate-400 text-sm md:text-base line-clamp-2">
                          {product.description}
                        </CardDescription>
                      )}
                    </Link>
                  </CardHeader>

                  <CardContent className="mt-auto pb-6 md:pb-8 px-4 md:px-6">
                    {/* Price */}
                    <div className="mb-4 md:mb-6 text-center p-3 md:p-4 bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-xl border border-slate-600/50">
                      <div className="flex items-baseline justify-center gap-2 mb-1">
                        <span className="text-2xl md:text-3xl font-extrabold text-white">{product.price}</span>
                        <span className="text-lg md:text-xl text-slate-400">ريال</span>
                      </div>
                    </div>

                    {/* Stock Display */}
                    {product.available_stock !== undefined && (
                      <div className="mb-4 md:mb-6 p-2 md:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-xs md:text-sm">المخزون:</span>
                          <span className={`font-bold text-xs md:text-sm ${product.available_stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {product.available_stock > 0 ? `${product.available_stock}` : 'نفد'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2 md:space-y-3">
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
      </main>
      <Footer />
      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}

