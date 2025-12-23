'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Sparkles, Zap, Crown, Star, Check, ArrowRight, ImageIcon, Package, Loader2, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { formatPriceWithSar } from '@/lib/utils';
import { useCart } from '@/lib/cart-context';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import AuthDialog from '@/components/AuthDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';


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
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { addItem } = useCart();
    const [productsByCategory, setProductsByCategory] = useState<{ [key: string]: any[] }>({});
    const [categoryTitles, setCategoryTitles] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(true);
    const [aromaProducts, setAromaProducts] = useState<{ [key: string]: any[] }>({});
    const [user, setUser] = useState<User | null>(null);
    const [authDialogOpen, setAuthDialogOpen] = useState(false);
    const [promotionalBanner, setPromotionalBanner] = useState<{
        id: string;
        title: string;
        subtitle: string;
        discount_percentage: number;
        expiration_date?: string | null;
        cta_link: string;
        banner_type?: 'default' | 'blackfriday';
        banner_image_url?: string;
        is_enabled?: boolean;
    } | null>(null);
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

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

                // Group aroma products separately
                const aromaGrouped: { [key: string]: any[] } = {};

                // If API already grouped by category, use that
                if (result.productsByCategory) {
                    Object.keys(result.productsByCategory).forEach((categoryId) => {
                        const categoryProducts = result.productsByCategory[categoryId];
                        const categoryTitle = titlesToUse[categoryId] || categoryProducts[0]?.categories?.name || categoryProducts[0]?.section_title || 'غير محدد';

                        // Check if this is the أروما category
                        const isAromaCategory = categoryTitle === 'أروما' || categoryTitle.includes('أروما');

                        const mappedProducts = categoryProducts.map((product: any) => ({
                            ...product,
                            code: product.product_code,
                            badgeColor: product.badge_color,
                            isPackage: product.is_package,
                            icon: iconMap[product.icon_name] || Sparkles,
                            available_stock: product.available_stock || 0,
                            purchase_count: product.purchase_count || 0,
                        }));

                        if (isAromaCategory) {
                            // Group aroma products by package type
                            mappedProducts.forEach((product: any) => {
                                let packageType = '';
                                if (product.name.includes('باقة أساسية') || product.product_code.includes('BASIC')) {
                                    packageType = 'basic';
                                } else if (product.name.includes('باقة مميزة') || product.product_code.includes('PREMIUM')) {
                                    packageType = 'luxury';
                                } else if (product.name.includes('باقة فاخرة') || product.product_code.includes('LUXURY')) {
                                    packageType = 'premium';
                                }

                                if (packageType) {
                                    if (!aromaGrouped[packageType]) {
                                        aromaGrouped[packageType] = [];
                                    }
                                    aromaGrouped[packageType].push(product);
                                }
                            });
                        } else {
                            // Regular category - add to grouped
                            grouped[categoryId] = mappedProducts;
                            titles[categoryId] = categoryTitle;
                        }
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
                setAromaProducts(aromaGrouped);
            } catch (error: any) {
                console.error('Error fetching products:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // Fetch promotional banner
    const fetchBanner = useCallback(async () => {
        try {
            const response = await fetch(`/api/promotional-banner?ts=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' },
            });
            const result = await response.json();
            setPromotionalBanner(result.banner || null);
        } catch (error) {
            console.error('Error fetching promotional banner:', error);
            setPromotionalBanner(null);
        }
    }, []);

    useEffect(() => {
        fetchBanner();
    }, [fetchBanner]);

    useEffect(() => {
        const handleFocus = () => fetchBanner();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchBanner]);

    // Fetch latest reviews
    useEffect(() => {
        const fetchReviews = async () => {
            setReviewsLoading(true);
            try {
                const response = await fetch('/api/reviews?limit=12');
                const result = await response.json();

                if (response.ok) {
                    setReviews(result.reviews || []);
                } else {
                    console.error('Error fetching reviews:', result.error);
                    setReviews([]);
                }
            } catch (error) {
                console.error('Error fetching reviews:', error);
                setReviews([]);
            } finally {
                setReviewsLoading(false);
            }
        };

        fetchReviews();
    }, []);

    // Countdown timer for promotion
    useEffect(() => {
        if (!promotionalBanner || !promotionalBanner.expiration_date) {
            // No countdown if no banner or no expiration date
            setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            return;
        }

        const targetDate = new Date(promotionalBanner.expiration_date).getTime();

        const updateCountdown = () => {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) {
                setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return;
            }

            setCountdown({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000),
            });
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [promotionalBanner]);

    // Scroll to Netflix category when scrollTo=netflix parameter is present
    useEffect(() => {
        const scrollTo = searchParams.get('scrollTo');
        if (scrollTo === 'netflix' && !loading && Object.keys(productsByCategory).length > 0) {
            // Find the Netflix category by checking category titles
            const netflixCategoryId = Object.keys(productsByCategory).find((categoryId) => {
                const title = categoryTitles[categoryId] || '';
                const titleLower = title.toLowerCase();
                return titleLower.includes('نت') && (titleLower.includes('flix') || titleLower.includes('فليكس')) || titleLower.includes('netflix');
            });

            if (netflixCategoryId) {
                // Wait a bit for the page to render, then scroll
                setTimeout(() => {
                    const element = document.getElementById(`category-${netflixCategoryId}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // Remove the query parameter from URL after scrolling
                        router.replace('/subscribe', { scroll: false });
                    }
                }, 500);
            }
        }
    }, [searchParams, loading, productsByCategory, categoryTitles, router]);

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
                                <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-1 md:gap-6 mt-12">
                                    {/* Manual Aroma Box in Banner */}
                                    <div
                                        onClick={() => {
                                            const element = document.querySelector('section.bg-\\[\\#101622\\]'); // Selects the Aroma section
                                            element?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        className="group relative cursor-pointer"
                                    >
                                        <div
                                            className="relative h-full bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-xl md:rounded-2xl p-2 md:p-6 hover:border-slate-500 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 md:hover:-translate-y-2 overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none z-0" />
                                            <div className="flex items-center justify-center mb-1 md:mb-4 h-8 md:h-16">
                                                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1 md:p-2 border border-white/20 group-hover:scale-110 transition-transform">
                                                    <img src="/logos/iptv3d.png" alt="Aroma logo" className="h-6 w-6 md:h-12 md:w-12 object-contain" />
                                                </div>
                                            </div>
                                            <div className="relative z-10 text-center">
                                                <h3 className="text-[10px] md:text-xl font-bold text-white mb-0 md:mb-2 group-hover:text-blue-300 transition-colors truncate">
                                                    باقات أروما
                                                </h3>
                                                <p className="hidden md:block text-sm text-slate-400 mb-4">
                                                    حصري ومميز
                                                </p>
                                                <div className="hidden md:flex items-center justify-center gap-2 text-blue-400">
                                                    <span className="text-sm font-semibold">استكشف الباقات</span>
                                                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {Object.keys(productsByCategory).slice(0, 3).map((categoryId, idx) => {
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
                                                return '/logos/shahid.svg';
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
                                                    className="relative h-full bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-xl md:rounded-2xl p-2 md:p-6 hover:border-slate-500 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 md:hover:-translate-y-2 overflow-hidden"
                                                    style={{ animationDelay: `${delay}ms` }}
                                                >
                                                    {/* Netflix Icon Overlay for Netflix category - Always visible, behind gradient */}
                                                    {isNetflixCategory && (
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none z-0">
                                                            <img
                                                                src="/logos/netflix.svg"
                                                                alt="Netflix"
                                                                className="h-10 w-10 md:h-40 md:w-40 object-contain"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Gradient Overlay */}
                                                    <div className={`absolute inset-0 bg-gradient-to-br ${firstProduct.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none z-0`} />

                                                    {/* Category Icon/Logo */}
                                                    <div className="flex items-center justify-center mb-1 md:mb-4 h-8 md:h-16">
                                                        {categoryIcon ? (
                                                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1 md:p-2 border border-white/20 group-hover:scale-110 transition-transform">
                                                                <img
                                                                    src={categoryIcon}
                                                                    alt={`${categoryTitle} logo`}
                                                                    className="h-6 w-6 md:h-12 md:w-12 object-contain"
                                                                />
                                                            </div>
                                                        ) : firstProduct.logos && firstProduct.logos.length > 0 ? (
                                                            <div className="flex items-center gap-1 md:gap-2">
                                                                {firstProduct.logos.slice(0, 2).map((logo: string, logoIdx: number) => (
                                                                    <div key={logoIdx} className="bg-white/10 backdrop-blur-sm rounded-lg p-1 md:p-2 border border-white/20 group-hover:scale-110 transition-transform">
                                                                        <img
                                                                            src={logo}
                                                                            alt={`${categoryTitle} logo`}
                                                                            className="h-4 w-4 md:h-8 md:w-8 object-contain"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-4 border border-white/20 group-hover:scale-110 transition-transform">
                                                                <Package className="h-4 w-4 md:h-10 md:w-10 text-white" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Category Info */}
                                                    <div className="relative z-10 text-center">
                                                        <h3 className="text-[10px] md:text-xl font-bold text-white mb-0 md:mb-2 group-hover:text-blue-300 transition-colors truncate">
                                                            {categoryTitle}
                                                        </h3>
                                                        <p className="hidden md:block text-sm text-slate-400 mb-4">
                                                            {productCount} {productCount === 1 ? 'منتج' : 'منتجات'} متاحة
                                                        </p>
                                                        <div className="hidden md:flex items-center justify-center gap-2 text-blue-400">
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

                    {/* Aroma Packages Special Section */}
                    {!loading && Object.keys(aromaProducts).length > 0 && (
                        <section className="py-16 bg-[#101622] mb-20">
                            <div className="container mx-auto px-4">
                                <div className="mb-12 flex items-center justify-start gap-6">
                                    {/* IPTV SMARTERS PRO Logo */}
                                    <div className="flex-shrink-0">
                                        <img
                                            src="/logos/iptv3d.png"
                                            alt="IPTV SMARTERS PRO"
                                            className="h-32 w-32 md:h-40 md:w-40 lg:h-48 lg:w-48 object-contain"
                                        />
                                    </div>
                                    <div>
                                        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-2">
                                            باقات أروما: اختر{' '}
                                            <span className="text-[#0d59f2]">باقتك</span>
                                        </h1>
                                        <p className="text-white/60 text-base lg:text-lg font-normal leading-normal max-w-2xl">
                                            اختر الباقة المناسبة لك. كل باقة تفتح لك إمكانيات جديدة ومحتوى حصري في عالم أروما!
                                        </p>
                                    </div>
                                </div>

                                {/* Aroma Categories - Arena Challenge Design */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-end justify-center">
                                    {[
                                        {
                                            key: 'basic',
                                            title: 'باقة أساسية',
                                            tier: 'الباقة الأولى: مسلسلات وأفلام ',
                                            cardClass: 'starter-card',
                                            playerClass: 'starter-player',
                                            features: ['خاصية التحميل والتشغيل بدون انترنت ', 'جودة فوركي', "18,000 فلم ومسلسلات"]
                                        },
                                        {
                                            key: 'luxury',
                                            title: 'باقة مميزة',
                                            tier: 'الباقة الثانية: مناسبة لدوري روشن ',
                                            cardClass: 'premium-card',
                                            playerClass: 'premium-player',
                                            features: ["بث جميع مباريات دوري روشن", 'جودة Full HD & 4K', "جميع قنوات ثمانية", "جميع مميزات الباقة الأساسية"]
                                        },
                                        {
                                            key: 'premium',
                                            title: 'باقة فاخرة',
                                            tier: 'الباقة الثالثة: المجد الكامل',
                                            cardClass: 'special-card',
                                            playerClass: 'special-player',
                                            isPopular: true,
                                            features: ["جميع الدوريات المحلية والأوروبية", 'جودة 4K/UHD', "جميع قنوات ثمانية و beIN", 'جميع مميزات الباقة الأساسية والمميزة ']
                                        },
                                    ].map((categoryConfig) => {
                                        const categoryProducts = aromaProducts[categoryConfig.key] || [];
                                        if (categoryProducts.length === 0) return null;

                                        // Sort products by duration (3, 6, 12 months)
                                        const sortedProducts = [...categoryProducts].sort((a, b) => {
                                            const getDurationOrder = (duration: string) => {
                                                if (duration.includes('3')) return 1;
                                                if (duration.includes('6')) return 2;
                                                if (duration.includes('12')) return 3;
                                                return 0;
                                            };
                                            return getDurationOrder(a.duration) - getDurationOrder(b.duration);
                                        });

                                        return (
                                            <div
                                                key={categoryConfig.key}
                                                className={`plan-card flex flex-col ${categoryConfig.cardClass} ${categoryConfig.isPopular ? 'popular' : ''
                                                    }`}
                                            >
                                                {/* Main Event Badge */}
                                                {categoryConfig.isPopular && (
                                                    <div className="absolute top-4 right-4 bg-[#0d59f2] text-white text-xs font-bold uppercase px-3 py-1 rounded-full z-30">
                                                        الحدث الرئيسي
                                                    </div>
                                                )}

                                                {/* Player Visual Container */}
                                                <div
                                                    className={`player-visual-container ${categoryConfig.playerClass} ${categoryConfig.isPopular ? 'h-64' : 'h-56'
                                                        }`}
                                                    style={categoryConfig.isPopular ? {
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        clipPath: 'polygon(0 0, 100% 0, 100% 97%, 97% 100%, 0% 100%)'
                                                    } : {}}
                                                >
                                                    <div className="player-visual" style={categoryConfig.isPopular ? { height: '100%', position: 'relative' } : { position: 'relative', height: '100%' }}>
                                                        {categoryConfig.key === 'basic' ? (
                                                            <img
                                                                src="/logos/starterpack.png"
                                                                alt={categoryConfig.title}
                                                                className="absolute inset-0 w-full h-full object-cover"
                                                                style={{
                                                                    objectPosition: 'center center'
                                                                }}
                                                            />
                                                        ) : categoryConfig.key === 'premium' ? (
                                                            <img
                                                                src="/logos/premiumpack.png"
                                                                alt={categoryConfig.title}
                                                                className="absolute inset-0 w-full h-full object-cover"
                                                                style={{
                                                                    objectPosition: 'center center'
                                                                }}
                                                            />
                                                        ) : categoryConfig.key === 'luxury' ? (
                                                            <img
                                                                src="/logos/specialpack.png"
                                                                alt={categoryConfig.title}
                                                                className="absolute inset-0 w-full h-full object-cover"
                                                                style={{
                                                                    objectPosition: 'center center'
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <ImageIcon className="w-16 h-16 md:w-20 md:h-20 text-white/30" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card Content */}
                                                <div className="p-6 flex flex-col gap-6 flex-grow">
                                                    {/* Category Title and Tier */}
                                                    <div className="text-center">
                                                        <h3 className="text-2xl font-bold text-white">{categoryConfig.title}</h3>
                                                        <p className="text-sm text-white/60 mt-1">{categoryConfig.tier}</p>
                                                    </div>

                                                    {/* Features List */}
                                                    <ul className="space-y-3 text-white/90 text-sm flex-grow">
                                                        {categoryConfig.features.map((feature, i) => (
                                                            <li key={i} className="flex items-center gap-3">
                                                                <Check className="text-[#0d59f2] w-5 h-5 flex-shrink-0" />
                                                                {feature}
                                                            </li>
                                                        ))}
                                                    </ul>

                                                    {/* Pricing Options */}
                                                    <div className="flex flex-col gap-3">
                                                        {sortedProducts.map((product: any, i: number) => {
                                                            const finalPrice = product.discounted_price && product.discounted_price < product.price
                                                                ? product.discounted_price
                                                                : product.price;

                                                            // Highlight the 12-month option
                                                            const isHighlight = product.duration.includes('12');
                                                            const isPopularHighlight = categoryConfig.isPopular && isHighlight;

                                                            return (
                                                                <div
                                                                    key={product.id}
                                                                    className={`flex justify-between items-center p-3 rounded-lg ${isPopularHighlight
                                                                        ? 'bg-[#0d59f2]/20 border border-[#0d59f2]'
                                                                        : 'bg-black/20 border border-white/10'
                                                                        }`}
                                                                >
                                                                    <div>
                                                                        <p className="font-bold text-white">{product.duration}</p>
                                                                        {product.discounted_price && product.discounted_price < product.price ? (
                                                                            <div>
                                                                                <p className="text-sm text-white/60 line-through" style={{ fontFamily: 'Poppins, sans-serif' }}>{product.price} ريال</p>
                                                                                <p className="text-sm text-red-400 font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>{product.discounted_price} ريال</p>
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-sm text-white/60" style={{ fontFamily: 'Poppins, sans-serif' }}>{product.price} ريال</p>
                                                                        )}
                                                                    </div>
                                                                    <Button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            if (product.available_stock > 0) {
                                                                                addItem({
                                                                                    product_code: product.code,
                                                                                    product_name: product.name,
                                                                                    price: finalPrice,
                                                                                    quantity: 1,
                                                                                    image: product.image || '',
                                                                                });
                                                                                router.push('/cart');
                                                                            }
                                                                        }}
                                                                        disabled={product.available_stock === 0}
                                                                        className={`${isHighlight
                                                                            ? categoryConfig.isPopular
                                                                                ? 'popular-button bg-[#0d59f2] hover:bg-[#0d59f2]/90'
                                                                                : 'bg-[#0d59f2] hover:bg-[#0d59f2]/90'
                                                                            : 'bg-[#0d59f2]/50 hover:bg-[#0d59f2]/70'
                                                                            } text-white font-bold text-sm px-4 py-2 ${product.available_stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                    >
                                                                        {product.available_stock === 0 ? 'نفد' : 'اشتري الآن'}
                                                                    </Button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    )}

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

                            const isBlackFridayActive =
                                promotionalBanner?.banner_type === 'blackfriday' && promotionalBanner?.is_enabled !== false;

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




                                                        {/* Promo Banner */}
                                                        {product.promo_banner_text && (
                                                            <div className="absolute top-2 right-2 z-20 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs md:text-sm font-bold px-3 md:px-4 py-1 md:py-2 rounded-lg shadow-lg">
                                                                {product.promo_banner_text}
                                                            </div>
                                                        )}

                                                        {/* Package Header with Logos - Clickable Link */}
                                                        <Link href={`/subscribe/${product.code}`} className="block cursor-pointer">
                                                            <div className={`relative min-h-[12rem] md:min-h-[16rem] h-auto w-full overflow-hidden ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-gradient-to-br from-slate-700 to-slate-800' : `bg-gradient-to-br ${product.gradient}`} p-6 md:p-8`}>
                                                                <div className="h-full flex flex-col justify-between gap-4">
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
                                                                {product.discounted_price && product.discounted_price < product.price ? (
                                                                    <>
                                                                        <div className="flex items-baseline justify-center gap-2 md:gap-3 mb-2">
                                                                            <span className="text-4xl md:text-6xl font-extrabold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{product.discounted_price}</span>
                                                                            <span className="text-xl md:text-2xl text-slate-400">ريال</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-center gap-2 flex-wrap mb-2">
                                                                            <span className="text-sm md:text-base text-slate-400 line-through" style={{ fontFamily: 'Poppins, sans-serif' }}>{product.price}</span>
                                                                            <span className="text-sm md:text-base text-slate-400">ريال</span>
                                                                            <span className="text-sm md:text-base font-bold text-red-400">
                                                                                ({Math.round(((product.price - product.discounted_price) / product.price) * 100)}% خصم)
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-slate-400 text-sm md:text-base">قيمة استثنائية</p>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="flex items-baseline justify-center gap-2 md:gap-3 mb-2">
                                                                            <span className="text-4xl md:text-6xl font-extrabold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{product.price}</span>
                                                                            <span className="text-xl md:text-2xl text-slate-400">ريال</span>
                                                                        </div>
                                                                        <p className="text-slate-400 text-sm md:text-base">قيمة استثنائية</p>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* Stock Display - HIDDEN for smaller cards */}
                                                            {/* {product.available_stock !== undefined && (
                                                                <div className="mb-4 md:mb-6 p-3 md:p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-slate-400 text-sm md:text-base">المخزون المتاح:</span>
                                                                        <span className={`font-bold text-sm md:text-base ${product.available_stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                            {product.available_stock > 0 ? `${product.available_stock} متاح` : 'نفد المخزون'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )} */}

                                                            {/* Purchase Count Display - HIDDEN for smaller cards */}
                                                            {/* {product.purchase_count !== undefined && product.purchase_count > 0 && (
                                                                <div className="mb-4 md:mb-6 p-2 md:p-3 bg-blue-900/20 rounded-lg border border-blue-700/50">
                                                                    <div className="flex items-center justify-center">
                                                                        <span className="text-blue-300 text-xs md:text-sm font-semibold">
                                                                            تم شراؤه من قبل {product.purchase_count} شخص
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )} */}

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
                                                                                price: product.discounted_price && product.discounted_price < product.price ? product.discounted_price : product.price,
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

                                                    {/* Black Friday Badge */}
                                                    {isBlackFridayActive && promotionalBanner && (
                                                        <div className="absolute top-2 left-0 z-20 transform -rotate-12 origin-left">
                                                            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-3 py-1 shadow-lg rounded-md">
                                                                <span className="text-[10px] md:text-xs font-bold whitespace-nowrap">{promotionalBanner.title}</span>
                                                            </div>
                                                        </div>
                                                    )}

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
                                                            <CardTitle className="text-sm md:text-xl text-white mb-1 md:mb-2 group-hover:text-blue-300 transition-colors">
                                                                {product.name}
                                                            </CardTitle>
                                                            {/* <CardDescription className="text-slate-400 text-xs md:text-sm min-h-[32px] md:min-h-[40px]">
                                                                {product.description}
                                                            </CardDescription> */}
                                                        </Link>
                                                    </CardHeader>

                                                    <CardContent className="mt-auto pb-3 md:pb-6 px-3 md:px-6">
                                                        {/* Price */}
                                                        <div className="mb-3 md:mb-6 text-center">
                                                            {product.discounted_price && product.discounted_price < product.price ? (
                                                                <>
                                                                    <div className="flex items-baseline justify-center gap-1 md:gap-2">
                                                                        <span className="text-2xl md:text-5xl font-extrabold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{product.discounted_price}</span>
                                                                        <span className="text-sm md:text-xl text-slate-400">ريال</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap mt-1 md:mt-2">
                                                                        <span className="text-xs md:text-sm text-slate-400 line-through" style={{ fontFamily: 'Poppins, sans-serif' }}>{product.price}</span>
                                                                        <span className="text-xs md:text-sm text-slate-400">ريال</span>
                                                                        <span className="text-xs md:text-sm font-bold text-red-400">
                                                                            ({Math.round(((product.price - product.discounted_price) / product.price) * 100)}% خصم)
                                                                        </span>
                                                                    </div>
                                                                    {product.duration !== '1 شهر' && (
                                                                        <p className="text-xs md:text-sm text-slate-500 mt-1 md:mt-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                                                            {Math.round(product.discounted_price / (product.duration.includes('3') ? 3 : product.duration.includes('6') ? 6 : 12))} ريال/شهر
                                                                        </p>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-baseline justify-center gap-1 md:gap-2">
                                                                        <span className="text-2xl md:text-5xl font-extrabold text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{product.price}</span>
                                                                        <span className="text-sm md:text-xl text-slate-400">ريال</span>
                                                                    </div>
                                                                    {product.duration !== '1 شهر' && (
                                                                        <p className="text-xs md:text-sm text-slate-500 mt-1 md:mt-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                                                            {Math.round(product.price / (product.duration.includes('3') ? 3 : product.duration.includes('6') ? 6 : 12))} ريال/شهر
                                                                        </p>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Stock Display - HIDDEN for smaller cards */}
                                                        {/* {product.available_stock !== undefined && (
                                                            <div className="mb-3 md:mb-4 p-2 md:p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-slate-400 text-xs md:text-sm">المخزون:</span>
                                                                    <span className={`font-bold text-xs md:text-sm ${product.available_stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {product.available_stock > 0 ? `${product.available_stock} متاح` : 'نفد'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )} */}

                                                        {/* Purchase Count Display - HIDDEN for smaller cards */}
                                                        {/* {product.purchase_count !== undefined && product.purchase_count > 0 && (
                                                            <div className="mb-3 md:mb-4 p-2 md:p-3 bg-blue-900/20 rounded-lg border border-blue-700/50">
                                                                <div className="flex items-center justify-center">
                                                                    <span className="text-blue-300 text-xs font-semibold">
                                                                        تم شراؤه من قبل {product.purchase_count} شخص
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )} */}

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
                                                                            price: product.discounted_price && product.discounted_price < product.price ? product.discounted_price : product.price,
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
                {/* FAQ Section */}
                <section className="py-20 bg-gradient-to-b from-black via-slate-900 to-black">
                    <div className="container mx-auto px-4">
                        <div className="max-w-4xl mx-auto">
                            <div className="text-center mb-12">
                                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-arabic)' }}>
                                    الأسئلة الشائعة
                                </h2>
                                <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto" style={{ fontFamily: 'var(--font-arabic)' }}>
                                    نعرض لكم أكثر الأسئلة التي ترد إلينا مع إجاباتها لتعرف أكثر عن الخدمة ومدى ملائمتها لك وكيفية تشغيلها
                                </p>
                            </div>

                            <Accordion type="single" collapsible className="w-full space-y-4">
                                <AccordionItem value="item-1" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-6 hover:border-blue-500/50 transition-colors">
                                    <AccordionTrigger className="text-white hover:no-underline py-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        <span className="text-lg md:text-xl font-semibold">
                                            1. ما هي سرعة الإنترنت المناسبة لتشغيل الخدمة ؟
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-slate-300 text-base md:text-lg pb-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        لكي تحظي بخدمة مميزة بدون تقطيع يجب ألا تقل سرعة الإنترنت لديك عن 4 ميجا بت بالثانية ، بعض القنوات لدينا تعمل أيضاً مع سرعة إنترنت 2 ميجا بت بالثانية.
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-2" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-6 hover:border-blue-500/50 transition-colors">
                                    <AccordionTrigger className="text-white hover:no-underline py-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        <span className="text-lg md:text-xl font-semibold">
                                            2. ما هي المدة التي يستغرها إرسال وتشغيل الإشتراك بعد الدفع؟
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-slate-300 text-base md:text-lg pb-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        لا يستغرق إرسال وتشغيل الملف سوي عدة دقائق فقط وبحد أقصي ساعة بعد إتمام عملية الدفع لتبدأ بالمشاهدة والإستمتاع بالخدمة.
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-3" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-6 hover:border-blue-500/50 transition-colors">
                                    <AccordionTrigger className="text-white hover:no-underline py-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        <span className="text-lg md:text-xl font-semibold">
                                            3. كيف سأتمكن من تشغيل الخدمة ؟
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-slate-300 text-base md:text-lg pb-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        سيقدم طاقم الدعم الفني لدينا كافة الإرشادات والتعليمات الخاصة بتشغيل الملف وسيتابع معك حتي تتمكن من تشغيل الملف بكل سهولة على الواتس اب
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-4" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-6 hover:border-blue-500/50 transition-colors">
                                    <AccordionTrigger className="text-white hover:no-underline py-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        <span className="text-lg md:text-xl font-semibold">
                                            4. هل يمكنني وضع الإشتراك في أكثر من جهاز
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-slate-300 text-base md:text-lg pb-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        نعم بشرط أن يعمل الاشتراك على جهاز واحد فقط في نفس وقت المشاهدة , في حالة تشغيل والمشاهدة على أكثر من جهاز في نفس الوقت فلن يعمل ان كنت تريد تشغيل الاشتراك على اكثر من جهاز في نفس الوقت ستحتاج الى اشتراك اخر..
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-5" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-6 hover:border-blue-500/50 transition-colors">
                                    <AccordionTrigger className="text-white hover:no-underline py-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        <span className="text-lg md:text-xl font-semibold">
                                            5. ما هي طرق الدفع المتوفرة لديكم ؟
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-slate-300 text-base md:text-lg pb-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        يتوفر لدينا طرق دفع سهلة ومتعددة عبر التحويلات البنكية داخل السعودية أو عن طريق إرسال بطاقات شحن سوا
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-6" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-6 hover:border-blue-500/50 transition-colors">
                                    <AccordionTrigger className="text-white hover:no-underline py-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        <span className="text-lg md:text-xl font-semibold">
                                            6. هل يمكنني الحصول علي فترة للتجربة ؟
                                        </span>

                                    </AccordionTrigger>
                                    <AccordionContent className="text-slate-300 text-base md:text-lg pb-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        نعم يمكنك تجربة الخدمة  قبل الإشتراك للتأكد من جودة الخدمة ومدي ملائمتها لأجهزتك وسرعة إتصالك بالإنترنت.
                                        <div className="mt-4">
                                            <Link href="https://mkantvplus.com/trial" target="_blank" rel="noopener noreferrer">
                                                <Button
                                                    variant="outline"
                                                    className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                                                    style={{ fontFamily: 'var(--font-arabic)' }}
                                                >
                                                    اضغط هنا لطلب تجربة
                                                </Button>
                                            </Link>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-7" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-6 hover:border-blue-500/50 transition-colors">
                                    <AccordionTrigger className="text-white hover:no-underline py-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        <span className="text-lg md:text-xl font-semibold">
                                            7. هل يمكنني تغيير الباقة لاحقاً؟
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-slate-300 text-base md:text-lg pb-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        نعم، يمكنك ترقية أو تغيير الباقة في أي وقت بالتواصل مع الدعم.
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-8" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-6 hover:border-blue-500/50 transition-colors">
                                    <AccordionTrigger className="text-white hover:no-underline py-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        <span className="text-lg md:text-xl font-semibold">
                                            8. هل يشتغل على جهازي؟
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-slate-300 text-base md:text-lg pb-6 text-right" style={{ fontFamily: 'var(--font-arabic)' }}>
                                        تطبيقنا ييشتغل على جميع الأجهزة الذكية وأجهزة الكمبيوتر والشاشات، يمكنك تحميل التطبيق من المتجر المناسب لجهازك.
                                        <div className="mt-4">
                                            <Link href="/tarkeeb">
                                                <Button
                                                    variant="outline"
                                                    className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                                                    style={{ fontFamily: 'var(--font-arabic)' }}
                                                >
                                                    اضغط هنا لمعرفة الأجهزة المدعومة
                                                </Button>
                                            </Link>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </div>
                </section>
                {/* Customer Reviews Carousel Section */}
                <section className="py-20 bg-black relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-black"></div>

                    <div className="container mx-auto px-4 relative z-10">
                        <div className="max-w-7xl mx-auto">
                            <div className="text-center mb-12">
                                <h2 className="text-4xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-arabic)' }}>
                                    تقييمات العملاء
                                </h2>
                                <p className="text-xl text-slate-400" style={{ fontFamily: 'var(--font-arabic)' }}>
                                    شاهد ما يقوله عملاؤنا عن خدماتنا
                                </p>
                            </div>

                            {reviewsLoading ? (
                                <div className="text-center py-12">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                    <p className="text-slate-400 mt-4" style={{ fontFamily: 'var(--font-arabic)' }}>جاري تحميل التقييمات...</p>
                                </div>
                            ) : reviews.length === 0 ? (
                                <div className="text-center py-12">
                                    <Star className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                    <p className="text-slate-400 text-lg" style={{ fontFamily: 'var(--font-arabic)' }}>لا توجد تقييمات بعد</p>
                                </div>
                            ) : (
                                <Carousel
                                    opts={{
                                        align: "start",
                                        loop: true,
                                        slidesToScroll: 1,
                                    }}
                                    className="w-full"
                                >
                                    <CarouselContent className="-ml-2 md:-ml-4">
                                        {reviews.map((review) => (
                                            <CarouselItem key={review.id} className="pl-2 md:pl-4 basis-[85%] sm:basis-1/2 lg:basis-1/3">
                                                <div className="group relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 rounded-2xl p-4 md:p-6 h-full hover:border-blue-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20 flex flex-col min-h-[200px]">
                                                    {/* Rating Stars */}
                                                    <div className="flex items-center gap-1 mb-4">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                className={`w-5 h-5 ${star <= review.rating
                                                                    ? 'fill-yellow-400 text-yellow-400'
                                                                    : 'text-slate-600'
                                                                    }`}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Review Comment */}
                                                    {review.comment ? (
                                                        <p className="text-slate-300 text-sm md:text-base mb-4 flex-grow leading-relaxed line-clamp-4" style={{ fontFamily: 'var(--font-arabic)' }}>
                                                            "{review.comment}"
                                                        </p>
                                                    ) : (
                                                        <p className="text-slate-500 text-sm mb-4 flex-grow italic" style={{ fontFamily: 'var(--font-arabic)' }}>
                                                            تقييم بدون تعليق
                                                        </p>
                                                    )}

                                                    {/* User Info and Date */}
                                                    <div className="mt-auto pt-4 border-t border-slate-700/50">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                                                    <span className="text-white font-bold text-sm">
                                                                        {review.user_email.charAt(0).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <p className="text-white font-semibold text-sm">{review.user_email}</p>
                                                                </div>
                                                            </div>
                                                            <p className="text-slate-500 text-xs">
                                                                {new Date(review.created_at).toLocaleDateString('ar-SA', {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>

                                    {/* Navigation Buttons */}
                                    <CarouselPrevious className="left-2 md:-left-12 bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white hover:text-blue-400 transition-all duration-200 shadow-xl z-10 hidden sm:flex" />
                                    <CarouselNext className="right-2 md:-right-12 bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-white hover:text-blue-400 transition-all duration-200 shadow-xl z-10 hidden sm:flex" />
                                </Carousel>
                            )}
                        </div>
                    </div>
                </section>
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
