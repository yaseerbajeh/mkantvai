'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';

type SearchItem = {
  tmdb_id: number;
  type: 'movie' | 'tv' | string;
  title: string;
  year: number | null;
  overview: string;
  rating: number;
  poster_url: string | null;
  backdrop_url: string | null;
};

export default function AdminTmdbPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'movie' | 'tv'>('movie');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [platform, setPlatform] = useState('');
  const [newMonth, setNewMonth] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push('/auth');
      } else {
        setUser(session.user);
      }
    });
  }, [router]);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}&type=${type}&lang=ar`);
      const data = await resp.json();
      if (resp.ok) {
        setResults(data.results || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveToContent = async (item: SearchItem) => {
    setSavingId(item.tmdb_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
      const payload = {
        tmdb_id: item.tmdb_id,
        type: type === 'tv' ? 'series' : 'movie',
        platform: platform || null,
        new: newMonth || null,
        note: note || null,
        title: item.title,
        year: item.year,
      };
      const resp = await fetch('/api/admin/content', { method: 'POST', headers, body: JSON.stringify(payload) });
      if (resp.ok) {
        setPlatform(''); setNewMonth(''); setNote('');
      }
    } finally {
      setSavingId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white" dir="rtl">
      <Header />
      <div className="pt-24 pb-20 container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">إدارة TMDB</h1>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن فيلم أو مسلسل" className="bg-slate-900 border-slate-700" />
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="movie">🎬 أفلام</SelectItem>
                  <SelectItem value="tv">📺 مسلسلات</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={search} disabled={loading} className="bg-blue-600 hover:bg-blue-700">{loading ? 'جاري البحث...' : 'بحث'}</Button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {results.map((item) => (
                  <div key={item.tmdb_id} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                    <div className="aspect-[2/3] bg-slate-800">
                      {item.poster_url ? (
                        <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">لا توجد صورة</div>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="font-bold">{item.title}</div>
                      <div className="text-sm text-slate-400">{item.year || ''}</div>

                      <div className="pt-2 space-y-2">
                        <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="المنصة (مثال: Netflix-IPTV, Shahid)" className="bg-slate-950 border-slate-700" />
                        <Input value={newMonth} onChange={(e) => setNewMonth(e.target.value)} placeholder="new (مثال: oct)" className="bg-slate-950 border-slate-700" />
                        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة" className="bg-slate-950 border-slate-700" />
                        <Button onClick={() => saveToContent(item)} disabled={savingId === item.tmdb_id} className="w-full bg-green-600 hover:bg-green-700">
                          {savingId === item.tmdb_id ? 'جاري الحفظ...' : 'حفظ في المحتوى'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}


