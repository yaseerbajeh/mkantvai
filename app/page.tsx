'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Clapperboard, Target, Sparkles, ChevronLeft, ChevronRight, Film, ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MovieCard from '@/components/MovieCard';
import MovieModal from '@/components/MovieModal';
import { type Movie } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [latestMovies, setLatestMovies] = useState<Movie[]>([]);
  const [latestSeries, setLatestSeries] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  const [topRatedSeries, setTopRatedSeries] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [topRatedTab, setTopRatedTab] = useState<'movies' | 'series'>('movies');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const topRatedScrollRef = useRef<HTMLDivElement>(null);
  const trendingScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLatestContent = async () => {
      try {
        // Trending Movies (week)
        const trendingResp = await fetch('/api/tmdb/trending?type=movie');
        const trendingJson = await trendingResp.json();
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

        // Latest Movies (Now Playing)
        const nowMoviesResp = await fetch('/api/tmdb/now-playing?type=movie');
        const nowMovies = await nowMoviesResp.json();
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

        // Latest Series (Filtered by Netflix, HBO Max, Amazon Prime, Apple TV+)
        // TMDB Provider IDs: Netflix=8, HBO Max=384, Amazon Prime=9, Apple TV+=350
        // Fetch with provider filter for latest series
        const today = new Date();
        const pastYear = new Date();
        pastYear.setFullYear(today.getFullYear() - 1);
        const yearMin = pastYear.getFullYear();
        const yearMax = today.getFullYear();
        const nowSeriesResp = await fetch(`/api/tmdb/discover?type=tv&with_watch_providers=8,384,9,350&watch_region=SA&yearMin=${yearMin}&yearMax=${yearMax}&sort_by=first_air_date.desc&limit=20`);
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

        // Top Rated Movies
        const topMoviesResponse = await fetch('/api/tmdb/top-rated?type=movie');
        const topMoviesData = await topMoviesResponse.json();
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

        // Top Rated Series
        const topSeriesResponse = await fetch('/api/tmdb/top-rated?type=tv');
        const topSeriesData = await topSeriesResponse.json();
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
      } catch (error) {
        console.error('Error fetching latest content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLatestContent();
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
            backgroundImage: 'url(/background.png)',
            opacity: 0.9,
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />

        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            لا تستطيع تحديد ماذا تشاهد؟
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 mb-10 max-w-3xl mx-auto">
            أخبرنا عن حالتك المزاجية، وسنجد لك الفيلم المثالي
          </p>
          <Link href="/browse">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
              ابحث عن فيلم الآن
            </Button>
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="py-20 bg-black/50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            كيف يعمل؟
          </h2>
          <p className="text-center text-slate-400 text-lg mb-16">
            العثور على فيلمك المفضل للأمسية سهل مثل ١-٢-٣
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center hover:border-blue-600 transition">
              <div className="w-16 h-16 bg-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Clapperboard className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold mb-4">اضبط الفلاتر</h3>
              <p className="text-slate-400">
                اختر حسب التصنيف، الحقبة، المزاج، والمزيد
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center hover:border-blue-600 transition">
              <div className="w-16 h-16 bg-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Target className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold mb-4">احصل على اقتراحات مخصصة</h3>
              <p className="text-slate-400">
                خوارزميتنا تجد ما يناسبك تمامًا
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center hover:border-blue-600 transition">
              <div className="w-16 h-16 bg-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold mb-4">استمتع بأمسيتك السينمائية</h3>
              <p className="text-slate-400">
                نوفر لك روابط لأماكن المشاهدة
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Movies */}
      <section className="py-14 bg-black/40">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h2 className="text-3xl md:text-4xl font-bold">الأكثر رواجاً هذا الأسبوع</h2>
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
              <p className="text-slate-400">أفلام أكتوبر الجديدة</p>
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
              <h2 className="text-3xl md:text-4xl font-bold">أفضل 10 تقييمات</h2>
              
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

      {/* Subscription CTA Banner */}
      <section className="py-16 bg-black/50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto relative">
            {/* Film strip decorative elements */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="flex gap-2 overflow-hidden h-full justify-center">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="w-12 h-12 bg-white rounded" />
                    <div className="w-12 h-8 bg-white rounded" />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Main banner content */}
            <div className="relative bg-gradient-to-br from-slate-900 via-black to-slate-900 rounded-3xl p-10 md:p-16 shadow-2xl border-4 border-slate-700/50 overflow-hidden">
              {/* Top film strip decoration */}
              <div className="absolute top-0 left-0 right-0 h-4 bg-gray-800/30 flex gap-2 px-2">
                {[...Array(30)].map((_, i) => (
                  <div key={i} className="w-2 h-full bg-white/20" />
                ))}
              </div>
              
              {/* Animated film icons */}
              <div className="absolute top-8 left-8 opacity-10">
                <Film className="w-24 h-24 text-white" />
              </div>
              <div className="absolute bottom-8 right-8 opacity-10">
                <Film className="w-32 h-32 text-white" />
              </div>
              
              {/* Content */}
              <div className="relative z-10 text-center pt-6">
                <div className="mb-6">
                  <Film className="w-20 h-20 text-blue-400 mx-auto mb-6 animate-pulse" />
                  <h2 className="text-4xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg" style={{ fontFamily: 'var(--font-arabic)' }}>
                    ما عندك اشتراك تتابع الفلم؟
                  </h2>
                  <p className="text-2xl md:text-3xl text-gray-300 font-semibold mb-8" style={{ fontFamily: 'var(--font-arabic)' }}>
                    احصل على اشتراك IPTV لمتابعة الفلم
                  </p>
                </div>
                
                <Button
                  size="lg"
                  className="bg-white text-black hover:bg-gray-100 font-bold text-2xl px-16 py-8 h-auto rounded-full shadow-2xl hover:scale-105 transition-all duration-200"
                  style={{ fontFamily: 'var(--font-arabic)' }}
                >
                  <Film className="w-7 h-7 ml-3" />
                  زور متجرنا
                </Button>
              </div>
              
              {/* Bottom film strip decoration */}
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gray-800/30 flex gap-2 px-2">
                {[...Array(30)].map((_, i) => (
                  <div key={i} className="w-2 h-full bg-white/20" />
                ))}
              </div>
            </div>
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
