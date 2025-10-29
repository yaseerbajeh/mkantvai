'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuCheckboxItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ChevronDown } from 'lucide-react';

// Genre mapping: Arabic display -> English database value
const GENRE_MAP: Record<string, string> = {
  'أكشن': 'Action',
  'كوميديا': 'Comedy',
  'دراما': 'Drama',
  'خيال علمي': 'Sci-Fi',
  'إثارة': 'Thriller',
  'رعب': 'Horror',
  'رومانسي': 'Romance',
  'مغامرات': 'Adventure',
  'فانتازيا': 'Fantasy',
  'جريمة': 'Crime'
};

const GENRES = Object.keys(GENRE_MAP); // Arabic names for display
const PLATFORMS = ['Netflix', 'Shahid', 'IPTV', 'Amazon Prime', 'Disney+', 'HBO Max', 'Hulu', 'Apple TV+'];

// Generate years from 2025 down to 1950
const YEARS = Array.from({ length: 2025 - 1950 + 1 }, (_, i) => 2025 - i);

function BrowsePageContent() {
  const router = useRouter();
  const [type, setType] = useState<'all' | 'movie' | 'series'>('all');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearMin, setYearMin] = useState<string>('1950');
  const [yearMax, setYearMax] = useState<string>('2025');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetSuggestions = () => {
    setIsLoading(true);
    console.log('Getting suggestions with filters:', {
      type,
      genres: selectedGenres,
      platforms: selectedPlatforms,
      yearMin,
      yearMax
    });
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (type !== 'all') {
      params.append('type', type);
    }
    
    if (selectedGenres.length > 0) {
      // Map Arabic genres to English for API
      const englishGenres = selectedGenres.map(g => GENRE_MAP[g] || g);
      params.append('genres', englishGenres.join(','));
    }
    
    if (selectedPlatforms.length > 0) {
      params.append('platforms', selectedPlatforms.join(','));
    }
    
    params.append('yearMin', yearMin);
    params.append('yearMax', yearMax);
    
    console.log('Redirecting to:', `/suggestions?${params.toString()}`);
    
    // Redirect to suggestions page
    router.push(`/suggestions?${params.toString()}`);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  const clearFilters = () => {
    setType('all');
    setSelectedGenres([]);
    setYearMin('1950');
    setYearMax('2025');
    setSelectedPlatforms([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <div className="pt-24 pb-20 container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              اعثر على الفيلم المثالي
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              اختر تفضيلاتك وسنقترح لك أفضل الأفلام المناسبة لك
            </p>

            {/* Statistics Banner */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 mb-12">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-4xl font-bold text-blue-500 mb-2">
                    {type === 'all' ? 'الكل' : type === 'movie' ? 'أفلام' : 'مسلسلات'}
                  </div>
                  <div className="text-slate-400">نوع المحتوى</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-blue-500 mb-2">
                    {selectedGenres.length > 0 ? selectedGenres.length : 'الكل'}
                  </div>
                  <div className="text-slate-400">التصنيفات</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-blue-500 mb-2">
                    {yearMin}-{yearMax}
                  </div>
                  <div className="text-slate-400">السنوات</div>
                </div>
                <div>
                  <div className="text-4xl font-bold text-blue-500 mb-2">
                    {selectedPlatforms.length > 0 ? selectedPlatforms.length : 'الكل'}
                  </div>
                  <div className="text-slate-400">المنصات</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters Banner - All in One Row */}
          <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-6 mb-8">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {/* Type Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-400 text-center">نوع المحتوى</label>
                <Select value={type} onValueChange={(value) => setType(value as any)}>
                  <SelectTrigger className="w-[180px] bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المحتوى</SelectItem>
                    <SelectItem value="movie">🎬 أفلام</SelectItem>
                    <SelectItem value="series">📺 مسلسلات</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Genre Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-400 text-center">التصنيفات</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-[200px] bg-slate-700 border-slate-600">
                      {selectedGenres.length > 0 
                        ? `${selectedGenres.length} تصنيفات` 
                        : 'اختر التصنيفات'
                      }
                      <ChevronDown className="mr-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 max-h-[300px] overflow-y-auto">
                    {GENRES.map(genre => (
                      <DropdownMenuCheckboxItem
                        key={genre}
                        checked={selectedGenres.includes(genre)}
                        onCheckedChange={() => toggleGenre(genre)}
                      >
                        {genre}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Year Min Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-400 text-center">من سنة</label>
                <Select value={yearMin} onValueChange={setYearMin}>
                  <SelectTrigger className="w-[120px] bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {YEARS.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year Max Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-400 text-center">إلى سنة</label>
                <Select value={yearMax} onValueChange={setYearMax}>
                  <SelectTrigger className="w-[120px] bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {YEARS.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Platform Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-400 text-center">المنصات</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-[200px] bg-slate-700 border-slate-600">
                      {selectedPlatforms.length > 0 
                        ? `${selectedPlatforms.length} منصات` 
                        : 'اختر المنصات'
                      }
                      <ChevronDown className="mr-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {PLATFORMS.map(platform => (
                      <DropdownMenuCheckboxItem
                        key={platform}
                        checked={selectedPlatforms.includes(platform)}
                        onCheckedChange={() => togglePlatform(platform)}
                      >
                        {platform}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              onClick={handleGetSuggestions} 
              disabled={isLoading}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-xl px-12 py-8 rounded-2xl shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all"
            >
              {isLoading ? '🎬 جاري البحث عن أفضل الاختيارات...' : '✨ احصل على أفضل 3 اقتراحات'}
            </Button>
            <Button 
              onClick={clearFilters} 
              size="lg"
              variant="outline" 
              className="border-2 border-slate-600 text-slate-300 hover:bg-slate-800 px-8 py-8 rounded-2xl text-lg"
            >
              🔄 مسح كل الفلاتر
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export with dynamic import to prevent hydration issues
export default dynamic(() => Promise.resolve(BrowsePageContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <div className="pt-24 pb-20 container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 animate-pulse">
            <div className="h-16 bg-slate-700 rounded-xl w-3/4 mx-auto mb-4"></div>
            <div className="h-6 bg-slate-700 rounded w-1/2 mx-auto mb-8"></div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="h-20 bg-slate-700 rounded"></div>
                <div className="h-20 bg-slate-700 rounded"></div>
                <div className="h-20 bg-slate-700 rounded"></div>
              </div>
            </div>
          </div>
          <div className="space-y-8 animate-pulse">
            <div className="h-32 bg-slate-800 rounded-2xl"></div>
            <div className="h-48 bg-slate-800 rounded-2xl"></div>
            <div className="h-32 bg-slate-800 rounded-2xl"></div>
          </div>
        </div>
      </div>
    </div>
  )
});
