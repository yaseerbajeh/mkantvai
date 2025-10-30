'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Star, Heart, Bookmark } from 'lucide-react';
import { type Movie } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface MovieModalProps {
  movie: Movie | null;
  isOpen: boolean;
  onClose: () => void;
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

export default function MovieModal({ movie, isOpen, onClose }: MovieModalProps) {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const checkWatchlistStatus = async () => {
    if (!user || !movie) return;
    
    try {
      const { data } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', movie.id)
        .single();

      setIsInWatchlist(!!data);
    } catch (error) {
      // Ignore error
    }
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

      if (isInWatchlist) {
        const response = await fetch(`/api/watchlist?content_id=${movie.id}`, {
          method: 'DELETE',
          headers,
        });

        if (response.ok) {
          setIsInWatchlist(false);
          toast({
            title: '✅ تمت الإزالة',
            description: 'تمت إزالة العنصر من قائمة المشاهدة',
          });
        } else {
          const data = await response.json();
          toast({
            title: '❌ خطأ',
            description: data.error || 'فشل في إزالة العنصر',
            variant: 'destructive',
          });
        }
      } else {
        const response = await fetch('/api/watchlist', {
          method: 'POST',
          headers,
          body: JSON.stringify({ content_id: movie.id }),
        });

        if (response.ok) {
          setIsInWatchlist(true);
          toast({
            title: '✅ تمت الإضافة',
            description: 'تمت إضافة العنصر إلى قائمة المشاهدة',
          });
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

  // Get platform logos
  const getAdditionalPlatformLogos = () => {
    if (!movie.platform) return [];
    
    const platformLower = movie.platform.toLowerCase();
    const logos = [];
    
    if (platformLower.includes('netflix')) logos.push({ url: '/logos/netflix.svg', name: 'Netflix' });
    if (platformLower.includes('shahid')) logos.push({ url: '/logos/shahid.svg', name: 'Shahid' });
    if (platformLower.includes('amazon') || platformLower.includes('prime')) logos.push({ url: '/logos/amazon-prime.svg', name: 'Amazon Prime' });
    if (platformLower.includes('disney')) logos.push({ url: '/logos/disney-plus.svg', name: 'Disney+' });
    if (platformLower.includes('hbo')) logos.push({ url: '/logos/hbo-max.svg', name: 'HBO Max' });
    if (platformLower.includes('apple')) logos.push({ url: '/logos/apple-tv.svg', name: 'Apple TV+' });
    if (platformLower.includes('hulu')) logos.push({ url: '/logos/hulu.svg', name: 'Hulu' });
    
    return logos;
  };

  const platformLogos = [
    { url: '/logos/iptv.png', name: 'IPTV' },
    ...getAdditionalPlatformLogos()
  ];

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
            
            {/* Platform Logos */}
            {platformLogos.length > 0 && (
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {platformLogos.map((logo, idx) => {
                  const isIPTV = logo.name === 'IPTV';
                  return (
                    <div key={idx} className={`${isIPTV ? '' : 'bg-black/70 backdrop-blur-sm'} rounded ${isIPTV ? 'p-0' : 'p-2'} shadow-lg`}>
                      <img src={logo.url} alt={logo.name} className={`${isIPTV ? 'h-12 w-12 object-cover' : 'h-6 w-auto'}`} title={logo.name} />
                    </div>
                  );
                })}
              </div>
            )}

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

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

