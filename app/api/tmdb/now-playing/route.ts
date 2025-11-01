import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, tmdbLimiter } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Apply rate limiting for TMDB proxy endpoints
  const rateLimitResult = await rateLimit(request, tmdbLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'movie').toLowerCase(); // movie|tv
    const pageRaw = searchParams.get('page') || '1';
    const language = searchParams.get('lang') || 'ar';
    
    const page = parseInt(pageRaw, 10);
    
    // Validate numeric input
    if (isNaN(page) || page < 1 || page > 1000) {
      return NextResponse.json({ error: 'Invalid page parameter. Must be between 1 and 1000.' }, { status: 400 });
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });

    let url: string;
    if (type === 'tv') {
      // Use discover to get genuinely new/recent series by first air date
      const today = new Date();
      const past = new Date();
      past.setFullYear(today.getFullYear() - 1); // last 12 months
      const gte = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-01`;
      const lte = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const params = new URLSearchParams({
        api_key: apiKey,
        language,
        sort_by: 'first_air_date.desc',
        'first_air_date.gte': gte,
        'first_air_date.lte': lte,
        page: String(page),
        include_adult: 'false',
      }).toString();
      url = `https://api.themoviedb.org/3/discover/tv?${params}`;
    } else {
      const endpoint = 'movie/now_playing';
      url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&language=${language}&page=${page}`;
    }

    const resp = await fetch(url, { next: { revalidate: 300 } });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `TMDB error: ${text}` }, { status: 502 });
    }
    const data = await resp.json();
    const items = (data.results || []).map((item: any) => ({
      tmdb_id: item.id,
      type,
      title: type === 'tv' ? item.name : item.title,
      year: (type === 'tv' ? item.first_air_date : item.release_date) ? new Date((type === 'tv' ? item.first_air_date : item.release_date)).getFullYear() : null,
      overview: item.overview,
      rating: item.vote_average,
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
    }));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
  }
}


