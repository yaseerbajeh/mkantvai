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
    const language = searchParams.get('lang') || 'ar';
    const yearMin = searchParams.get('yearMin');
    const yearMax = searchParams.get('yearMax');
    const genres = searchParams.get('genres'); // comma-separated names or IDs; we expect TMDB IDs ideally
    const pageRaw = searchParams.get('page') || '1';
    const limitRaw = searchParams.get('limit') || '3';
    
    const page = parseInt(pageRaw, 10);
    const limit = parseInt(limitRaw, 10);
    
    // Validate numeric inputs
    if (isNaN(page) || page < 1 || page > 1000) {
      return NextResponse.json({ error: 'Invalid page parameter. Must be between 1 and 1000.' }, { status: 400 });
    }
    
    if (isNaN(limit) || limit < 1 || limit > 20) {
      return NextResponse.json({ error: 'Invalid limit parameter. Must be between 1 and 20.' }, { status: 400 });
    }
    const withWatchProviders = searchParams.get('with_watch_providers'); // comma-separated provider IDs
    const watchRegion = searchParams.get('watch_region') || 'SA';

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });

    const endpoint = type === 'tv' ? 'discover/tv' : 'discover/movie';
    const sortBy = searchParams.get('sort_by') || 'popularity.desc';
    const params: Record<string, string> = {
      api_key: apiKey,
      language,
      sort_by: sortBy,
      page: String(page),
      include_adult: 'false',
    };

    if (genres) {
      // Expect TMDB numeric IDs (e.g., 28,35). If names were passed, a mapping step would be required.
      params['with_genres'] = genres;
    }

    if (yearMin || yearMax) {
      if (type === 'tv') {
        if (yearMin) params['first_air_date.gte'] = `${yearMin}-01-01`;
        if (yearMax) params['first_air_date.lte'] = `${yearMax}-12-31`;
      } else {
        if (yearMin) params['primary_release_date.gte'] = `${yearMin}-01-01`;
        if (yearMax) params['primary_release_date.lte'] = `${yearMax}-12-31`;
      }
    }

    // Handle multiple providers with OR logic (fetch each separately and merge)
    if (withWatchProviders) {
      const providerIds = withWatchProviders.split(',').map(id => id.trim()).filter(Boolean);
      if (providerIds.length > 0) {
        // Fetch for each provider and merge results
        const allResults: any[] = [];
        const seenIds = new Set<number>();
        
        for (const providerId of providerIds) {
          const providerParams = { ...params };
          providerParams['with_watch_providers'] = providerId;
          providerParams['watch_region'] = watchRegion;
          
          const search = new URLSearchParams(providerParams).toString();
          const url = `https://api.themoviedb.org/3/${endpoint}?${search}`;
          const resp = await fetch(url, { next: { revalidate: 300 } });
          
          if (resp.ok) {
            const data = await resp.json();
            (data.results || []).forEach((item: any) => {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                allResults.push(item);
              }
            });
          }
        }
        
        // Sort merged results by date if sort_by contains date
        if (sortBy.includes('first_air_date') || sortBy.includes('release_date')) {
          allResults.sort((a, b) => {
            const dateA = type === 'tv' ? a.first_air_date : a.release_date;
            const dateB = type === 'tv' ? b.first_air_date : b.release_date;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
        }
        
        // Map merged results
        let items = allResults.map((item: any) => ({
          tmdb_id: item.id,
          type,
          title: type === 'tv' ? item.name : item.title,
          year: (type === 'tv' ? item.first_air_date : item.release_date) ? new Date((type === 'tv' ? item.first_air_date : item.release_date)).getFullYear() : null,
          overview: item.overview,
          rating: item.vote_average,
          poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
        }));
        
        // Apply limit - only randomize if not sorting by date
        if (limit && items.length > limit) {
          if (sortBy.includes('first_air_date') || sortBy.includes('release_date')) {
            // Already sorted by date, just take first N
            items = items.slice(0, limit);
          } else {
            // Randomize for other sorts
            const shuffled = [...items];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            items = shuffled.slice(0, limit);
          }
        }
        
        return NextResponse.json({ items });
      }
    }

    // Default path without provider filter
    const search = new URLSearchParams(params).toString();
    const url = `https://api.themoviedb.org/3/${endpoint}?${search}`;
    const resp = await fetch(url, { next: { revalidate: 300 } });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: `TMDB error: ${text}` }, { status: 502 });
    }
    const data = await resp.json();
    let items = (data.results || []).map((item: any) => ({
      tmdb_id: item.id,
      type,
      title: type === 'tv' ? item.name : item.title,
      year: (type === 'tv' ? item.first_air_date : item.release_date) ? new Date((type === 'tv' ? item.first_air_date : item.release_date)).getFullYear() : null,
      overview: item.overview,
      rating: item.vote_average,
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
    }));

    if (limit && items.length > limit) {
      // random sample
      const shuffled = [...items];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      items = shuffled.slice(0, limit);
    }

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
  }
}


