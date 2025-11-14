import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, authenticatedLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST - Create or update cart session
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const body = await request.json();
    const { items, totalAmount, discountAmount, promoCodeId } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'السلة فارغة' },
        { status: 400 }
      );
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    // Calculate total
    const total = totalAmount || items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    // First, check if cart session exists for this user
    const { data: existingSession } = await supabase
      .from('cart_sessions')
      .select('id')
      .eq('user_id', user.id)
      .is('converted_to_order_id', null)
      .single();

    // Upsert cart session (create or update)
    const cartSessionData = {
      user_id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || null,
      cart_items: items,
      total_amount: total,
      discount_amount: discountAmount || 0,
      promo_code_id: promoCodeId || null,
      updated_at: new Date().toISOString(),
    };

    let cartSession;
    let error;

    if (existingSession) {
      // Update existing session
      const result = await supabase
        .from('cart_sessions')
        .update(cartSessionData)
        .eq('id', existingSession.id)
        .select()
        .single();
      cartSession = result.data;
      error = result.error;
    } else {
      // Create new session
      const result = await supabase
        .from('cart_sessions')
        .insert(cartSessionData)
        .select()
        .single();
      cartSession = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error saving cart session:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء حفظ السلة' },
        { status: 500 }
      );
    }

    // Automatically create lead from abandoned cart (if not already exists)
    if (cartSession && supabaseServiceKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        // Check if lead already exists for this cart session
        const { data: existingLead } = await supabaseAdmin
          .from('crm_leads')
          .select('id')
          .eq('source', 'abandoned_cart')
          .eq('source_reference_id', cartSession.id)
          .maybeSingle();

        // Only create if doesn't exist
        if (!existingLead) {
          await supabaseAdmin
            .from('crm_leads')
            .insert({
              source: 'abandoned_cart',
              name: cartSession.name || cartSession.email,
              email: cartSession.email,
              whatsapp: cartSession.whatsapp,
              products: cartSession.cart_items || [],
              total_amount: cartSession.total_amount || 0,
              source_reference_id: cartSession.id,
              status: 'new',
              comments: [],
            });
        }
      } catch (leadError) {
        // Don't fail the cart session creation if lead creation fails
        console.error('Error creating lead from cart session:', leadError);
      }
    }

    return NextResponse.json({
      success: true,
      cartSession,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Delete cart session (when cart is converted to order or cleared)
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from('cart_sessions')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting cart session:', error);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء حذف السلة' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

