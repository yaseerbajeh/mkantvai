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

    return NextResponse.json({
      movies: data,
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
