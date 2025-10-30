'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MovieCard from '@/components/MovieCard';
import MovieModal from '@/components/MovieModal';
import { Button } from '@/components/ui/button';
import { type Movie } from '@/lib/supabase';
import { Trophy, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

function TopSeriesPageContent() {
  const router = useRouter();
  const [series, setSeries] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeries, setSelectedSeries] = useState<Movie | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchTopSeries();
  }, []);

  const fetchTopSeries = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/movies?type=series&sortBy=rating&limit=50');
      const data = await response.json();
      setSeries(data.movies || []);
    } catch (error) {
      console.error('Error fetching top series:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (seriesItem: Movie) => {
    setSelectedSeries(seriesItem);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-black text-white" dir="rtl">
      <Header />
      <div className="pt-24 pb-20 container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Trophy className="w-8 h-8 text-purple-500" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-2">أفضل المسلسلات تقييماً</h1>
                  <p className="text-slate-300 text-lg">
                    {series.length > 0 ? `${series.length} مسلسل متاح` : 'جاري التحميل...'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                العودة للرئيسية
              </Button>
            </div>
            <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-full" />
          </div>

          {/* Series Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-2xl h-[450px] animate-pulse border border-slate-700"
                />
              ))}
            </div>
          ) : series.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {series.map((seriesItem, index) => (
                <div key={seriesItem.id} className="relative">
                  {/* Rank Badge for Top 10 */}
                  {index < 10 && (
                    <div className="absolute top-2 left-2 z-20 bg-gradient-to-r from-purple-400 to-pink-500 text-white px-3 py-1 rounded-full font-bold text-sm shadow-lg">
                      #{index + 1}
                    </div>
                  )}
                  <MovieCard movie={seriesItem} onCardClick={() => handleCardClick(seriesItem)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700">
              <Trophy className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">لا توجد مسلسلات</h3>
              <p className="text-xl text-slate-400 mb-6">لم نتمكن من العثور على مسلسلات</p>
              <Button onClick={() => router.push('/')} size="lg" className="bg-blue-600 hover:bg-blue-700 gap-2">
                العودة للرئيسية
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Series Modal */}
      <MovieModal
        movie={selectedSeries}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <Footer />
    </div>
  );
}

export default dynamic(() => Promise.resolve(TopSeriesPageContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white text-xl">جاري التحميل...</div>
    </div>
  ),
});

