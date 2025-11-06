import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get authenticated user
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  return user;
}

// GET - Get reviews for a product or all latest reviews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('product_code');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let query = supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    // If product_code is provided, filter by it
    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    // If limit is provided, apply it
    if (limit) {
      query = query.limit(limit);
    }

    const { data: reviews, error: reviewsError } = await query;

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      return NextResponse.json(
        { error: reviewsError.message || 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    // Calculate average rating (only if filtering by product)
    let averageRating = 0;
    if (productCode && reviews && reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      averageRating = totalRating / reviews.length;
    }

    // Anonymize user emails (show only first part)
    const anonymizedReviews = (reviews || []).map((review) => {
      const emailParts = review.user_email.split('@');
      const anonymizedEmail = emailParts[0].substring(0, 2) + '***@' + emailParts[1];
      return {
        ...review,
        user_email: anonymizedEmail,
      };
    });

    return NextResponse.json({
      reviews: anonymizedReviews,
      averageRating: productCode ? Math.round(averageRating * 10) / 10 : null,
      totalReviews: anonymizedReviews.length,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// POST - Submit a new review
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { order_id, rating, comment } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'order_id is required' },
        { status: 400 }
      );
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: request.headers.get('authorization') || '',
        },
      },
    });

    // First, verify the order belongs to the user and has approved/paid status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, email, status, product_code')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.email !== user.email) {
      return NextResponse.json(
        { error: 'You can only review your own orders' },
        { status: 403 }
      );
    }

    if (order.status !== 'approved' && order.status !== 'paid') {
      return NextResponse.json(
        { error: 'You can only review approved or paid orders' },
        { status: 400 }
      );
    }

    // Check if review already exists for this order
    const { data: existingReview, error: existingError } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_id', order_id)
      .single();

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this order' },
        { status: 400 }
      );
    }

    // Insert the review using service role key to bypass RLS
    // (We've already validated ownership in the API)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: review, error: insertError } = await supabaseAdmin
      .from('reviews')
      .insert({
        order_id,
        product_code: order.product_code || '',
        user_email: user.email,
        rating,
        comment: comment || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting review:', insertError);
      return NextResponse.json(
        { error: insertError.message || 'Failed to submit review' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review,
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

