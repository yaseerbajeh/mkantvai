import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, tmdbLimiter } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';

// Helper function to fetch TMDB results
async function fetchTmdbResults(
  endpoint: string,
  searchParams: Record<string, string>,
  attempt: string = 'initial'
): Promise<any[]> {
  const search = new URLSearchParams(searchParams).toString();
  const url = `https://api.themoviedb.org/3/${endpoint}?${search}`;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] ${attempt} - Fetching: ${url.replace(process.env.TMDB_API_KEY || '', '***')}`);
  }
  
  try {
    const resp = await fetch(url, { next: { revalidate: 300 } });
    if (!resp.ok) {
      const text = await resp.text();
      if (process.env.NODE_ENV === 'development') {
        console.error(`[API] ${attempt} - Error response:`, resp.status, text.substring(0, 200));
      }
      return [];
    }
    const data = await resp.json();
    const results = data.results || [];
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${attempt} - Found ${results.length} results`);
    }
    return results;
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[API] ${attempt} - Fetch error:`, error.message);
    }
    return [];
  }
}

// Helper function to map TMDB results to our format
function mapResults(results: any[], type: string): any[] {
  return results.map((item: any) => ({
    tmdb_id: item.id,
    type,
    title: type === 'tv' ? item.name : item.title,
    year: (type === 'tv' ? item.first_air_date : item.release_date) 
      ? new Date((type === 'tv' ? item.first_air_date : item.release_date)).getFullYear() 
      : null,
    overview: item.overview,
    rating: item.vote_average,
    poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
  }));
}

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
    const genres = searchParams.get('genres'); // comma-separated TMDB IDs
    const pageRaw = searchParams.get('page') || '1';
    const limitRaw = searchParams.get('limit') || '3';
    const withWatchProviders = searchParams.get('with_watch_providers'); // comma-separated provider IDs
    const watchRegion = searchParams.get('watch_region') || 'SA';
    
    const page = parseInt(pageRaw, 10);
    const limit = parseInt(limitRaw, 10);
    
    // Validate numeric inputs
    if (isNaN(page) || page < 1 || page > 1000) {
      return NextResponse.json({ error: 'Invalid page parameter. Must be between 1 and 1000.' }, { status: 400 });
    }
    
    if (isNaN(limit) || limit < 1 || limit > 20) {
      return NextResponse.json({ error: 'Invalid limit parameter. Must be between 1 and 20.' }, { status: 400 });
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 500 });

    const endpoint = type === 'tv' ? 'discover/tv' : 'discover/movie';
    const sortBy = searchParams.get('sort_by') || 'popularity.desc';

    // Log initial parameters
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] ========== TMDB Discover Request ==========');
      console.log('[API] Type:', type, '| Endpoint:', endpoint);
      console.log('[API] Genres:', genres || 'none');
      console.log('[API] Year range:', yearMin || 'none', '-', yearMax || 'none');
      console.log('[API] Providers:', withWatchProviders || 'none');
      console.log('[API] Region:', watchRegion);
      console.log('[API] Limit:', limit);
    }

    // Base parameters
    const baseParams: Record<string, string> = {
      api_key: apiKey,
      language,
      sort_by: sortBy,
      page: String(page),
      include_adult: 'false',
    };

    // Build initial params with all filters
    const buildParams = (includeGenres: boolean, includeYear: boolean, includeProviders: boolean, providerId?: string, region?: string): Record<string, string> => {
      const params = { ...baseParams };
      
      if (includeGenres && genres) {
        params['with_genres'] = genres;
      }
      
      if (includeYear) {
        if (type === 'tv') {
          if (yearMin) params['first_air_date.gte'] = `${yearMin}-01-01`;
          if (yearMax) params['first_air_date.lte'] = `${yearMax}-12-31`;
        } else {
          if (yearMin) params['primary_release_date.gte'] = `${yearMin}-01-01`;
          if (yearMax) params['primary_release_date.lte'] = `${yearMax}-12-31`;
        }
      }
      
      if (includeProviders && providerId) {
        params['with_watch_providers'] = providerId;
        params['watch_region'] = region || watchRegion;
      }
      
      return params;
    };

    let items: any[] = [];

    // Handle multiple providers with OR logic and multi-region fallback
    if (withWatchProviders) {
      const providerIds = withWatchProviders.split(',').map(id => id.trim()).filter(Boolean);
      if (providerIds.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[API] Processing', providerIds.length, 'provider(s) with multi-region fallback');
        }
        
        const allResults: any[] = [];
        const seenIds = new Set<number>();
        const regionsToTry = [watchRegion, 'US', 'AE', 'EG'].filter((r, i, arr) => arr.indexOf(r) === i);
        
        // Try each provider with each region
        for (const providerId of providerIds) {
          for (const region of regionsToTry) {
            const providerParams = buildParams(true, true, true, providerId, region);
            const results = await fetchTmdbResults(
              endpoint,
              providerParams,
              `Provider ${providerId} in ${region}`
            );
            
            results.forEach((item: any) => {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                allResults.push(item);
              }
            });
            
            // If we got results from this region, we can continue to next provider
            if (results.length > 0) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`[API] Found ${results.length} results for provider ${providerId} in ${region}`);
              }
              break; // Move to next provider
            }
          }
        }
        
        if (allResults.length > 0) {
          // Sort merged results
          if (sortBy.includes('first_air_date') || sortBy.includes('release_date')) {
            allResults.sort((a, b) => {
              const dateA = type === 'tv' ? a.first_air_date : a.release_date;
              const dateB = type === 'tv' ? b.first_air_date : b.release_date;
              if (!dateA) return 1;
              if (!dateB) return -1;
              return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
          }
          
          items = mapResults(allResults, type);
          
          // Apply limit
          if (limit && items.length > limit) {
            if (sortBy.includes('first_air_date') || sortBy.includes('release_date')) {
              items = items.slice(0, limit);
            } else {
              const shuffled = [...items];
              for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
              }
              items = shuffled.slice(0, limit);
            }
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[API] Returning', items.length, 'items from provider filter');
          }
          
          return NextResponse.json({ items });
        } else {
          // No results with provider filter - will try fallback
          if (process.env.NODE_ENV === 'development') {
            console.log('[API] No results with provider filter, trying progressive fallback');
          }
        }
      }
    }

    // Progressive fallback: try with all filters, then relax filters if no results
    // Try 1: With all filters (genre + year, no provider filter if not applicable)
    const params1 = buildParams(true, true, false);
    items = mapResults(await fetchTmdbResults(endpoint, params1, 'Try 1: All filters'), type);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Try 1 (all filters):', items.length, 'results');
    }

    // Try 2: Without year filter
    if (items.length === 0 && (yearMin || yearMax)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Try 2: Removing year filter');
      }
      const params2 = buildParams(true, false, false);
      items = mapResults(await fetchTmdbResults(endpoint, params2, 'Try 2: Without year'), type);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Try 2 (without year):', items.length, 'results');
      }
    }

    // Try 3: Without genre filter (and without year if it was removed)
    if (items.length === 0 && genres) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Try 3: Removing genre filter');
      }
      const params3 = buildParams(false, false, false);
      items = mapResults(await fetchTmdbResults(endpoint, params3, 'Try 3: Without genre'), type);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Try 3 (without genre):', items.length, 'results');
      }
    }

    // Try 4: Popular content only (no filters)
    if (items.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Try 4: Popular content only');
      }
      const params4 = buildParams(false, false, false);
      items = mapResults(await fetchTmdbResults(endpoint, params4, 'Try 4: Popular only'), type);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Try 4 (popular only):', items.length, 'results');
      }
    }

    // Apply limit
    if (limit && items.length > limit) {
      if (sortBy.includes('first_air_date') || sortBy.includes('release_date')) {
        items = items.slice(0, limit);
      } else {
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        items = shuffled.slice(0, limit);
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Final result:', items.length, 'items');
      console.log('[API] ============================================');
    }

    return NextResponse.json({ items });
  } catch (e: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[API] Unexpected error:', e.message);
    }
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
  }
}
