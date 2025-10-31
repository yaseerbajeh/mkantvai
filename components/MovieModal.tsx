'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Star, Heart, Bookmark, Users } from 'lucide-react';
import { type Movie } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface MovieModalProps {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
  isWatchlistPage?: boolean; // If true, only show delete button
  onWatchlistUpdate?: () => void; // Callback when watchlist is updated
}

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

export default function MovieModal({ movie, isOpen, onClose, isWatchlistPage = false, onWatchlistUpdate }: MovieModalProps) {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState<{ cast: any[]; crew: any[] } | null>(null);
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && movie) {
      checkWatchlistStatus();
    }
  }, [user, movie]);

  useEffect(() => {
    // Fetch credits and watch providers via server API if tmdb_id is present
    const tmdbId = (movie as any)?.tmdb_id;
    const type = (movie as any)?.type === 'series' ? 'tv' : 'movie';
    if (!tmdbId) return;
    (async () => {
      try {
        const credResp = await fetch(`/api/tmdb/credits?id=${tmdbId}&type=${type}&lang=ar`);
        if (credResp.ok) {
          const c = await credResp.json();
          setCredits({ cast: c.cast || [], crew: c.crew || [] });
        }
        const provResp = await fetch(`/api/tmdb/providers?id=${tmdbId}&type=${type}&region=SA`);
        if (provResp.ok) {
          const p = await provResp.json();
          setProviders(p.providers || []);
        }
      } catch {}
    })();
  }, [movie]);

  const checkWatchlistStatus = async () => {
    if (!user || !movie) return;
    try {
      const tmdbId = (movie as any)?.tmdb_id;
      if (tmdbId) {
        const { data } = await supabase
          .from('watchlist_tmdb')
          .select('id')
          .eq('user_id', user.id)
          .eq('tmdb_id', tmdbId)
          .single();
        setIsInWatchlist(!!data);
      } else {
        const { data } = await supabase
          .from('watchlist')
          .select('id')
          .eq('user_id', user.id)
          .eq('content_id', (movie as any)?.id)
          .single();
        setIsInWatchlist(!!data);
      }
    } catch {}
  };

  const handleWatchlistToggle = async () => {
    if (!user) {
      toast({
        title: '⚠️ تسجيل الدخول مطلوب',
        description: 'يجب عليك تسجيل الدخول لإضافة إلى قائمة المشاهدة',
        variant: 'destructive',
      });
      return;
    }

    if (!movie) return;

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        toast({
          title: '❌ خطأ',
          description: 'الجلسة منتهية. يرجى تسجيل الدخول مرة أخرى',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      };

      const tmdbId = (movie as any)?.tmdb_id;
      if (isInWatchlist) {
        const endpoint = tmdbId ? `/api/watchlist-tmdb?tmdb_id=${tmdbId}` : `/api/watchlist?content_id=${(movie as any)?.id}`;
        const response = await fetch(endpoint, {
          method: 'DELETE',
          headers,
        });

        if (response.ok) {
          setIsInWatchlist(false);
          toast({
            title: '✅ تمت الإزالة',
            description: 'تمت إزالة العنصر من قائمة المشاهدة',
          });
          // Call the update callback if provided
          if (onWatchlistUpdate) {
            onWatchlistUpdate();
          }
          // If on watchlist page, close modal after deletion
          if (isWatchlistPage) {
            setTimeout(() => onClose(), 500);
          }
        } else {
          const data = await response.json();
          toast({
            title: '❌ خطأ',
            description: data.error || 'فشل في إزالة العنصر',
            variant: 'destructive',
          });
        }
      } else {
        const response = await fetch(tmdbId ? '/api/watchlist-tmdb' : '/api/watchlist', {
          method: 'POST',
          headers,
          body: JSON.stringify(tmdbId ? { tmdb_id: tmdbId } : { content_id: (movie as any)?.id }),
        });

        if (response.ok) {
          setIsInWatchlist(true);
          toast({
            title: '✅ تمت الإضافة',
            description: 'تمت إضافة العنصر إلى قائمة المشاهدة',
          });
          // Call the update callback if provided
          if (onWatchlistUpdate) {
            onWatchlistUpdate();
          }
        } else {
          const data = await response.json();
          toast({
            title: '❌ خطأ',
            description: data.error || 'فشل في إضافة العنصر',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error toggling watchlist:', error);
      toast({
        title: '❌ خطأ',
        description: 'حدث خطأ غير متوقع',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !movie) return null;

  // Platform logos removed; providers will be shown as badges in details

  const genresRaw = movie.genre ? movie.genre.split(/[,|/]/).map(g => g.trim()).filter(Boolean) : [];
  const genres = genresRaw.map(g => GENRE_MAP_EN_TO_AR[g] || g);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full transition"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Poster */}
          <div className="relative aspect-[2/3] md:rounded-r-2xl overflow-hidden">
            {movie.url ? (
              <img src={movie.url} alt={movie.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                لا توجد صورة
              </div>
            )}
            
            {/* Providers overlay intentionally omitted */}

            {/* Note Badge */}
            {movie.note && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2 rounded-full text-sm font-bold shadow-xl">
                ✨ {movie.note}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-8 space-y-6">
            <div>
              <h2 className="text-3xl font-bold mb-4">{movie.title}</h2>
              
              {/* Info Pills */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {movie.year && (
                  <div className="flex items-center gap-1 text-slate-300">
                    <Calendar className="w-4 h-4" />
                    <span>{movie.year}</span>
                  </div>
                )}
                {movie.duration && (
                  <div className="flex items-center gap-1 text-slate-300">
                    <Clock className="w-4 h-4" />
                    <span>{movie.duration}</span>
                  </div>
                )}
                {movie.rating && (
                  <div className="flex items-center gap-1 text-yellow-500 font-semibold">
                    <Star className="w-4 h-4 fill-yellow-500" />
                    <span>{movie.rating}</span>
                  </div>
                )}
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-6">
                {genres.map((genre, idx) => (
                  <Badge key={idx} variant="secondary" className="bg-slate-700 text-slate-200">
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-xl font-bold mb-3">القصة</h3>
              <p className="text-slate-300 leading-relaxed">
                {movie.synopsis || 'لا يوجد وصف متاح'}
              </p>
            </div>

            {/* Watch Providers */}
            {providers.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mb-3">أماكن المشاهدة</h3>
                <div className="flex flex-wrap gap-2">
                  {providers.map((p, i) => (
                    <Badge key={i} className="bg-slate-700 text-slate-200">{p}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Top Cast */}
            {credits?.cast?.length ? (
              <div>
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2"><Users className="w-5 h-5" /> أبرز الممثلين</h3>
                <div className="flex flex-wrap gap-2 text-slate-300">
                  {credits.cast.slice(0, 8).map((c: any) => (
                    <span key={c.cast_id || c.credit_id} className="px-2 py-1 bg-slate-800 rounded-full text-sm">{c.name}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              {isWatchlistPage ? (
                // Delete button for watchlist page
                <Button
                  onClick={handleWatchlistToggle}
                  disabled={isLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <X className="w-5 h-5 ml-2" />
                  حذف من قائمة المشاهدة
                </Button>
              ) : (
                // Add/Remove button for other pages
                <Button
                  onClick={handleWatchlistToggle}
                  disabled={isLoading}
                  className={`flex-1 ${
                    isInWatchlist
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <Bookmark className={`w-5 h-5 ml-2 ${isInWatchlist ? 'fill-white' : ''}`} />
                  {isInWatchlist ? 'في قائمة المشاهدة' : 'إضافة لقائمة المشاهدة'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

