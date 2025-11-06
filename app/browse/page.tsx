'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';

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
const PLATFORMS = ['Netflix', 'IPTV', 'Amazon Prime', 'Disney+', 'HBO Max', 'Hulu', 'Apple TV+'];

// Generate years from 2025 down to 1950
const YEARS = Array.from({ length: 2025 - 1950 + 1 }, (_, i) => 2025 - i);

type ChatStep = 0 | 1 | 2 | 3 | 4 | 5;

function BrowsePageContent() {
  const router = useRouter();
  const [chatStep, setChatStep] = useState<ChatStep>(0);
  const [type, setType] = useState<'all' | 'movie' | 'series'>('all');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearMin, setYearMin] = useState<string>('1950');
  const [yearMax, setYearMax] = useState<string>('2025');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const startChat = () => {
    setChatStep(1);
  };

  const handleTypeSelect = (selectedType: 'all' | 'movie' | 'series') => {
    setType(selectedType);
    setTimeout(() => setChatStep(2), 300);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => {
      const newGenres = prev.includes(genre) 
        ? prev.filter(g => g !== genre) 
        : [...prev, genre];
      if (newGenres.length > 0 && chatStep === 2) {
        setTimeout(() => setChatStep(3), 500);
      }
      return newGenres;
    });
  };

  const handleYearNext = () => {
    setTimeout(() => setChatStep(4), 300);
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => {
      const newPlatforms = prev.includes(platform) 
        ? prev.filter(p => p !== platform) 
        : [...prev, platform];
      if (newPlatforms.length > 0 && chatStep === 4) {
        setTimeout(() => setChatStep(5), 500);
      }
      return newPlatforms;
    });
  };

  const handleGetSuggestions = () => {
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

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Background Image with Netflix-style overlay */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: 'url(https://cdn.mos.cms.futurecdn.net/rDJegQJaCyGaYysj2g5XWY-1200-80.jpg)',
        }}
      />
      {/* Dark gradient overlay for transparency (Netflix style) - reduced opacity */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/90 z-0" />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen">
        <Header />

        <div className="pt-24 pb-20 container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Chat Interface */}
            <div className="space-y-6">
              {/* Welcome Message */}
              {chatStep === 0 && (
                <div className="flex items-start gap-4 animate-fade-in">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 bg-slate-800/80 backdrop-blur-sm rounded-2xl rounded-tl-none p-6 shadow-xl border border-slate-700/50">
                    <h2 className="text-2xl font-bold mb-4 text-white">مرحباً! 👋</h2>
                    <p className="text-slate-300 mb-6">أنا مساعدك الذكي للعثور على أفضل الأفلام والمسلسلات المناسبة لك.</p>
                    <Button
                      onClick={startChat}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 rounded-xl text-lg font-semibold shadow-lg transform hover:scale-105 transition-all"
                    >
                      تحدث مع الذكاء الاصطناعي
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 1: Content Type Selection */}
              {chatStep >= 1 && (
                <div className="flex items-start gap-4 animate-fade-in">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 bg-slate-800/80 backdrop-blur-sm rounded-2xl rounded-tl-none p-6 shadow-xl border border-slate-700/50">
                    <p className="text-slate-200 mb-4 text-lg">ما نوع المحتوى الذي تفضله؟</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleTypeSelect('all')}
                        className={`px-6 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                          type === 'all'
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                        }`}
                      >
                        الكل
                      </button>
                      <button
                        onClick={() => handleTypeSelect('movie')}
                        className={`px-6 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                          type === 'movie'
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                        }`}
                      >
                        🎬 أفلام
                      </button>
                      <button
                        onClick={() => handleTypeSelect('series')}
                        className={`px-6 py-3 rounded-xl font-medium transition-all transform hover:scale-105 ${
                          type === 'series'
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                        }`}
                      >
                        📺 مسلسلات
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Genre Selection */}
              {chatStep >= 2 && (
                <div className="flex items-start gap-4 animate-fade-in">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 bg-slate-800/80 backdrop-blur-sm rounded-2xl rounded-tl-none p-6 shadow-xl border border-slate-700/50">
                    <p className="text-slate-200 mb-4 text-lg">ما هي التصنيفات المفضلة لديك؟</p>
                    <div className="flex flex-wrap gap-3">
                      {GENRES.map(genre => (
                        <button
                          key={genre}
                          onClick={() => toggleGenre(genre)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 ${
                            selectedGenres.includes(genre)
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                    {selectedGenres.length > 0 && (
                      <p className="text-sm text-slate-400 mt-4">تم اختيار {selectedGenres.length} تصنيف</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Year Selection */}
              {chatStep >= 3 && (
                <div className="flex items-start gap-4 animate-fade-in">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 bg-slate-800/80 backdrop-blur-sm rounded-2xl rounded-tl-none p-6 shadow-xl border border-slate-700/50">
                    <p className="text-slate-200 mb-4 text-lg">ما هي الفترة الزمنية المفضلة؟</p>
                    <div className="flex flex-wrap gap-4 mb-4">
                      <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm text-slate-400 mb-2">من سنة</label>
                        <select
                          value={yearMin}
                          onChange={(e) => setYearMin(e.target.value)}
                          className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {YEARS.map(year => (
                            <option key={year} value={year.toString()}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm text-slate-400 mb-2">إلى سنة</label>
                        <select
                          value={yearMax}
                          onChange={(e) => setYearMax(e.target.value)}
                          className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {YEARS.map(year => (
                            <option key={year} value={year.toString()}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button
                      onClick={handleYearNext}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transform hover:scale-105 transition-all"
                    >
                      متابعة
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Platform Selection */}
              {chatStep >= 4 && (
                <div className="flex items-start gap-4 animate-fade-in">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 bg-slate-800/80 backdrop-blur-sm rounded-2xl rounded-tl-none p-6 shadow-xl border border-slate-700/50">
                    <p className="text-slate-200 mb-4 text-lg">ما هي المنصات المتاحة لديك؟</p>
                    <div className="flex flex-wrap gap-3">
                      {PLATFORMS.map(platform => (
                        <button
                          key={platform}
                          onClick={() => togglePlatform(platform)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 ${
                            selectedPlatforms.includes(platform)
                              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg'
                              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600'
                          }`}
                        >
                          {platform}
                        </button>
                      ))}
                    </div>
                    {selectedPlatforms.length > 0 && (
                      <p className="text-sm text-slate-400 mt-4">تم اختيار {selectedPlatforms.length} منصة</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Final Action Button */}
              {chatStep >= 5 && (
                <div className="flex items-start gap-4 animate-fade-in">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 bg-slate-800/80 backdrop-blur-sm rounded-2xl rounded-tl-none p-6 shadow-xl border border-slate-700/50">
                    <p className="text-slate-200 mb-6 text-lg">ممتاز! الآن أنا جاهز للبحث عن أفضل الاختيارات لك.</p>
                    <Button
                      onClick={handleGetSuggestions}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 rounded-xl text-lg font-semibold shadow-lg transform hover:scale-105 transition-all"
                    >
                      ابحث لي على فلم مناسب
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

// Export with dynamic import to prevent hydration issues
export default dynamic(() => Promise.resolve(BrowsePageContent), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: 'url(https://cdn.mos.cms.futurecdn.net/rDJegQJaCyGaYysj2g5XWY-1200-80.jpg)',
        }}
      />
      {/* Dark gradient overlay - reduced opacity */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/90 z-0" />
      
      <div className="relative z-10 min-h-screen">
        <Header />
        <div className="pt-24 pb-20 container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6 animate-pulse">
              <div className="h-32 bg-slate-800/50 rounded-2xl"></div>
              <div className="h-32 bg-slate-800/50 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
});
