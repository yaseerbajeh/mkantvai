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

    // Note: rating is text in database, so we'll just order by it
    query = query
      .order('rating', { ascending: false })
      .limit(limit);

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

    return NextResponse.json({
      suggestions: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('[API] Exception:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
