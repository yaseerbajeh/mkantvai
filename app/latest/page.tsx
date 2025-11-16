'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import MovieCard from '@/components/MovieCard';
import MovieModal from '@/components/MovieModal';
import { type Movie } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function LatestPage() {
  const searchParams = useSearchParams();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const type = searchParams.get('type') || 'movie';

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        let resp;
        if (type === 'both') {
          // Fetch both movies and series
          const [moviesResp, seriesResp] = await Promise.all([
            fetch(`/api/tmdb/now-playing?type=movie&lang=ar`),
            (async () => {
              const today = new Date();
              const pastYear = new Date();
              pastYear.setFullYear(today.getFullYear() - 1);
              const yearMin = pastYear.getFullYear();
              const yearMax = today.getFullYear();
              let seriesResponse = await fetch(`/api/tmdb/discover?type=tv&with_watch_providers=8,384,9,350&watch_region=SA&yearMin=${yearMin}&yearMax=${yearMax}&sort_by=first_air_date.desc&limit=20`);
              if (!seriesResponse.ok) {
                seriesResponse = await fetch(`/api/tmdb/discover?type=tv&yearMin=${yearMin}&yearMax=${yearMax}&sort_by=first_air_date.desc&limit=20`);
              }
              if (!seriesResponse.ok) {
                seriesResponse = await fetch(`/api/tmdb/discover?type=tv&sort_by=popularity.desc&limit=20`);
              }
              return seriesResponse;
            })()
          ]);

          const moviesData = (await moviesResp.json()) || { items: [] };
          const seriesData = (await seriesResp.json()) || { items: [] };

          const moviesMapped = (moviesData.items || []).map((m: any) => ({
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

          const seriesMapped = (seriesData.items || []).map((m: any) => ({
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

          const combined = [...moviesMapped, ...seriesMapped];
          setMovies(combined);
          setTotal(combined.length);
          return; // Early return since 'both' case is fully handled
        } else if (type === 'series') {
          // For series: use discover with provider filters (Netflix, HBO Max, Amazon Prime, Apple TV+)
          // TMDB Provider IDs: Netflix=8, HBO Max=384, Amazon Prime=9, Apple TV+=350
          const today = new Date();
          const pastYear = new Date();
          pastYear.setFullYear(today.getFullYear() - 1);
          const yearMin = pastYear.getFullYear();
          const yearMax = today.getFullYear();
          // Try primary: same as Home (API max limit is 20)
          resp = await fetch(`/api/tmdb/discover?type=tv&with_watch_providers=8,384,9,350&watch_region=SA&yearMin=${yearMin}&yearMax=${yearMax}&sort_by=first_air_date.desc&limit=20`);

          // If primary fails or returns empty, try fallback without provider filter
          if (!resp.ok) {
            console.error('Primary discover (providers) failed:', resp.status);
          }
          let data = await resp.json().catch(() => ({ items: [], error: 'parse_error' }));
          if (!resp.ok || data?.items?.length === 0) {
            const fb1 = await fetch(`/api/tmdb/discover?type=tv&yearMin=${yearMin}&yearMax=${yearMax}&sort_by=first_air_date.desc&limit=20`);
            if (fb1.ok) {
              data = await fb1.json();
            } else {
              console.error('Fallback 1 (no providers) failed:', fb1.status);
              // Final fallback: popularity without year constraint
              const fb2 = await fetch(`/api/tmdb/discover?type=tv&sort_by=popularity.desc&limit=20`);
              data = await fb2.json().catch(() => ({ items: [], error: 'parse_error' }));
              resp = fb2;
            }
            // Normalize resp to carry the last response status for error handling below
            if (data && !resp.ok) {
              resp = new Response(JSON.stringify(data), { status: 200 });
            }
            // Replace the parsing branch by stashing parsed data for use below
            // We'll reuse "data" variable after else branch too
            // To keep structure consistent, move assignment to a scoped variable
            (resp as any)._parsed = data;
          } else {
            (resp as any)._parsed = data;
          }
        } else {
          // For movies: use now-playing
          resp = await fetch(`/api/tmdb/now-playing?type=movie&lang=ar`);
        }
        
        // Type guard: resp should always be defined here, but TypeScript needs assurance
        if (!resp) {
          throw new Error('No response received');
        }
        
        const data = (resp as any)._parsed || (await resp.json());
        if (data.error) {
          console.error('Error fetching:', data.error);
          setMovies([]);
          setTotal(0);
        } else {
          const mapped = (data.items || []).map((m: any) => ({
            id: String(m.tmdb_id),
            tmdb_id: m.tmdb_id,
            type: type === 'series' ? 'series' : 'movie',
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
          setTotal(mapped.length);
        }
      } catch (error) {
        console.error('Error fetching movies:', error);
        setMovies([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [type]);

  const handleCardClick = (movie: Movie) => {
    setSelectedMovie(movie);
    setIsModalOpen(true);
  };

  const getTitle = () => {
    if (type === 'movie') return 'أحدث الأفلام';
    if (type === 'series') return 'أحدث المسلسلات';
    if (type === 'both') return 'احدث الافلام والمسلسلات في أروما';
    return 'أحدث المحتوى';
  };

  const getSubtitle = () => {
    if (type === 'movie') return `أفلام معروضة الآن`;
    if (type === 'series') return `مسلسلات نتفلكس شاهد واشتراك اروما`;
    if (type === 'both') return `أفلام ومسلسلات تو نازلة`;
    return '';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      
      <div className="pt-24 pb-20 container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <Link href="/">
              <Button variant="ghost" className="mb-4 text-slate-400 hover:text-white">
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة للرئيسية
              </Button>
            </Link>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-4">{getTitle()}</h1>
            <p className="text-xl text-slate-400">{getSubtitle()}</p>
            
            {!loading && (
              <p className="text-slate-500 mt-2">
                {total} {type === 'movie' ? 'فيلم' : type === 'series' ? 'مسلسل' : 'عنصر'}
              </p>
            )}
          </div>

          {/* Movies Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-slate-800/50 rounded-lg h-[500px] animate-pulse" />
              ))}
            </div>
          ) : movies.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {movies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} onCardClick={() => handleCardClick(movie)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700">
              <div className="text-6xl mb-4">🎬</div>
              <h3 className="text-2xl font-bold mb-2">لا توجد نتائج</h3>
              <p className="text-xl text-slate-400 mb-6">
                لم نجد محتوى جديد هذا الشهر
              </p>
              <Link href="/">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  العودة للرئيسية
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Movie Modal */}
      <MovieModal
        movie={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

