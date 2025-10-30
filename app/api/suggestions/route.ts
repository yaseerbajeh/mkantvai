import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const genres = searchParams.get('genres');
    const yearMin = searchParams.get('yearMin');
    const yearMax = searchParams.get('yearMax');
    const platforms = searchParams.get('platforms');
    const limit = 3; // Always return max 3 suggestions

    console.log('[API] Suggestions request:', { type, genres, yearMin, yearMax, platforms });

    let query = supabase
      .from('content')
      .select('*');

    if (type && type !== 'all') {
      query = query.eq('type', type);
      console.log('[API] Filtering by type:', type);
    }

    if (genres) {
      const genreArray = genres.split(',').filter(g => g.trim());
      if (genreArray.length > 0) {
        // For text field, use OR condition with ilike for partial matching
        const genreFilter = genreArray.map(g => `genre.ilike.%${g}%`).join(',');
        query = query.or(genreFilter);
        console.log('[API] Filtering by genres:', genreArray);
      }
    }

    if (platforms) {
      const platformArray = platforms.split(',').filter(p => p.trim());
      if (platformArray.length > 0) {
        // For text field, use OR condition with ilike for partial matching
        const platformFilter = platformArray.map(p => `platform.ilike.%${p}%`).join(',');
        query = query.or(platformFilter);
        console.log('[API] Filtering by platforms:', platformArray);
      }
    }

    if (yearMin) {
      query = query.gte('year', parseInt(yearMin));
      console.log('[API] Filtering yearMin:', yearMin);
    }

    if (yearMax) {
      query = query.lte('year', parseInt(yearMax));
      console.log('[API] Filtering yearMax:', yearMax);
    }

    // Fetch more results to randomize from (fetch 50, then pick random 3)
    query = query.limit(50);

    const { data, error } = await query;

    console.log('[API] Query result:', { 
      dataCount: data?.length || 0, 
      error: error?.message,
      firstMovie: data?.[0]?.title 
    });

    if (error) {
      console.error('[API] Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Randomize and pick 3 suggestions
    let suggestions = data || [];
    
    if (suggestions.length > limit) {
      // Fisher-Yates shuffle algorithm to randomize
      const shuffled = [...suggestions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      suggestions = shuffled.slice(0, limit);
    }

    console.log('[API] Returning randomized suggestions:', suggestions.map(s => s.title));

    return NextResponse.json({
      suggestions: suggestions,
      count: suggestions.length,
    });
  } catch (error: any) {
    console.error('[API] Exception:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
