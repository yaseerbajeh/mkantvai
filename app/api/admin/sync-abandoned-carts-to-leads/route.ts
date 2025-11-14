import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to get admin user from auth token
async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  // Use service role key like cart-sessions route does
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify user is admin
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return null;
  }

  // Check if user is admin (using environment variable)
  const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim()).filter(Boolean);
  
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

// POST - Manual sync endpoint to convert existing abandoned carts to leads
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all abandoned cart sessions
    const { data: cartSessions, error: cartError } = await supabaseAdmin
      .from('cart_sessions')
      .select('*')
      .is('converted_to_order_id', null)
      .order('created_at', { ascending: false });

    if (cartError) {
      throw cartError;
    }

    // Get existing leads from abandoned carts
    const { data: existingLeads, error: leadsError } = await supabaseAdmin
      .from('crm_leads')
      .select('source_reference_id')
      .eq('source', 'abandoned_cart')
      .not('source_reference_id', 'is', null);

    const existingIds = new Set((existingLeads || []).map(l => l.source_reference_id));

    let synced = 0;
    let errors = 0;

    for (const cart of cartSessions || []) {
      // Skip if already synced
      if (existingIds.has(cart.id)) {
        continue;
      }

      // Create lead
      const { error: insertError } = await supabaseAdmin
        .from('crm_leads')
        .insert({
          source: 'abandoned_cart',
          name: cart.name || cart.email,
          email: cart.email,
          whatsapp: cart.whatsapp,
          products: cart.cart_items || [],
          total_amount: cart.total_amount || 0,
          source_reference_id: cart.id,
          status: 'new',
          comments: [],
        });

      if (!insertError) {
        synced++;
      } else {
        console.error('Error syncing cart session:', cart.id, insertError);
        errors++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      synced,
      errors,
      total: cartSessions?.length || 0 
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

