import { NextRequest, NextResponse } from 'next/server';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const type = (searchParams.get('type') || 'movie').toLowerCase(); // movie|tv
    const language = searchParams.get('lang') || 'ar';

    if (!q) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });
    }

    const endpoint = type === 'tv' ? 'search/tv' : 'search/movie';
    const url = `${TMDB_BASE}/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(q)}&language=${language}`;

    const resp = await fetch(url, { next: { revalidate: 60 } });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `TMDB error: ${text}` }, { status: 502 });
    }
    const data = await resp.json();

    const results = (data.results || []).map((item: any) => ({
      tmdb_id: item.id,
      type,
      title: type === 'tv' ? item.name : item.title,
      year: (type === 'tv' ? item.first_air_date : item.release_date) ? new Date((type === 'tv' ? item.first_air_date : item.release_date)).getFullYear() : null,
      overview: item.overview,
      rating: item.vote_average,
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
    }));

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}


