import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// GET - Fetch user's watchlist
export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    console.log('[API] GET /api/watchlist - Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[API] No valid authorization header found');
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with auth context for RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    
    // Get authenticated user using the token directly
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    console.log('[API] User authenticated:', !!user, 'User ID:', user?.id, 'Error:', authError?.message);
    
    if (authError || !user) {
      console.log('[API] Authentication failed');
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    // Fetch watchlist with movie details
    const { data, error } = await supabase
      .from('watchlist')
      .select(`
        id,
        content_id,
        added_at,
        content:content_id (
          id,
          title,
          synopsis,
          year,
          type,
          genre,
          platform,
          rating,
          duration,
          url,
          new,
          note
        )
      `)
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Error fetching watchlist:', error);
      return NextResponse.json(
        { error: 'فشل في جلب قائمة المشاهدة' },
        { status: 500 }
      );
    }

    // Transform data to flatten content object
    const watchlist = data.map((item: any) => ({
      watchlist_id: item.id,
      added_at: item.added_at,
      ...item.content
    }));

    return NextResponse.json({ watchlist }, { status: 200 });
  } catch (error: any) {
    console.error('Watchlist GET error:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Add to watchlist
export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    console.log('[API] POST /api/watchlist - Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[API] No valid authorization header found');
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with auth context for RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    
    // Get authenticated user using the token directly
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    console.log('[API] User authenticated:', !!user, 'User ID:', user?.id, 'Error:', authError?.message);
    
    if (authError || !user) {
      console.log('[API] Authentication failed');
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    const { content_id } = await request.json();
    console.log('[API] Adding to watchlist - User ID:', user.id, 'Content ID:', content_id);

    if (!content_id) {
      console.log('[API] No content_id provided');
      return NextResponse.json(
        { error: 'معرف المحتوى مطلوب' },
        { status: 400 }
      );
    }

    // Insert into watchlist
    const { data, error } = await supabase
      .from('watchlist')
      .insert({
        user_id: user.id,
        content_id: content_id
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Database error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Check if already exists
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'هذا العنصر موجود بالفعل في قائمة المشاهدة' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: `فشل في إضافة العنصر: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('[API] Successfully added to watchlist:', data);

    return NextResponse.json(
      { message: 'تمت الإضافة إلى قائمة المشاهدة بنجاح', data },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Watchlist POST error:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Remove from watchlist
export async function DELETE(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    console.log('[API] DELETE /api/watchlist - Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[API] No valid authorization header found');
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with auth context for RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    
    // Get authenticated user using the token directly
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    console.log('[API] User authenticated:', !!user, 'User ID:', user?.id, 'Error:', authError?.message);
    
    if (authError || !user) {
      console.log('[API] Authentication failed');
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const content_id = searchParams.get('content_id');

    if (!content_id) {
      return NextResponse.json(
        { error: 'معرف المحتوى مطلوب' },
        { status: 400 }
      );
    }

    // Delete from watchlist
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', user.id)
      .eq('content_id', content_id);

    if (error) {
      console.error('Error removing from watchlist:', error);
      return NextResponse.json(
        { error: 'فشل في إزالة العنصر من قائمة المشاهدة' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'تمت الإزالة من قائمة المشاهدة بنجاح' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Watchlist DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

