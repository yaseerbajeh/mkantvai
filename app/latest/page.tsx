'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import MovieCard from '@/components/MovieCard';
import { type Movie } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function LatestPage() {
  const searchParams = useSearchParams();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  
  const type = searchParams.get('type') || 'all';
  const newMonth = searchParams.get('new') || 'oct';

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (type !== 'all') params.set('type', type);
        params.set('new', newMonth);
        params.set('limit', '50'); // Show more results

        const response = await fetch(`/api/movies?${params.toString()}`);
        const data = await response.json();
        
        setMovies(data.movies || []);
        setTotal(data.total || 0);
      } catch (error) {
        console.error('Error fetching movies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [type, newMonth]);

  const getTitle = () => {
    if (type === 'movie') return 'أحدث الأفلام';
    if (type === 'series') return 'أحدث المسلسلات';
    return 'أحدث المحتوى';
  };

  const getSubtitle = () => {
    const monthName = newMonth === 'oct' ? 'أكتوبر' : newMonth;
    if (type === 'movie') return `أفلام ${monthName} الجديدة`;
    if (type === 'series') return `مسلسلات ${monthName} الجديدة`;
    return `محتوى ${monthName} الجديد`;
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
                <MovieCard key={movie.id} movie={movie} />
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
    </div>
  );
}

