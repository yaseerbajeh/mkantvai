'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Clapperboard, Target, Sparkles, ChevronLeft, ChevronRight, Film, ArrowLeft, ShoppingCart, Tv, Smartphone, Monitor, Laptop, CheckCircle2, Shield, Zap, Bot, TrendingUp, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MovieCard from '@/components/MovieCard';
import MovieModal from '@/components/MovieModal';
import { type Movie } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
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
  
  const topRatedScrollRef = useRef<HTMLDivElement>(null);
  const trendingScrollRef = useRef<HTMLDivElement>(null);

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
                <div className="flex-1 md:w-auto md:flex-none order-1 md:order-2 flex flex-col gap-3">
                  <Link href="/subscribe" className="block w-full">
                    <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-lg px-6 md:px-8 py-6 w-full md:w-auto flex items-center justify-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      أبي إشتراك
                    </Button>
                  </Link>
                  
                  {/* Elegant Discount Code Banner */}
                  <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-lg border border-purple-500/30 px-4 py-2.5 w-full">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-300" />
                        <div className="text-right">
                          <p className="text-white/80 text-xs mb-0.5">مناسبة إفتتاح المنصة</p>
                          <p className="text-white/60 text-[10px]">خصم 20% - استخدم كود الخصم</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-white/10 rounded-md px-3 py-1.5 border border-white/20">
                        <span className="text-white font-bold text-sm font-mono">20OFF</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText('20OFF');
                            toast({
                              title: 'تم النسخ!',
                              description: 'تم نسخ كود الخصم 20OFF بنجاح',
                            });
                          }}
                          className="p-1 hover:bg-white/20 rounded transition-colors"
                          title="نسخ الكود"
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 bg-black/50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            اكتشف ما نقدمه
          </h2>
          <p className="text-center text-slate-400 text-lg mb-16">
            أدوات ذكية لمساعدتك في العثور على أفضل محتوى لمشاهدتك
          </p>

          <div className="max-w-7xl mx-auto space-y-4 md:space-y-8">
            {/* Large Featured Card - AI Movie Finder */}
            <Link href="/browse" className="block group">
              <div className="bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 border-2 border-blue-500/30 rounded-xl md:rounded-2xl p-4 md:p-8 lg:p-12 hover:border-blue-400/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                  {/* Icon/Illustration */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 md:w-32 md:h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                      <Bot className="w-10 h-10 md:w-16 md:h-16 text-white" />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 text-center md:text-right w-full">
                    <h3 className="text-xl md:text-3xl lg:text-4xl font-bold mb-2 md:mb-4 text-white">
                      الذكاء الاصطناعي لإيجاد الفيلم المثالي
                    </h3>
                    <p className="text-sm md:text-lg lg:text-xl text-slate-300 mb-4 md:mb-6 max-w-2xl mx-auto md:mx-0">
                      تحدث مع مساعدنا الذكي! أخبرنا عن حالتك المزاجية، التصنيفات المفضلة، والمنصات المتاحة لديك، وسنجد لك أفضل 3 اقتراحات مخصصة لك
                    </p>
                    <Button 
                      size="lg" 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm md:text-lg px-6 md:px-8 py-4 md:py-6 shadow-lg hover:shadow-xl transition-all w-full md:w-auto"
                    >
                      جرب الآن
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </Link>

            {/* Two Smaller Cards - Trending Movies and Store */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-8">
              {/* Trending Movies Card */}
              <div 
                onClick={() => {
                  const trendingSection = document.getElementById('trending-movies');
                  if (trendingSection) {
                    trendingSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="cursor-pointer group"
              >
                <div className="bg-gradient-to-br from-orange-600/20 via-red-600/20 to-pink-600/20 border-2 border-orange-500/30 rounded-xl md:rounded-2xl p-4 md:p-8 hover:border-orange-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/20 h-full">
                  <div className="flex flex-col items-center text-center h-full">
                    {/* Icon */}
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-6 shadow-xl shadow-orange-500/30 group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="w-8 h-8 md:w-12 md:h-12 text-white" />
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-base md:text-2xl lg:text-3xl font-bold mb-2 md:mb-4 text-white">
                      الأفلام الأكثر رواجاً
                    </h3>
                    <p className="text-xs md:text-base text-slate-300 mb-3 md:mb-6 flex-grow">
                      اكتشف قائمة الأفلام الأكثر شعبية ورواجاً حالياً على جميع المنصات. تحديث يومي لأفضل المحتوى
                    </p>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20 hover:text-white hover:border-orange-400 text-xs md:text-lg px-3 md:px-6 py-2 md:py-4 transition-all w-full md:w-auto"
                    >
                      <span className="hidden md:inline">عرض القائمة</span>
                      <span className="md:hidden">القائمة</span>
                      <ArrowLeft className="w-3 h-3 md:w-5 md:h-5 mr-1 md:mr-2" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Subscription Store Card */}
              <Link href="/subscribe" className="block group">
                <div className="bg-gradient-to-br from-green-600/20 via-emerald-600/20 to-teal-600/20 border-2 border-green-500/30 rounded-xl md:rounded-2xl p-4 md:p-8 hover:border-green-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20 h-full">
                  <div className="flex flex-col items-center text-center h-full">
                    {/* Icon */}
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-6 shadow-xl shadow-green-500/30 group-hover:scale-110 transition-transform duration-300">
                      <ShoppingCart className="w-8 h-8 md:w-12 md:h-12 text-white" />
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-base md:text-2xl lg:text-3xl font-bold mb-2 md:mb-4 text-white">
                      متجر الاشتراكات
                    </h3>
                    <p className="text-xs md:text-base text-slate-300 mb-3 md:mb-6 flex-grow">
                      احصل على اشتراكات بأسعار مميزة لجميع المنصات. Netflix، Disney+، HBO Max، وأكثر. تسليم فوري وضمان كامل
                    </p>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="border-green-500/50 text-green-400 hover:bg-green-500/20 hover:text-white hover:border-green-400 text-xs md:text-lg px-3 md:px-6 py-2 md:py-4 transition-all w-full md:w-auto"
                    >
                      <span className="hidden md:inline">زيارة المتجر</span>
                      <span className="md:hidden">المتجر</span>
                      <ShoppingCart className="w-3 h-3 md:w-5 md:h-5 mr-1 md:mr-2" />
                    </Button>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

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

      {/* Latest Movies Section */}
      <section className="py-16 bg-black/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2">أحدث الأفلام</h2>
              <p className="text-slate-400">أفلام تو نازلة</p>
            </div>
            <Link href="/latest?type=movie&new=oct">
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
          ) : latestMovies.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {latestMovies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} onCardClick={() => handleCardClick(movie)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              لا توجد أفلام جديدة هذا الشهر
            </div>
          )}
        </div>
      </section>

      {/* Latest Series Section */}
      <section className="py-16 bg-black/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2">أحدث المسلسلات</h2>
              <p className="text-slate-400">مسلسلات نتفلكس، HBO Max، أمازون برايم، و Apple TV+</p>
            </div>
            <Link href="/latest?type=series">
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
          ) : latestSeries.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {latestSeries.map((series) => (
                <MovieCard key={series.id} movie={series} onCardClick={() => handleCardClick(series)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              لا توجد مسلسلات جديدة هذا الشهر
            </div>
          )}
        </div>
      </section>

      {/* Top 10 Rated Section - Combined Movies & Series */}
      <section className="py-16 bg-black/30">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-3xl md:text-4xl font-bold"> أفضل الأفلام والمسلسلات تقييما </h2>
              
              {/* Show More Button */}
              <Button
                onClick={handleShowMore}
                variant="outline"
                className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
              >
                عرض المزيد
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
            </div>
            
            {/* Tabs for Movies/Series */}
            <div className="flex gap-4 justify-center mb-6">
              <button
                onClick={() => setTopRatedTab('movies')}
                className={`px-8 py-3 rounded-xl text-lg font-semibold transition-all ${
                  topRatedTab === 'movies'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                🎬 أفلام
              </button>
              <button
                onClick={() => setTopRatedTab('series')}
                className={`px-8 py-3 rounded-xl text-lg font-semibold transition-all ${
                  topRatedTab === 'series'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                📺 مسلسلات
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex gap-4 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-slate-800/50 rounded-lg h-[400px] min-w-[200px] animate-pulse" />
              ))}
            </div>
          ) : topRatedContent.length > 0 ? (
            <div className="relative group">
              {/* Scroll Left Button */}
              <button
                onClick={() => scroll(topRatedScrollRef, 'left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/90 hover:bg-slate-800 text-white p-3 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Scrollable Container */}
              <div
                ref={topRatedScrollRef}
                className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {topRatedContent.map((item) => (
                  <div key={item.id} className="min-w-[200px] md:min-w-[250px]">
                    <MovieCard movie={item} onCardClick={() => handleCardClick(item)} />
                  </div>
                ))}
              </div>

              {/* Scroll Right Button */}
              <button
                onClick={() => scroll(topRatedScrollRef, 'right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/90 hover:bg-slate-800 text-white p-3 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              {topRatedTab === 'movies' ? 'لا توجد أفلام متاحة' : 'لا توجد مسلسلات متاحة'}
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
          <div className="grid md:grid-cols-2 gap-8 mb-16 max-w-4xl mx-auto">
            {/* Movies Library */}
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-8 text-center hover:border-blue-500/50 transition-all duration-300 hover:scale-105">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blue-600/30 rounded-full flex items-center justify-center">
                  <Film className="w-8 h-8 text-blue-400" />
                </div>
              </div>
              <div className="text-5xl md:text-6xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-arabic)' }}>
                9000+
              </div>
              <p className="text-xl md:text-2xl text-slate-300" style={{ fontFamily: 'var(--font-arabic)' }}>
                مكتبة أفلام فوق ال 9000 فلم
              </p>
            </div>

            {/* Series Library */}
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-8 text-center hover:border-purple-500/50 transition-all duration-300 hover:scale-105">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-purple-600/30 rounded-full flex items-center justify-center">
                  <Tv className="w-8 h-8 text-purple-400" />
                </div>
              </div>
              <div className="text-5xl md:text-6xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-arabic)' }}>
                5000+
              </div>
              <p className="text-xl md:text-2xl text-slate-300" style={{ fontFamily: 'var(--font-arabic)' }}>
                مكتبة مسلسلات فوق ال5000 مسلسل
              </p>
            </div>
          </div>

          {/* Platforms Section */}
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-8" style={{ fontFamily: 'var(--font-arabic)' }}>
              جميع المنصات
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
              {/* Netflix */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/netflix.svg" alt="Netflix" className="h-12 w-auto mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Shahid */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/shahid.svg" alt="Shahid" className="h-12 w-auto mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* IPTV */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/iptv.png" alt="IPTV" className="h-12 w-auto mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Amazon Prime */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/amazon-prime.svg" alt="Amazon Prime" className="h-12 w-auto mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Disney+ */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/disney-plus.svg" alt="Disney+" className="h-12 w-auto mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* HBO Max */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/hbo-max.svg" alt="HBO Max" className="h-12 w-auto mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Hulu */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/hulu.svg" alt="Hulu" className="h-12 w-auto mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              
              {/* Apple TV+ */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-110">
                <img src="/logos/apple-tv.svg" alt="Apple TV+" className="h-12 w-auto mb-2 opacity-90 hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>

          {/* Devices Section */}
          <div id="devices-section">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-8" style={{ fontFamily: 'var(--font-arabic)' }}>
              يضبط على جميع الاجهزة
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
              {/* Smart TV */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-10 h-10 text-blue-400 mb-3" />
                <span className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Smart TV
                </span>
              </div>

              {/* iPhone / iOS */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Smartphone className="w-10 h-10 text-blue-400 mb-3" />
                <span className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  iPhone / iOS
                </span>
              </div>

              {/* Android Phone */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Smartphone className="w-10 h-10 text-green-400 mb-3" />
                <span className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Android
                </span>
              </div>

              {/* Windows PC */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Monitor className="w-10 h-10 text-blue-400 mb-3" />
                <span className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Windows PC
                </span>
              </div>

              {/* Mac */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Laptop className="w-10 h-10 text-blue-400 mb-3" />
                <span className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Mac
                </span>
              </div>

              {/* Fire TV Stick */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-10 h-10 text-orange-400 mb-3" />
                <span className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Fire TV Stick
                </span>
              </div>

              {/* Apple TV */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-10 h-10 text-blue-400 mb-3" />
                <span className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Apple TV
                </span>
              </div>

              {/* Samsung TV */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-10 h-10 text-blue-400 mb-3" />
                <span className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                  Samsung TV
                </span>
              </div>

              {/* LG TV */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-300 hover:scale-105 border border-slate-700/50 hover:border-blue-500/50">
                <Tv className="w-10 h-10 text-red-400 mb-3" />
                <span className="text-white text-sm font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
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
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="group relative bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-8 hover:border-blue-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-blue-500/30">
                    <Smartphone className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-xl md:text-2xl text-white font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                    وتقدر تركبه على جميع أجهزتك
                  </p>
                </div>
              </div>
              
              <div className="group relative bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-2xl p-8 hover:border-purple-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-purple-500/30">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-xl md:text-2xl text-white font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                    مع ضمان المدة الكاملة
                  </p>
                </div>
              </div>
              
              <div className="group relative bg-gradient-to-br from-pink-600/20 to-pink-800/20 border border-pink-500/30 rounded-2xl p-8 hover:border-pink-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-pink-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-pink-500/30">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-xl md:text-2xl text-white font-semibold text-center" style={{ fontFamily: 'var(--font-arabic)' }}>
                    وتسليم فوري خلال دقائق
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
                    <Link href="/#devices" onClick={(e) => {
                      e.preventDefault();
                      const devicesSection = document.getElementById('devices-section');
                      if (devicesSection) {
                        devicesSection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}>
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
