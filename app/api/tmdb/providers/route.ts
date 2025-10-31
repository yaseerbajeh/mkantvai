import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = (searchParams.get('type') || 'movie').toLowerCase(); // movie|tv
    const region = searchParams.get('region') || 'SA';

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const endpoint = type === 'tv' ? `tv/${id}/watch/providers` : `movie/${id}/watch/providers`;
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}`;
    const resp = await fetch(url, { next: { revalidate: 300 } });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `TMDB error: ${text}` }, { status: 502 });
    }
    const data = await resp.json();
    const r = data.results?.[region] || data.results?.AE || data.results?.EG || data.results?.US || {};
    const providers: string[] = Array.from(new Set([
      ...(r.flatrate?.map((x: any) => x.provider_name) || []),
      ...(r.rent?.map((x: any) => x.provider_name) || []),
      ...(r.buy?.map((x: any) => x.provider_name) || []),
    ]));
    return NextResponse.json({ providers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
  }
}


