import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'movie').toLowerCase(); // movie|tv|all (all => movie)
    const language = searchParams.get('lang') || 'ar';

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });

    const scope = type === 'tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/trending/${scope}/week?api_key=${apiKey}&language=${language}`;
    const resp = await fetch(url, { next: { revalidate: 300 } });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `TMDB error: ${text}` }, { status: 502 });
    }
    const data = await resp.json();
    const items = (data.results || []).slice(0, 10).map((item: any) => ({
      tmdb_id: item.id,
      type: scope,
      title: scope === 'tv' ? item.name : item.title,
      year: (scope === 'tv' ? item.first_air_date : item.release_date) ? new Date((scope === 'tv' ? item.first_air_date : item.release_date)).getFullYear() : null,
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


