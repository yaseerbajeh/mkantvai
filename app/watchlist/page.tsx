'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MovieCard from '@/components/MovieCard';
import MovieModal from '@/components/MovieModal';
import { Button } from '@/components/ui/button';
import { type Movie } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Heart, Sparkles, ArrowLeft } from 'lucide-react';

function WatchlistPageContent() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/auth');
      } else {
        setUser(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push('/auth');
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchWatchlist();
    }
  }, [user]);

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      // Get auth token from session
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/watchlist', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWatchlist(data.watchlist || []);
      } else {
        console.error('Failed to fetch watchlist');
      }
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchlistChange = () => {
    // Refresh watchlist when an item is removed
    fetchWatchlist();
  };

  const handleCardClick = (movie: Movie) => {
    setSelectedMovie(movie);
    setIsModalOpen(true);
  };

  if (!user) {
    return null; // Will redirect to /auth
  }

  return (
    <div className="min-h-screen bg-black text-white" dir="rtl">
      <Header />
      <div className="pt-24 pb-20 container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <Heart className="w-8 h-8 text-red-500 fill-red-500" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-2">قائمة المشاهدة</h1>
                  <p className="text-slate-300 text-lg">
                    {watchlist.length > 0
                      ? `${watchlist.length} ${watchlist.length === 1 ? 'عنصر' : 'عناصر'} محفوظة`
                      : 'قائمتك فارغة'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <ArrowLeft className="w-4 h-4 ml-2" />
                العودة للرئيسية
              </Button>
            </div>
            <div className="h-1 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 rounded-full" />
          </div>

          {/* Watchlist Content */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-2xl h-[450px] animate-pulse border border-slate-700"
                />
              ))}
            </div>
          ) : watchlist.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {watchlist.map((movie) => (
                <MovieCard 
                  key={movie.id} 
                  movie={movie} 
                  onWatchlistChange={handleWatchlistChange}
                  onCardClick={() => handleCardClick(movie)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700">
              <Heart className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">قائمتك فارغة</h3>
              <p className="text-xl text-slate-400 mb-6">
                ابدأ بإضافة أفلام ومسلسلات تريد مشاهدتها لاحقاً
              </p>
              <Button
                onClick={() => router.push('/')}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 gap-2"
              >
                <Sparkles className="w-5 h-5" />
                تصفح المحتوى
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Movie Modal with Delete Button */}
      <MovieModal
        movie={selectedMovie}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isWatchlistPage={true}
        onWatchlistUpdate={handleWatchlistChange}
      />

      <Footer />
    </div>
  );
}

export default dynamic(() => Promise.resolve(WatchlistPageContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white text-xl">جاري التحميل...</div>
    </div>
  ),
});

