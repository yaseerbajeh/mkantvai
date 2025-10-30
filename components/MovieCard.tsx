'use client';

import { useState, useEffect } from 'react';
import { type Movie } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Star, Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';

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

interface MovieCardProps {
  movie: Movie;
  onWatchlistChange?: () => void; // Callback when watchlist changes
  onCardClick?: () => void; // Callback when card is clicked
}

export default function MovieCard({ movie, onWatchlistChange, onCardClick }: MovieCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // Split genre string into array (if it contains commas or other separators)
  const genresRaw = movie.genre ? movie.genre.split(/[,|/]/).map(g => g.trim()).filter(Boolean) : [];
  // Translate genres to Arabic for display
  const genres = genresRaw.map(g => GENRE_MAP_EN_TO_AR[g] || g);

  // Check if user is authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if movie is in user's watchlist
  useEffect(() => {
    if (user) {
      checkWatchlistStatus();
    }
  }, [user, movie.id]);

  const checkWatchlistStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', movie.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is expected if not in watchlist
        console.error('Error checking watchlist:', error);
      }

      setIsInWatchlist(!!data);
    } catch (error) {
      console.error('Error checking watchlist:', error);
    }
  };

  const handleWatchlistToggle = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    // Check if user is authenticated
    if (!user) {
      setShowAuthDialog(true);
      return;
    }

    setIsLoading(true);

    try {
      // Get auth token from session
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;
      
      console.log('[MovieCard] Session found:', !!session);
      console.log('[MovieCard] Auth token found:', !!authToken);

      if (!authToken) {
        console.log('[MovieCard] No auth token - showing error toast');
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
      
      console.log('[MovieCard] Sending request with auth header');

      if (isInWatchlist) {
        // Remove from watchlist
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
          if (onWatchlistChange) onWatchlistChange();
        } else {
          const data = await response.json();
          toast({
            title: '❌ خطأ',
            description: data.error || 'فشل في إزالة العنصر',
            variant: 'destructive',
          });
        }
      } else {
        // Add to watchlist
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
          if (onWatchlistChange) onWatchlistChange();
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
  
  // Get additional platform logos (excluding IPTV since it's always shown)
  const getAdditionalPlatformLogos = () => {
    if (!movie.platform) return [];
    
    const platformLower = movie.platform.toLowerCase();
    const logos = [];
    
    if (platformLower.includes('netflix')) {
      logos.push({ url: '/logos/netflix.svg', name: 'Netflix' });
    }
    if (platformLower.includes('shahid')) {
      logos.push({ url: '/logos/shahid.svg', name: 'Shahid' });
    }
    if (platformLower.includes('amazon') || platformLower.includes('prime')) {
      logos.push({ url: '/logos/amazon-prime.svg', name: 'Amazon Prime' });
    }
    if (platformLower.includes('disney')) {
      logos.push({ url: '/logos/disney-plus.svg', name: 'Disney+' });
    }
    if (platformLower.includes('hbo')) {
      logos.push({ url: '/logos/hbo-max.svg', name: 'HBO Max' });
    }
    if (platformLower.includes('apple')) {
      logos.push({ url: '/logos/apple-tv.svg', name: 'Apple TV+' });
    }
    if (platformLower.includes('hulu')) {
      logos.push({ url: '/logos/hulu.svg', name: 'Hulu' });
    }
    
    return logos;
  };

  // Always show IPTV logo, plus any additional platforms found
  const platformLogos = [
    { url: '/logos/iptv.png', name: 'IPTV' },
    ...getAdditionalPlatformLogos()
  ];
  
  return (
    <>
      <div 
        className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden hover:border-blue-600 transition group cursor-pointer"
        onClick={onCardClick}
      >
      <div className="aspect-[2/3] bg-slate-700 relative overflow-hidden">
        {movie.url ? (
          <img
            src={movie.url}
            alt={movie.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            لا توجد صورة
          </div>
        )}
        
        {/* Platform Logos Stacked Vertically in Upper Left (RTL) */}
        {platformLogos.length > 0 && (
          <div className="absolute top-2 left-2 flex flex-col gap-2">
            {platformLogos.map((logo, index) => {
              const isIPTV = logo.name === 'IPTV';
              return (
                <div 
                  key={index}
                  className={`${isIPTV ? '' : 'bg-black/70 backdrop-blur-sm'} rounded ${isIPTV ? 'p-0' : 'p-1.5'} shadow-lg`}
                >
                  <img
                    src={logo.url}
                    alt={logo.name}
                    className={`${isIPTV ? 'h-12 w-12 object-cover' : 'h-4 w-auto'}`}
                    title={logo.name}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Note Badge - Bottom Center */}
        {movie.note && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm border border-amber-400/50 whitespace-nowrap">
            ✨ {movie.note}
          </div>
        )}

      </div>

      <div className="p-4">
        {/* Title with Watchlist Button */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-lg truncate flex-1">{movie.title}</h3>
          
          {/* Watchlist Button - Next to Title */}
          <button
            onClick={handleWatchlistToggle}
            disabled={isLoading}
            className={`flex-shrink-0 p-2 rounded-full transition-all ${
              isInWatchlist
                ? 'bg-red-500/90 hover:bg-red-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isInWatchlist ? 'إزالة من قائمة المشاهدة' : 'إضافة إلى قائمة المشاهدة'}
          >
            <Heart
              className={`w-4 h-4 transition-all ${
                isInWatchlist ? 'fill-white' : ''
              }`}
            />
          </button>
        </div>
        
        {/* Movie Info Pills - Year, Duration, Rating */}
        <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
          {movie.year && (
            <div className="flex items-center gap-1 text-slate-300">
              <Calendar className="w-3 h-3" />
              <span>{movie.year}</span>
            </div>
          )}
          {movie.duration && (
            <div className="flex items-center gap-1 text-slate-300">
              <Clock className="w-3 h-3" />
              <span>{movie.duration}</span>
            </div>
          )}
          {movie.rating && (
            <div className="flex items-center gap-1 text-yellow-500 font-semibold">
              <Star className="w-3 h-3 fill-yellow-500" />
              <span>{movie.rating}</span>
            </div>
          )}
        </div>
        
        {movie.synopsis && (
          <p className="text-slate-300 text-xs mb-3 line-clamp-3 leading-relaxed">
            {movie.synopsis}
          </p>
        )}

        <div className="flex flex-wrap gap-1">
          {genres.slice(0, 2).map((genre, index) => (
            <Badge key={index} variant="secondary" className="text-xs bg-slate-700 text-slate-300">
              {genre}
            </Badge>
          ))}
        </div>
      </div>
    </div>

      {/* Auth Required Dialog */}
      <AlertDialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-right">
              تسجيل الدخول مطلوب
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 text-right">
              يجب عليك تسجيل الدخول لإضافة عناصر إلى قائمة المشاهدة الخاصة بك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => {
                setShowAuthDialog(false);
                router.push('/auth');
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              تسجيل الدخول
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => setShowAuthDialog(false)}
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-600"
            >
              إلغاء
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
