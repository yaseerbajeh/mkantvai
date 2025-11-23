'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Clapperboard, Target, Sparkles, ChevronLeft, ChevronRight, Film, ArrowLeft, ArrowRight, ShoppingCart, Tv, Smartphone, Monitor, Laptop, CheckCircle2, Shield, Zap, Bot, TrendingUp, Star, Languages, Download, Check, Package, Loader2, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MovieCard from '@/components/MovieCard';
import MovieModal from '@/components/MovieModal';
import { type Movie } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/lib/cart-context';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [latestMovies, setLatestMovies] = useState<Movie[]>([]);
  const [latestSeries, setLatestSeries] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [topRatedSeries, setTopRatedSeries] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [topRatedTab, setTopRatedTab] = useState<'movies' | 'series'>('movies');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
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
  const [bannerLoading, setBannerLoading] = useState(true);
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [productsByCategory, setProductsByCategory] = useState<{ [key: string]: any[] }>({});
  const [categoryTitles, setCategoryTitles] = useState<{ [key: string]: string }>({});
  const [productsLoading, setProductsLoading] = useState(true);
  const [aromaProducts, setAromaProducts] = useState<{ [key: string]: any[] }>({});
  
  const { addItem } = useCart();
  const topRatedScrollRef = useRef<HTMLDivElement>(null);
  const trendingScrollRef = useRef<HTMLDivElement>(null);

  // Icon mapping for products
  const iconMap: { [key: string]: any } = {
    sparkles: Sparkles,
    star: Star,
    check: Check,
    package: Package,
    crown: CheckCircle2,
    zap: Zap,
  };

  const sectionGradients = [
    'from-purple-600/20 via-blue-600/20 to-purple-600/20',
    'from-red-600/20 via-rose-200/20 to-red-600/20',
    'from-green-600/20 via-emerald-600/20 to-green-600/20',
    'from-blue-600/20 via-cyan-600/20 to-teal-600/20',
  ];
  
  const fetchBanner = useCallback(async () => {
    try {
      setBannerLoading(true);
      const response = await fetch(`/api/promotional-banner?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const result = await response.json();
      setPromotionalBanner(result.banner || null);
    } catch (error) {
      console.error('Error fetching promotional banner:', error);
      setPromotionalBanner(null);
    } finally {
      setBannerLoading(false);
    }
  }, []);

  // Fetch promotional banner on mount
  useEffect(() => {
    fetchBanner();
  }, [fetchBanner]);

  // Re-fetch banner when window regains focus to ensure latest status after admin changes
  useEffect(() => {
    const handleFocus = () => {
        fetchBanner();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchBanner]);
  
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
      
      if (distance > 0) {
        setCountdown({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        // Banner expired, remove it
        setPromotionalBanner(null);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [promotionalBanner]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
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

        // Group products by category
        const grouped: { [key: string]: any[] } = {};
        const titles: { [key: string]: string } = {};
        const aromaGrouped: { [key: string]: any[] } = {};

        const productsToGroup = result.productsByCategory || result.productsBySection || {};
        const titlesToUse = result.categoryTitles || result.sectionTitles || {};

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
          result.products?.forEach((product: any) => {
            const categoryId = product.category_id || `section-${product.section}`;
            const categoryName = product.categories?.name || product.section_title || `القسم ${product.section}`;
            const isAromaCategory = categoryName === 'أروما' || categoryName.includes('أروما');
            
            const mappedProduct = {
              ...product,
              code: product.product_code,
              badgeColor: product.badge_color,
              isPackage: product.is_package,
              icon: iconMap[product.icon_name] || Sparkles,
              available_stock: product.available_stock || 0,
              purchase_count: product.purchase_count || 0,
            };
            
            if (isAromaCategory) {
              // Group aroma products by package type
              let packageType = '';
              if (product.name.includes('باقة أساسية') || product.product_code.includes('BASIC')) {
                packageType = 'basic';
              } else if (product.name.includes('باقة مميزة') || product.product_code.includes('PREMIUM')) {
                packageType = 'premium';
              } else if (product.name.includes('باقة فاخرة') || product.product_code.includes('LUXURY')) {
                packageType = 'luxury';
              }
              
              if (packageType) {
                if (!aromaGrouped[packageType]) {
                  aromaGrouped[packageType] = [];
                }
                aromaGrouped[packageType].push(mappedProduct);
              }
            } else {
              // Regular category
              if (!grouped[categoryId]) {
                grouped[categoryId] = [];
                titles[categoryId] = categoryName;
              }
              grouped[categoryId].push(mappedProduct);
            }
          });
        }

        // Sort aroma products by duration (3, 6, 12 months)
        Object.keys(aromaGrouped).forEach((key) => {
          aromaGrouped[key].sort((a, b) => {
            const getDurationOrder = (duration: string) => {
              if (duration.includes('3')) return 1;
              if (duration.includes('6')) return 2;
              if (duration.includes('12')) return 3;
              return 0;
            };
            return getDurationOrder(a.duration) - getDurationOrder(b.duration);
          });
        });

        setProductsByCategory(grouped);
        setCategoryTitles(titles);
        setAromaProducts(aromaGrouped);
      } catch (error: any) {
        console.error('Error fetching products:', error);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Scroll to Netflix category when scrollTo=netflix parameter is present
  useEffect(() => {
    const scrollTo = searchParams.get('scrollTo');
    if (scrollTo === 'netflix' && !productsLoading && Object.keys(productsByCategory).length > 0) {
      // Find the Netflix category by checking category titles
      const netflixCategoryId = Object.keys(productsByCategory).find((categoryId) => {
        const title = categoryTitles[categoryId] || '';
        const titleLower = title.toLowerCase();
        return (titleLower.includes('نت') && (titleLower.includes('flix') || titleLower.includes('فليكس'))) || titleLower.includes('netflix');
      });

      if (netflixCategoryId) {
        // Scroll immediately without delay
        const element = document.getElementById(`category-${netflixCategoryId}`);
        if (element) {
          // Use instant scroll to jump directly to the section
          window.scrollTo({
            top: element.offsetTop - 100, // Offset for header
            behavior: 'auto' // Instant scroll, no animation
          });
          // Remove the query parameter from URL
          router.replace('/', { scroll: false });
        }
      }
    }
  }, [searchParams, productsLoading, productsByCategory, categoryTitles, router]);

  useEffect(() => {
    const fetchLatestContent = async () => {
      try {
        // Trending Movies (week)
        const trendingResp = await fetch('/api/tmdb/trending?type=movie');
        if (!trendingResp.ok) {
          console.error('Trending API error:', trendingResp.status, await trendingResp.text());
          setTrendingMovies([]);
        } else {
          const trendingJson = await trendingResp.json();
          if (trendingJson.error) {
            console.error('Trending API error:', trendingJson.error);
            setTrendingMovies([]);
          } else {
            const trendingMapped = (trendingJson.items || []).slice(0, 10).map((m: any) => ({
          id: String(m.tmdb_id),
          tmdb_id: m.tmdb_id,
          type: 'movie',
          title: m.title,
          synopsis: m.overview,
          year: m.year,
          genre: null,
          platform: null,
          rating: String(m.rating ?? ''),
          duration: null,
          url: m.poster_url,
          new: null,
          note: null,
        })) as unknown as Movie[];
            setTrendingMovies(trendingMapped);
          }
        }

        // Latest Movies (Now Playing)
        const nowMoviesResp = await fetch('/api/tmdb/now-playing?type=movie');
        if (!nowMoviesResp.ok) {
          console.error('Now Playing API error:', nowMoviesResp.status, await nowMoviesResp.text());
          setLatestMovies([]);
        } else {
          const nowMovies = await nowMoviesResp.json();
          if (nowMovies.error) {
            console.error('Now Playing API error:', nowMovies.error);
            setLatestMovies([]);
          } else {
            const latestMoviesMapped = (nowMovies.items || []).slice(0, 6).map((m: any) => ({
              id: String(m.tmdb_id),
              tmdb_id: m.tmdb_id,
              type: 'movie',
              title: m.title,
              synopsis: m.overview,
              year: m.year,
              genre: null,
              platform: null,
              rating: String(m.rating ?? ''),
              duration: null,
              url: m.poster_url,
              new: null,
              note: null,
            })) as unknown as Movie[];
            setLatestMovies(latestMoviesMapped);
          }
        }

        // Latest Series (Filtered by Netflix, HBO Max, Amazon Prime, Apple TV+)
        // TMDB Provider IDs: Netflix=8, HBO Max=384, Amazon Prime=9, Apple TV+=350
        // Fetch with provider filter for latest series
        const today = new Date();
        const pastYear = new Date();
        pastYear.setFullYear(today.getFullYear() - 1);
        const yearMin = pastYear.getFullYear();
        const yearMax = today.getFullYear();
        const nowSeriesResp = await fetch(`/api/tmdb/discover?type=tv&with_watch_providers=8,384,9,350&watch_region=SA&yearMin=${yearMin}&yearMax=${yearMax}&sort_by=first_air_date.desc&limit=20`);
        if (!nowSeriesResp.ok) {
          console.error('Discover Series API error:', nowSeriesResp.status, await nowSeriesResp.text());
          setLatestSeries([]);
        } else {
          const nowSeries = await nowSeriesResp.json();
          if (nowSeries.error) {
            console.error('Error fetching latest series:', nowSeries.error);
            setLatestSeries([]);
          } else {
            const latestSeriesMapped = (nowSeries.items || []).slice(0, 6).map((m: any) => ({
              id: String(m.tmdb_id),
              tmdb_id: m.tmdb_id,
              type: 'series',
              title: m.title,
              synopsis: m.overview,
              year: m.year,
              genre: null,
              platform: null,
              rating: String(m.rating ?? ''),
              duration: null,
              url: m.poster_url,
              new: null,
              note: null,
            })) as unknown as Movie[];
            setLatestSeries(latestSeriesMapped);
          }
        }

        // Top Rated Movies
        const topMoviesResponse = await fetch('/api/tmdb/top-rated?type=movie');
        if (!topMoviesResponse.ok) {
          console.error('Top Rated Movies API error:', topMoviesResponse.status, await topMoviesResponse.text());
          setTopRatedMovies([]);
        } else {
          const topMoviesData = await topMoviesResponse.json();
          if (topMoviesData.error) {
            console.error('Top Rated Movies API error:', topMoviesData.error);
            setTopRatedMovies([]);
          } else {
            const topMoviesMapped = (topMoviesData.items || []).slice(0, 10).map((m: any) => ({
              id: String(m.tmdb_id),
              tmdb_id: m.tmdb_id,
              type: 'movie',
              title: m.title,
              synopsis: m.overview,
              year: m.year,
              genre: null,
              platform: null,
              rating: String(m.rating ?? ''),
              duration: null,
              url: m.poster_url,
              new: null,
              note: null,
            })) as unknown as Movie[];
            setTopRatedMovies(topMoviesMapped);
          }
        }

        // Top Rated Series
        const topSeriesResponse = await fetch('/api/tmdb/top-rated?type=tv');
        if (!topSeriesResponse.ok) {
          console.error('Top Rated Series API error:', topSeriesResponse.status, await topSeriesResponse.text());
          setTopRatedSeries([]);
        } else {
          const topSeriesData = await topSeriesResponse.json();
          if (topSeriesData.error) {
            console.error('Top Rated Series API error:', topSeriesData.error);
            setTopRatedSeries([]);
          } else {
            const topSeriesMapped = (topSeriesData.items || []).slice(0, 10).map((m: any) => ({
              id: String(m.tmdb_id),
              tmdb_id: m.tmdb_id,
              type: 'series',
              title: m.title,
              synopsis: m.overview,
              year: m.year,
              genre: null,
              platform: null,
              rating: String(m.rating ?? ''),
              duration: null,
              url: m.poster_url,
              new: null,
              note: null,
            })) as unknown as Movie[];
            setTopRatedSeries(topSeriesMapped);
          }
        }
      } catch (error) {
        console.error('Error fetching latest content:', error);
        // Set empty arrays on error to prevent loading state from persisting
        setTrendingMovies([]);
        setLatestMovies([]);
        setLatestSeries([]);
        setTopRatedMovies([]);
        setTopRatedSeries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestContent();
  }, []);

  // Fetch latest reviews from all products
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

  // Check if user is a commissioner
  useEffect(() => {
    const checkCommissioner = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email || !session.access_token) {
          setIsCommissioner(false);
          return;
        }

        const response = await fetch('/api/commissions/check', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setIsCommissioner(result.isCommissioner || false);
        } else {
          setIsCommissioner(false);
        }
      } catch (error) {
        console.error('Error checking commissioner status:', error);
        setIsCommissioner(false);
      }
    };

    checkCommissioner();

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        checkCommissioner();
      } else {
        setIsCommissioner(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const scroll = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 400;
      ref.current.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleCardClick = (movie: Movie) => {
    setSelectedMovie(movie);
    setIsModalOpen(true);
  };

  const handleShowMore = () => {
    if (topRatedTab === 'movies') {
      router.push('/top-movies');
    } else {
      router.push('/top-series');
    }
  };

  const topRatedContent = topRatedTab === 'movies' ? topRatedMovies : topRatedSeries;

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      {/* Commission Panel Link for Commissioners */}
      {isCommissioner && (
        <section className="bg-gradient-to-r from-indigo-600 to-purple-600 py-2 sticky top-12 z-40 border-b border-indigo-500/30">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-white" />
                <div>
                  <p className="text-white font-semibold text-sm">لوحة العمولات</p>
                  <p className="text-indigo-100 text-xs">تابع أرباحك وطلبات الدفع</p>
                </div>
              </div>
              <Link href="/commissions">
                <Button className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold text-xs h-7 px-3">
                  عرض اللوحة
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://wallpapercave.com/wp/wp14847863.webp)',
            opacity: 0.9,
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />

        <div className="relative z-10 container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:flex-row-reverse items-center md:items-center md:justify-between gap-8 max-w-7xl mx-auto pt-12 md:pt-16">
            {/* Text Content - Right Side on Desktop, Top on Mobile */}
            <div className="flex-1 text-center md:text-right w-full md:w-auto">
              <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                لا تستطيع تحديد ماذا تشاهد؟
              </h1>
              <p className="text-xl md:text-2xl text-slate-300 mb-10 max-w-3xl mx-auto md:mx-0">
                أخبرنا عن حالتك المزاجية، وسنجد لك الفيلم المثالي
              </p>
            </div>
            
            {/* Buttons - Left Side on Desktop, Bottom on Mobile */}
            <div className="flex-shrink-0 w-full md:w-auto">
              {/* Mobile: Side by side - subscription on left, search on right | Desktop: stacked - search top, subscription bottom */}
              <div className="flex flex-row gap-3 md:flex-col md:gap-4 w-full md:w-auto">
                {/* Search Button - Right on mobile (first in RTL), Top on desktop */}
                <Link href="/browse" className="block flex-1 md:w-auto md:flex-none order-2 md:order-1">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-6 md:px-8 py-6 w-full md:w-auto">
                    ابحث عن فيلم الآن
                  </Button>
                </Link>
                
                {/* Subscription Button - Left on mobile (second in RTL), Bottom on desktop */}
                <Link href="/subscribe" className="block flex-1 md:w-auto md:flex-none order-1 md:order-2">
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-lg px-6 md:px-8 py-6 w-full md:w-auto flex items-center justify-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    أبي إشتراك
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Aroma Packages Special Section */}
      {!productsLoading && Object.keys(aromaProducts).length > 0 && (
        <section className="py-16 bg-[#101622]">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 items-end justify-center">
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
                  key: 'premium', 
                  title: 'باقة فاخرة', 
                  tier: 'الباقة الثالثة: المجد الكامل',
                  cardClass: 'special-card',
                  playerClass: 'special-player',
                  isPopular: true,
                  features: ["جميع الدوريات المحلية والأوروبية", 'جودة 4K/UHD', "جميع قنوات ثمانية و beIN", 'جميع مميزات الباقة الأساسية والمميزة ']
                },
                { 
                  key: 'luxury', 
                  title: 'باقة مميزة', 
                  tier: 'الباقة الثانية: مناسبة لدوري روشن ',
                  cardClass: 'premium-card',
                  playerClass: 'premium-player',
                  features: ["بث جميع مباريات دوري روشن", 'جودة Full HD & 4K', "جميع قنوات ثمانية", "جميع مميزات الباقة الأساسية"]
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
                    className={`plan-card flex flex-col ${categoryConfig.cardClass} ${
                      categoryConfig.isPopular ? 'popular' : ''
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
                      className={`player-visual-container ${categoryConfig.playerClass} ${
                        categoryConfig.isPopular ? 'h-64' : 'h-56'
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
                              className={`flex justify-between items-center p-3 rounded-lg ${
                                isPopularHighlight
                                  ? 'bg-[#0d59f2]/20 border border-[#0d59f2]'
                                  : 'bg-black/20 border border-white/10'
                              }`}
                            >
                              <div>
                                <p className="font-bold text-white">{product.duration}</p>
                                {product.discounted_price && product.discounted_price < product.price ? (
                                  <div>
                                    <p className="text-sm text-white/60 line-through">{product.price} ريال</p>
                                    <p className="text-sm text-white">{product.discounted_price} ريال</p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-white/60">{product.price} ريال</p>
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
                                className={`${
                                  isHighlight
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
                    <Link href="https://your-store-url.com/trial" target="_blank" rel="noopener noreferrer">
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

      {/* Products Section */}
      {!productsLoading && Object.keys(productsByCategory).length > 0 && (
        <section className="py-16 bg-black/30">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">منتجات أخرى</h2>
              <p className="text-slate-400">اشترك واحصل على أفضل الخطط</p>
            </div>

            <div className="space-y-20">
              {Object.keys(productsByCategory).map((categoryId, categoryIndex) => {
                const category = productsByCategory[categoryId];
                const sectionIndex = categoryIndex % sectionGradients.length;
                const isPackageSection = category.some((p: any) => p.isPackage || p.is_package);
                
                if (!category || category.length === 0) return null;
                
                const isBlackFridayActive =
                  promotionalBanner?.banner_type === 'blackfriday' && promotionalBanner?.is_enabled !== false;
                
                return (
                  <div key={categoryId} id={`category-${categoryId}`} className="scroll-mt-20 w-full">
                    {/* Category Header */}
                    <div className="mb-8 text-center w-full">
                      <div className="flex items-center justify-center gap-4 mb-2">
                        <h3 className="text-2xl md:text-3xl font-bold text-white inline-block">
                          {categoryTitles[categoryId] || 'غير محدد'}
                        </h3>
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
                      <div className={`h-1 w-24 mx-auto mt-4 bg-gradient-to-r ${category[0].gradient || 'from-blue-600 to-cyan-600'} rounded-full`} />
                    </div>

                    {/* Products Grid - Packages: 2 columns (long cards), Others: 3 columns */}
                    {/* Separate wrapper for each type to ensure independent centering */}
                    {isPackageSection ? (
                      <div className="w-full flex justify-center">
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-8 w-full max-w-4xl">
                          {category.slice(0, 2).map((product: any) => {
                            const Icon = product.icon || Sparkles;
                            
                            // Package section - long detailed cards
                            return (
                              <Card key={product.id} className="group relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-2 border-slate-700/50 hover:border-slate-500 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-2 h-full flex flex-col">
                                <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} opacity-0 group-hover:opacity-15 transition-opacity duration-300 pointer-events-none`} />
                                
                                {/* Black Friday Badge */}
                                {isBlackFridayActive && promotionalBanner && (
                                  <div className="absolute top-2 left-0 z-20 transform -rotate-12 origin-left">
                                    <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-1.5 shadow-lg rounded-md">
                                      <span className="text-xs md:text-sm font-bold whitespace-nowrap">{promotionalBanner.title}</span>
                                    </div>
                                  </div>
                                )}
                                
                                <Link href={`/subscribe/${product.code}`} className="block cursor-pointer">
                                  <div className={`relative h-32 md:h-64 w-full overflow-hidden ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-gradient-to-br from-slate-700 to-slate-800' : `bg-gradient-to-br ${product.gradient}`} p-3 md:p-8`}>
                                    <div className="h-full flex flex-col justify-between">
                                      <div className="flex items-center justify-center gap-1.5 md:gap-3 flex-nowrap w-full">
                                        {product.logos?.map((logo: string, idx: number) => (
                                          <div key={idx} className={`${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'bg-slate-600/50' : 'bg-white/10'} backdrop-blur-sm rounded-lg p-1.5 md:p-3 border ${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'border-slate-500/30' : 'border-white/20'} group-hover:scale-110 transition-transform duration-300`}>
                                            <img
                                              src={logo}
                                              alt={`${product.name} logo ${idx + 1}`}
                                              className={`h-6 w-6 md:h-12 md:w-12 object-contain ${logo.endsWith('.png') || logo.endsWith('.jpeg') || logo.endsWith('.jpg') ? '' : 'brightness-0 invert'}`}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                      <div className="text-center">
                                        <h4 className="text-base md:text-2xl font-extrabold text-white mb-1 md:mb-2 line-clamp-2">{product.name}</h4>
                                        <p className={`${product.code === 'SUB-PACKAGE-LEGENDARY' ? 'text-slate-200' : 'text-white/90'} text-xs md:text-base line-clamp-2`}>{product.description}</p>
                                      </div>
                                    </div>
                                  </div>
                                </Link>

                                <CardHeader className="pb-2 md:pb-4 pt-3 md:pt-6 px-3 md:px-8">
                                  <Link href={`/subscribe/${product.code}`} className="block cursor-pointer">
                                    <CardTitle className="text-sm md:text-xl text-white mb-2 md:mb-3 group-hover:text-amber-300 transition-colors">
                                      المميزات الحصرية
                                    </CardTitle>
                                  </Link>
                                  <ul className="space-y-1 md:space-y-2">
                                    {product.features?.slice(0, 3).map((feature: string, idx: number) => (
                                      <li key={idx} className="flex items-center text-slate-300 text-xs md:text-sm">
                                        <Check className="h-3 w-3 md:h-4 md:w-4 text-green-400 ml-1.5 md:ml-2 flex-shrink-0" />
                                        <span className="line-clamp-1">{feature}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </CardHeader>

                                <CardContent className="mt-auto pb-3 md:pb-6 px-3 md:px-8">
                                  <div className="mb-2 md:mb-4 text-center p-2 md:p-4 bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-xl border border-slate-600/50">
                                    {product.discounted_price && product.discounted_price < product.price ? (
                                      <>
                                        <div className="flex items-baseline justify-center gap-1 md:gap-2 mb-1">
                                          <span className="text-xl md:text-4xl font-extrabold text-white">{product.discounted_price}</span>
                                          <span className="text-sm md:text-xl text-slate-400">ريال</span>
                                        </div>
                                        <div className="flex items-center justify-center gap-1 md:gap-2 flex-wrap">
                                          <span className="text-xs md:text-sm text-slate-400 line-through">{product.price}</span>
                                          <span className="text-xs md:text-sm text-slate-400">ريال</span>
                                          <span className="text-xs md:text-sm font-bold text-red-400">
                                            ({Math.round(((product.price - product.discounted_price) / product.price) * 100)}% خصم)
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-baseline justify-center gap-1 md:gap-2 mb-1">
                                        <span className="text-xl md:text-4xl font-extrabold text-white">{product.price}</span>
                                        <span className="text-sm md:text-xl text-slate-400">ريال</span>
                                      </div>
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
                                          price: product.discounted_price && product.discounted_price < product.price ? product.discounted_price : product.price,
                                          quantity: 1,
                                          image: product.image,
                                        });
                                      }
                                    }}
                                    disabled={product.available_stock === 0}
                                    className={`w-full bg-red-600 hover:bg-red-700 text-white py-2 md:py-3 text-xs md:text-sm relative z-20 ${product.available_stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <ShoppingCart className="mr-1.5 md:mr-2 h-3 w-3 md:h-4 md:w-4 text-white" />
                                    <span className="text-white">{product.available_stock === 0 ? 'نفد المخزون' : 'أضف إلى السلة'}</span>
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex justify-center px-4">
                        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-8 lg:gap-10 max-w-6xl">
                          {category.slice(0, 4).map((product: any) => {
                            const Icon = product.icon || Sparkles;
                            
                            // Regular product cards
                            return (
                              <Card key={product.id} className="group relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 h-full flex flex-col">
                                <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none`} />
                                
                                {/* Black Friday Badge */}
                                {isBlackFridayActive && promotionalBanner && (
                                  <div className="absolute top-2 left-0 z-20 transform -rotate-12 origin-left">
                                    <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-3 py-1 shadow-lg rounded-md">
                                      <span className="text-[10px] md:text-xs font-bold whitespace-nowrap">{promotionalBanner.title}</span>
                                    </div>
                                  </div>
                                )}
                                
                                <Link href={`/subscribe/${product.code}`} className="block">
                                  <div className="relative h-24 md:h-40 w-full overflow-hidden bg-gradient-to-br from-slate-700 to-slate-800 cursor-pointer">
                                    {product.image ? (
                                      product.image.endsWith('.svg') ? (
                                        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 p-2 md:p-4">
                                          <img
                                            src={product.image}
                                            alt={product.name}
                                            className="h-8 md:h-16 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                                          />
                                        </div>
                                      ) : (
                                        <div className="relative h-full w-full">
                                          <Image
                                            src={product.image}
                                            alt={product.name}
                                            fill
                                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                                            sizes="(max-width: 768px) 33vw, 25vw"
                                          />
                                        </div>
                                      )
                                    ) : (
                                      <div className={`h-full w-full bg-gradient-to-br ${product.gradient} flex items-center justify-center`}>
                                        <ImageIcon className="w-6 h-6 md:w-8 md:h-8 text-white/30" />
                                      </div>
                                    )}
                                  </div>
                                </Link>

                                <CardHeader className="pb-1 md:pb-2 pt-2 md:pt-3 px-2 md:px-3">
                                  <Link href={`/subscribe/${product.code}`} className="block cursor-pointer">
                                    <CardTitle className="text-xs md:text-base text-white mb-0.5 md:mb-1 group-hover:text-blue-300 transition-colors line-clamp-2">
                                      {product.name}
                                    </CardTitle>
                                    <CardDescription className="text-slate-400 text-[10px] md:text-xs line-clamp-2">
                                      {product.description}
                                    </CardDescription>
                                  </Link>
                                </CardHeader>

                                <CardContent className="mt-auto pb-2 md:pb-3 px-2 md:px-3">
                                  <div className="mb-2 md:mb-3 text-center">
                                    {product.discounted_price && product.discounted_price < product.price ? (
                                      <>
                                        <div className="flex items-baseline justify-center gap-0.5 md:gap-1 mb-0.5 md:mb-1">
                                          <span className="text-base md:text-2xl font-extrabold text-white">{product.discounted_price}</span>
                                          <span className="text-[10px] md:text-sm text-slate-400">ريال</span>
                                        </div>
                                        <div className="flex items-center justify-center gap-0.5 md:gap-1 flex-wrap">
                                          <span className="text-[9px] md:text-xs text-slate-400 line-through">{product.price}</span>
                                          <span className="text-[9px] md:text-xs text-slate-400">ريال</span>
                                          <span className="text-[9px] md:text-xs font-bold text-red-400">
                                            ({Math.round(((product.price - product.discounted_price) / product.price) * 100)}% خصم)
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-baseline justify-center gap-0.5 md:gap-1">
                                        <span className="text-base md:text-2xl font-extrabold text-white">{product.price}</span>
                                        <span className="text-[10px] md:text-sm text-slate-400">ريال</span>
                                      </div>
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
                                          price: product.discounted_price && product.discounted_price < product.price ? product.discounted_price : product.price,
                                          quantity: 1,
                                          image: product.image,
                                        });
                                      }
                                    }}
                                    disabled={product.available_stock === 0}
                                    className={`w-full bg-red-600 hover:bg-red-700 text-white py-1.5 md:py-2 text-[10px] md:text-xs relative z-20 ${product.available_stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <ShoppingCart className="mr-1 h-2.5 w-2.5 md:h-3 md:w-3 text-white" />
                                    <span className="text-white">{product.available_stock === 0 ? 'نفد' : 'أضف إلى السلة'}</span>
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Trending Movies */}
      <section id="trending-movies" className="py-14 bg-black/40">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h2 className="text-3xl md:text-4xl font-bold">الأكثر رواجاً في المنصات</h2>
            <p className="text-slate-400">أفضل 10 أفلام رائجة حالياً</p>
          </div>

          {loading ? (
            <div className="flex gap-4 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-slate-800/50 rounded-lg h-[400px] min-w-[200px] animate-pulse" />
              ))}
            </div>
          ) : trendingMovies.length > 0 ? (
            <div className="relative group">
              {/* Scroll Left Button */}
              <button
                onClick={() => scroll(trendingScrollRef, 'left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/90 hover:bg-slate-800 text-white p-3 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <div
                ref={trendingScrollRef}
                className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {trendingMovies.map((item, idx) => (
                  <div key={item.id} className="relative min-w-[200px] md:min-w-[250px]">
                    <div className="absolute top-2 right-2 z-20 bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1 rounded-full font-bold text-sm shadow-lg">
                      #{idx + 1}
                    </div>
                    <MovieCard movie={item} onCardClick={() => handleCardClick(item)} />
                  </div>
                ))}
              </div>

              {/* Scroll Right Button */}
              <button
                onClick={() => scroll(trendingScrollRef, 'right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/90 hover:bg-slate-800 text-white p-3 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">لا يوجد محتوى رائج حالياً</div>
          )}
        </div>
      </section>

      {/* Latest Movies and Series Section */}
      <section className="py-16 bg-black/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2">احدث الافلام والمسلسلات في أروما</h2>
              <p className="text-slate-400">أفلام ومسلسلات تو نازلة</p>
            </div>
            <Link href="/latest?type=both">
              <Button variant="outline" className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white">
                عرض الكل ←
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-slate-800/50 rounded-lg h-[400px] animate-pulse" />
              ))}
            </div>
          ) : [...latestMovies, ...latestSeries].length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...latestMovies, ...latestSeries].slice(0, 6).map((item) => (
                <MovieCard key={item.id} movie={item} onCardClick={() => handleCardClick(item)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              لا يوجد محتوى جديد هذا الشهر
            </div>
          )}
        </div>
      </section>

      {/* Makaan TU Logo and CTA Section */}
      <section className="py-16 bg-black">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Makaan TU Logo */}
            <div className="mb-12">
              {/* Arabic Text */}
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-arabic)' }}>
                مَكَان
              </h1>
              
              {/* Latin Text with Glitch Effect on TU */}
              <div className="relative inline-block mb-3">
                <span className="text-2xl md:text-3xl font-bold text-white tracking-wider">
                  MAKAAN{' '}
                  <span 
                    className="relative inline-block"
                    style={{
                      textShadow: `
                        -2px 0 0 cyan,
                        2px 0 0 magenta,
                        0 -2px 0 cyan,
                        0 2px 0 magenta
                      `,
                    }}
                  >
                    <span className="relative z-10 text-white">TU</span>
                  </span>
                </span>
              </div>
              
              {/* Star Icon */}
              <div className="flex justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="white" className="mt-2">
                  <path d="M8 0 L9.5 5.5 L15 7 L9.5 8.5 L8 14 L6.5 8.5 L1 7 L6.5 5.5 Z" />
                </svg>
              </div>
            </div>
            
            {/* Title Text */}
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-8" style={{ fontFamily: 'var(--font-arabic)' }}>
              ما معك اشتراك تتابع الفلم ؟
            </h2>
            
            {/* CTA Button */}
            <div className="flex justify-center">
              <Link href="/subscribe">
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl md:text-2xl px-12 py-6 md:px-16 md:py-8 h-auto rounded-xl shadow-2xl hover:scale-105 transition-all duration-200 flex items-center gap-3"
                  style={{ fontFamily: 'var(--font-arabic)' }}
                >
                  <ShoppingCart className="w-6 h-6 md:w-7 md:h-7" />
                  شيك متجرنا
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Details Section */}
      <section className="py-20 bg-gradient-to-b from-black via-slate-900 to-black">
        <div className="container mx-auto px-4">
          {/* Statistics Section */}
          <div className="grid grid-cols-2 gap-4 md:gap-8 mb-16 max-w-4xl mx-auto">
            {/* Movies Library */}
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-4 md:p-8 text-center hover:border-blue-500/50 transition-all duration-300 hover:scale-105">
              <div className="flex justify-center mb-2 md:mb-4">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-600/30 rounded-full flex items-center justify-center">
                  <Film className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
                </div>
              </div>
              <div className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-1 md:mb-2" style={{ fontFamily: 'var(--font-arabic)' }}>
                18000+
              </div>
              <p className="text-sm md:text-xl lg:text-2xl text-slate-300" style={{ fontFamily: 'var(--font-arabic)' }}>
                مكتبة أفلام فوق ال 18000 فلم
              </p>
            </div>

            {/* Series Library */}
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-4 md:p-8 text-center hover:border-purple-500/50 transition-all duration-300 hover:scale-105">
              <div className="flex justify-center mb-2 md:mb-4">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-purple-600/30 rounded-full flex items-center justify-center">
                  <Tv className="w-6 h-6 md:w-8 md:h-8 text-purple-400" />
                </div>
              </div>
              <div className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-1 md:mb-2" style={{ fontFamily: 'var(--font-arabic)' }}>
                9000+
              </div>
              <p className="text-sm md:text-xl lg:text-2xl text-slate-300" style={{ fontFamily: 'var(--font-arabic)' }}>
                مكتبة مسلسلات فوق 9000 مسلسل
              </p>
            </div>
          </div>

          {/* Platforms Section */}
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-8" style={{ fontFamily: 'var(--font-arabic)' }}>
              جميع المنصات
            </h2>
            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6 max-w-5xl mx-auto">
              {/* Netflix */}
              <div className="flex flex-col items-center justify-center p-2 md:p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/netflix.svg" alt="Netflix" className="h-8 md:h-12 w-auto mb-1 md:mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Shahid */}
              <div className="flex flex-col items-center justify-center p-2 md:p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/shahid.svg" alt="Shahid" className="h-8 md:h-12 w-auto mb-1 md:mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* IPTV */}
              <div className="flex flex-col items-center justify-center p-2 md:p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/iptv.png" alt="IPTV" className="h-8 md:h-12 w-auto mb-1 md:mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Amazon Prime */}
              <div className="flex flex-col items-center justify-center p-2 md:p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/amazon-prime.svg" alt="Amazon Prime" className="h-8 md:h-12 w-auto mb-1 md:mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Disney+ */}
              <div className="flex flex-col items-center justify-center p-2 md:p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/disney-plus.svg" alt="Disney+" className="h-8 md:h-12 w-auto mb-1 md:mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* HBO Max */}
              <div className="flex flex-col items-center justify-center p-2 md:p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/hbo-max.svg" alt="HBO Max" className="h-8 md:h-12 w-auto mb-1 md:mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Hulu */}
              <div className="flex flex-col items-center justify-center p-2 md:p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/hulu.svg" alt="Hulu" className="h-8 md:h-12 w-auto mb-1 md:mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Apple TV+ */}
              <div className="flex flex-col items-center justify-center p-2 md:p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/apple-tv.svg" alt="Apple TV+" className="h-8 md:h-12 w-auto mb-1 md:mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>

          {/* Devices Section */}
          <div id="devices-section">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-8" style={{ fontFamily: 'var(--font-arabic)' }}>
              يضبط على جميع الاجهزة
            </h2>
            <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6 max-w-6xl mx-auto">
              {/* Smart TV */}
              <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-8 h-8 md:w-10 md:h-10 text-blue-400 mb-2 md:mb-3" />
                <span className="text-white text-xs md:text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Smart TV
                </span>
              </div>

              {/* iPhone / iOS */}
              <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Smartphone className="w-8 h-8 md:w-10 md:h-10 text-blue-400 mb-2 md:mb-3" />
                <span className="text-white text-xs md:text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  iPhone / iOS
                </span>
              </div>

              {/* Android Phone */}
              <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Smartphone className="w-8 h-8 md:w-10 md:h-10 text-green-400 mb-2 md:mb-3" />
                <span className="text-white text-xs md:text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Android
                </span>
              </div>

              {/* Windows PC */}
              <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Monitor className="w-8 h-8 md:w-10 md:h-10 text-blue-400 mb-2 md:mb-3" />
                <span className="text-white text-xs md:text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Windows PC
                </span>
              </div>

              {/* Mac */}
              <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Laptop className="w-8 h-8 md:w-10 md:h-10 text-blue-400 mb-2 md:mb-3" />
                <span className="text-white text-xs md:text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Mac
                </span>
              </div>

              {/* Fire TV Stick */}
              <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-8 h-8 md:w-10 md:h-10 text-orange-400 mb-2 md:mb-3" />
                <span className="text-white text-xs md:text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Fire TV Stick
                </span>
              </div>

              {/* Apple TV */}
              <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-8 h-8 md:w-10 md:h-10 text-blue-400 mb-2 md:mb-3" />
                <span className="text-white text-xs md:text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Apple TV
                </span>
              </div>

              {/* Samsung TV */}
              <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-8 h-8 md:w-10 md:h-10 text-blue-400 mb-2 md:mb-3" />
                <span className="text-white text-xs md:text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Samsung TV
                </span>
              </div>

              {/* LG TV */}
              <div className="flex flex-col items-center justify-center p-3 md:p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-8 h-8 md:w-10 md:h-10 text-red-400 mb-2 md:mb-3" />
                <span className="text-white text-xs md:text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  LG TV
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Installation Benefits Section */}
      <section className="py-20 bg-gradient-to-b from-black via-slate-900 to-black relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-arabic)' }}>
                طريقة تركيب سهلة وبسيطة
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
            </div>
            
            {/* Benefits Grid */}
            <div className="grid grid-cols-3 gap-2 md:gap-6 mb-12">
              <div className="group relative bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-4 md:p-8 hover:border-blue-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-3 md:mb-6 mx-auto shadow-lg shadow-blue-500/30">
                    <Smartphone className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <p className="text-xs md:text-xl lg:text-2xl text-white font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                    تقدر تركبه على جميع أجهزتك
                  </p>
                </div>
              </div>
              
              <div className="group relative bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-2xl p-4 md:p-8 hover:border-purple-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-3 md:mb-6 mx-auto shadow-lg shadow-purple-500/30">
                    <Shield className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <p className="text-xs md:text-xl lg:text-2xl text-white font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                    مع ضمان المدة الكاملة
                  </p>
                </div>
              </div>
              
              <div className="group relative bg-gradient-to-br from-pink-600/20 to-pink-800/20 border border-pink-500/30 rounded-2xl p-4 md:p-8 hover:border-pink-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-3 md:mb-6 mx-auto shadow-lg shadow-pink-500/30">
                    <Zap className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <p className="text-xs md:text-xl lg:text-2xl text-white font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                    تسليم فوري خلال دقائق
                  </p>
                </div>
              </div>
            </div>
            
            {/* App Features Section */}
            <div className="grid grid-cols-2 gap-2 md:gap-6 mb-12">
              <div className="group relative bg-gradient-to-br from-cyan-600/20 to-teal-600/20 border border-cyan-500/30 rounded-2xl p-4 md:p-8 hover:border-cyan-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center mb-3 md:mb-6 mx-auto shadow-lg shadow-cyan-500/30">
                    <Languages className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <p className="text-xs md:text-xl lg:text-2xl text-white font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                    واجهة التطبيق عربية
                  </p>
                </div>
              </div>
              
              <div className="group relative bg-gradient-to-br from-orange-600/20 to-amber-600/20 border border-orange-500/30 rounded-2xl p-4 md:p-8 hover:border-orange-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center mb-3 md:mb-6 mx-auto shadow-lg shadow-orange-500/30">
                    <Download className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                  <p className="text-xs md:text-xl lg:text-2xl text-white font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                    امكانية تنزيل وتحميل المسلسلات والافلام والمتابعة بدون انترنت
                  </p>
                </div>
              </div>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link href="/subscribe">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-xl md:text-2xl px-12 py-6 md:px-16 md:py-8 h-auto rounded-xl shadow-2xl hover:scale-105 transition-all duration-200 border border-blue-400/30"
                  style={{ fontFamily: 'var(--font-arabic)' }}
                >
                  اطلب الان
                </Button>
              </Link>
              
              <Link href="/trial">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/20 hover:text-white hover:border-blue-400 font-bold text-xl md:text-2xl px-12 py-6 md:px-16 md:py-8 h-auto rounded-xl shadow-xl hover:scale-105 transition-all duration-200 backdrop-blur-sm"
                  style={{ fontFamily: 'var(--font-arabic)' }}
                >
                  اطلب تجربة مجانية
                </Button>
              </Link>
            </div>
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
                              className={`w-5 h-5 ${
                                star <= review.rating
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

      {/* Movie Modal */}
      <MovieModal
        movie={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <Footer />
    </div>
  );
}
