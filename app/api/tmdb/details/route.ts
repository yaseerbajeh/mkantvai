import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, tmdbLimiter } from '@/lib/rateLimiter';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Apply rate limiting for TMDB proxy endpoints
  const rateLimitResult = await rateLimit(request, tmdbLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = (searchParams.get('type') || 'movie').toLowerCase(); // movie|tv
    const language = searchParams.get('lang') || 'ar';

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });
    }

    const endpoint = type === 'tv' ? `tv/${id}` : `movie/${id}`;
    const url = `${TMDB_BASE}/${endpoint}?api_key=${apiKey}&language=${language}`;

    const resp = await fetch(url, { next: { revalidate: 3600 } });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `TMDB error: ${text}` }, { status: 502 });
    }
    const item = await resp.json();

    const details = {
      tmdb_id: item.id,
      type,
      title: type === 'tv' ? item.name : item.title,
      overview: item.overview,
      rating: item.vote_average,
      year: (type === 'tv' ? item.first_air_date : item.release_date) ? new Date((type === 'tv' ? item.first_air_date : item.release_date)).getFullYear() : null,
      genres: (item.genres || []).map((g: any) => g.name),
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
      runtime: item.runtime || (item.episode_run_time && item.episode_run_time[0]) || null,
    };

    return NextResponse.json({ details });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}


