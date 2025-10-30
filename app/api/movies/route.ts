import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function fetchTmdbDetails(tmdbId: number, type: 'movie' | 'series' = 'movie') {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey || !tmdbId) return null;
  const endpoint = type === 'series' ? `tv/${tmdbId}` : `movie/${tmdbId}`;
  const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&language=ar`;
  const resp = await fetch(url, { next: { revalidate: 3600 } });
  if (!resp.ok) return null;
  const item = await resp.json();
  return {
    title: type === 'series' ? item.name : item.title,
    synopsis: item.overview || null,
    rating: item.vote_average != null ? String(item.vote_average) : null,
    duration: item.runtime ? `${item.runtime} دقيقة` : (item.episode_run_time?.[0] ? `${item.episode_run_time[0]} دقيقة` : null),
    url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    genres: Array.isArray(item.genres) ? item.genres.map((g: any) => g.name) : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const genres = searchParams.get('genres');
    const yearMin = searchParams.get('yearMin');
    const yearMax = searchParams.get('yearMax');
    const platforms = searchParams.get('platforms');
    const newMonth = searchParams.get('new'); // Filter by month (oct, nov, etc.)
    const sortBy = searchParams.get('sortBy') || 'popularity';
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('content')
      .select('*', { count: 'exact' });

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    if (genres) {
      const genreArray = genres.split(',');
      // For text field, use OR condition with ilike for partial matching
      const genreFilter = genreArray.map(g => `genre.ilike.%${g}%`).join(',');
      query = query.or(genreFilter);
    }

    if (platforms) {
      const platformArray = platforms.split(',');
      // For text field, use OR condition with ilike for partial matching
      const platformFilter = platformArray.map(p => `platform.ilike.%${p}%`).join(',');
      query = query.or(platformFilter);
    }

    if (yearMin) {
      query = query.gte('year', parseInt(yearMin));
    }

    if (yearMax) {
      query = query.lte('year', parseInt(yearMax));
    }

    if (newMonth) {
      // Filter by month - case insensitive
      query = query.ilike('new', newMonth);
    }

    // Don't apply sorting in the query if sortBy is 'rating' since it's a string
    if (sortBy === 'year') {
      query = query.order('year', { ascending: false });
    } else if (sortBy !== 'rating') {
      // Default sort by title since created_at doesn't exist
      query = query.order('title', { ascending: true });
    }

    query = query.range(offset, offset + limit - 1);

    let { data, error, count } = await query;

    // If sorting by rating, do it manually in JavaScript since rating is a string
    if (sortBy === 'rating' && data) {
      data = data.sort((a, b) => {
        const ratingA = parseFloat(a.rating || '0');
        const ratingB = parseFloat(b.rating || '0');
        return ratingB - ratingA; // Descending order (highest first)
      });
    }

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Enrich with TMDB if tmdb_id exists
    const enriched = await Promise.all((data || []).map(async (m: any) => {
      if (m.tmdb_id) {
        const tmdb = await fetchTmdbDetails(Number(m.tmdb_id), (m.type as any) === 'series' ? 'series' : 'movie');
        if (tmdb) {
          return {
            ...m,
            title: tmdb.title || m.title,
            synopsis: tmdb.synopsis ?? m.synopsis,
            rating: tmdb.rating ?? m.rating,
            duration: tmdb.duration ?? m.duration,
            url: tmdb.url ?? m.url,
            genre: tmdb.genres && tmdb.genres.length ? tmdb.genres.join(', ') : m.genre,
          };
        }
      }
      return m;
    }));

    return NextResponse.json({
      movies: enriched,
      total: count,
      limit,
      offset,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
