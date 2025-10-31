'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import MovieCard from '@/components/MovieCard';
import MovieModal from '@/components/MovieModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Sparkles, Film, ShoppingCart, Tv, Smartphone, Monitor, Laptop } from 'lucide-react';
import { type Movie } from '@/lib/supabase';

// Genre mapping: English database -> Arabic display
const GENRE_MAP_EN_TO_AR: Record<string, string> = {
  'Action': 'أكشن',
  'Comedy': 'كوميديا',
  'Drama': 'دراما',
  'Sci-Fi': 'خيال علمي',
  'Thriller': 'إثارة',
  'Horror': 'رعب',
  'Romance': 'رومانسي',
  'Adventure': 'مغامرات',
  'Fantasy': 'فانتازيا',
  'Crime': 'جريمة'
};

// Map common genre names (EN/AR) to TMDB numeric IDs
const TMDB_GENRE_ID_MAP: Record<string, number> = {
  // Movies (and shared)
  'action': 28, 'أكشن': 28,
  'adventure': 12, 'مغامرات': 12,
  'animation': 16, 'رسوم متحركة': 16,
  'comedy': 35, 'كوميديا': 35,
  'crime': 80, 'جريمة': 80,
  'documentary': 99, 'وثائقي': 99,
  'drama': 18, 'دراما': 18,
  'family': 10751, 'عائلي': 10751,
  'fantasy': 14, 'فانتازيا': 14,
  'history': 36, 'تاريخ': 36,
  'horror': 27, 'رعب': 27,
  'music': 10402, 'موسيقى': 10402,
  'mystery': 9648, 'غموض': 9648,
  'romance': 10749, 'رومانسي': 10749,
  'science fiction': 878, 'sci-fi': 878, 'خيال علمي': 878,
  'tv movie': 10770, 'فيلم تلفزيوني': 10770,
  'thriller': 53, 'إثارة': 53,
  'war': 10752, 'حرب': 10752,
  'western': 37, 'غربي': 37,
  // TV-specific (we include in case type=tv)
  'action & adventure': 10759, 'أكشن ومغامرات': 10759,
  'kids': 10762, 'أطفال': 10762,
  'news': 10763, 'أخبار': 10763,
  'reality': 10764, 'واقعي': 10764,
  'sci-fi & fantasy': 10765, 'خيال علمي وفانتازيا': 10765,
  'soap': 10766, 'دراما تلفزيونية': 10766,
  'talk': 10767, 'حواري': 10767,
  'war & politics': 10768, 'حرب وسياسة': 10768,
};

function SuggestionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const type = searchParams.get('type');
    const genres = searchParams.get('genres');
    const yearMin = searchParams.get('yearMin');
    const yearMax = searchParams.get('yearMax');
    const platforms = searchParams.get('platforms');

    const filterObj = {
      type: type || 'all',
      genres: genres ? genres.split(',') : [],
      yearMin: yearMin ? parseInt(yearMin) : 1950,
      yearMax: yearMax ? parseInt(yearMax) : 2030,
      platforms: platforms ? platforms.split(',') : [],
    };

    setFilters(filterObj);
    fetchSuggestions(filterObj);
  }, [searchParams]);

  const handleCardClick = (movie: Movie) => {
    setSelectedMovie(movie);
    setIsModalOpen(true);
  };

  const fetchSuggestions = async (filterObj: any) => {
    setLoading(true);
    setError(null);
    console.log('[CLIENT] Fetching suggestions with filters:', filterObj);
    
    try {
      // Build query params
      const params = new URLSearchParams();
      
      const tmdbType = filterObj.type === 'series' ? 'tv' : 'movie';
      params.append('type', tmdbType);
      if (filterObj.yearMin) params.append('yearMin', filterObj.yearMin.toString());
      if (filterObj.yearMax) params.append('yearMax', filterObj.yearMax.toString());
      // Map selected genres to TMDB IDs
      if (filterObj.genres && filterObj.genres.length > 0) {
        const ids = Array.from(new Set(filterObj.genres
          .map((g: string) => (TMDB_GENRE_ID_MAP[g] || TMDB_GENRE_ID_MAP[g.toLowerCase()] || TMDB_GENRE_ID_MAP[(GENRE_MAP_EN_TO_AR[g] ? g : '')]) )
        ))
        .filter(Boolean) as number[];
        if (ids.length > 0) {
          params.append('genres', ids.join(','));
        }
      }
      const apiUrl = `/api/tmdb/discover?${params.toString()}&limit=3`;
      console.log('[CLIENT] API URL:', apiUrl);
      
      // Fetch from API
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      console.log('[CLIENT] API Response status:', response.status);
      console.log('[CLIENT] API Response data:', result);
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch suggestions');
      }

      const items = result.items || [];
      const mapped = items.map((m: any) => ({
        id: String(m.tmdb_id),
        tmdb_id: m.tmdb_id,
        type: tmdbType === 'tv' ? 'series' : 'movie',
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
      setMovies(mapped);
      console.log('[CLIENT] Movies set:', mapped.length, 'movies');
      
      if (mapped.length === 0) {
        console.warn('[CLIENT] No movies returned from API');
      }
    } catch (error: any) {
      console.error('[CLIENT] Error fetching suggestions:', error);
      setError(error.message);
      setMovies([]);
    } finally {
      setLoading(false);
      console.log('[CLIENT] Loading complete');
    }
  };

  const generateNewSuggestions = () => {
    fetchSuggestions(filters);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <div className="pt-24 pb-20 container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
              <Sparkles className="w-8 h-8 text-blue-500" />
              <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg">
                <span className="bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">أفضل 3 اختيارات لك</span>
              </h1>
              <Sparkles className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-lg md:text-xl text-slate-300 mt-2">
              تم اختيارها بعناية بناءً على تفضيلاتك
            </p>
          </div>

          {/* Active Filters */}
          {(filters.genres?.length > 0 || filters.platforms?.length > 0 || filters.type !== 'all') && (
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {filters.type && filters.type !== 'all' && (
                <Badge variant="secondary" className="bg-blue-600 text-white px-3 py-1">
                  {filters.type === 'movie' ? 'أفلام' : 'مسلسلات'}
                </Badge>
              )}
              {filters.genres && filters.genres.length > 0 && filters.genres.map((genre: string) => (
                <Badge key={genre} variant="secondary" className="bg-purple-600 text-white px-3 py-1">
                  {GENRE_MAP_EN_TO_AR[genre] || genre}
                </Badge>
              ))}
              {filters.platforms && filters.platforms.length > 0 && filters.platforms.map((platform: string) => (
                <Badge key={platform} variant="secondary" className="bg-indigo-600 text-white px-3 py-1">
                  {platform}
                </Badge>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-slate-800/50 rounded-2xl h-[700px] animate-pulse border border-slate-700" />
              ))}
            </div>
          ) : movies.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {movies.map((movie, index) => {
                  const rankColors = ['from-yellow-400 to-orange-500', 'from-slate-300 to-slate-400', 'from-amber-600 to-amber-700'];
                  const rankLabels = ['الاختيار الأول', 'الاختيار الثاني', 'الاختيار الثالث'];

                  return (
                    <div key={movie.id} className="relative">
                      {/* Rank Badge - positioned absolutely over the MovieCard */}
                      <div 
                        className={`absolute top-2 right-2 z-30 bg-gradient-to-r ${rankColors[index]} text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg`}
                      >
                        {rankLabels[index]}
                      </div>
                      
                      {/* MovieCard with all functionality including watchlist */}
                      <MovieCard movie={movie} onCardClick={() => handleCardClick(movie)} />
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                <Button
                  onClick={generateNewSuggestions}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 gap-2 px-8 text-lg shadow-lg"
                >
                  <RefreshCw className="w-5 h-5" />
                  اعرض 3 اختيارات مختلفة
                </Button>
                <Button
                  onClick={() => router.push('/browse')}
                  size="lg"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 px-8 text-lg"
                >
                  تغيير الفلاتر
                </Button>
              </div>

              {/* Makaan TU Logo and CTA Section */}
              <div className="my-16 relative">
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
                    <Link href="https://your-store-url.com" target="_blank" rel="noopener noreferrer">
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
            </>
          ) : error ? (
            <div className="text-center py-20 bg-red-900/20 rounded-2xl border-2 border-dashed border-red-700">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h3 className="text-2xl font-bold mb-2 text-red-400">خطأ في تحميل الاقتراحات</h3>
              <p className="text-xl text-slate-400 mb-6">
                {error}
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={generateNewSuggestions}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  حاول مرة أخرى
                </Button>
                <Button
                  onClick={() => router.push('/browse')}
                  size="lg"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  تغيير الفلاتر
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700">
              <Sparkles className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">لا توجد نتائج مطابقة</h3>
              <p className="text-xl text-slate-400 mb-6">
                لم نتمكن من العثور على أفلام مطابقة لتفضيلاتك
              </p>
              <Button
                onClick={() => router.push('/browse')}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                جرب فلاتر مختلفة
              </Button>
            </div>
          )}
        </div>
      </div>

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
          <div>
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

      {/* Movie Modal */}
      <MovieModal
        movie={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

// Export with dynamic import to prevent hydration issues
export default dynamic(() => Promise.resolve(SuggestionsPageContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <div className="pt-24 pb-20 container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="h-12 w-96 mx-auto bg-slate-800 rounded-xl animate-pulse mb-4"></div>
          <div className="h-6 w-64 mx-auto bg-slate-700 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 rounded-2xl h-[700px] animate-pulse border border-slate-700" />
          ))}
        </div>
      </div>
    </div>
  )
});
