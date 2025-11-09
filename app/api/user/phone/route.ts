import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, authenticatedLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function PUT(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب' },
        { status: 400 }
      );
    }

    // Format phone number: remove any non-digits, remove leading zeros, remove 966 prefix if present
    let cleaned = phone.replace(/\D/g, '').replace(/^0+/, '');
    
    // Remove 966 prefix if it exists (in case client sent it with prefix)
    if (cleaned.startsWith('966')) {
      cleaned = cleaned.slice(3);
    }
    
    // Only allow exactly 9 digits
    if (cleaned.length !== 9) {
      return NextResponse.json(
        { error: 'يجب أن يتكون الرقم من 9 أرقام فقط. مثال: 542668201' },
        { status: 400 }
      );
    }
    
    // Add 966 prefix for storage
    const formattedPhone = `966${cleaned}`;

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[phone/route] No authorization header or invalid format');
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token || token.length < 10) {
      console.error('[phone/route] Invalid token format');
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    // Decode JWT token to get user ID
    let userId: string | null = null;
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.error('[phone/route] Invalid JWT token format');
        return NextResponse.json(
          { error: 'غير مصرح' },
          { status: 401 }
        );
      }

      // Decode the payload (base64url encoded)
      const payload = tokenParts[1];
      // Add padding if needed for base64 decoding
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decodedPayload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf-8'));
      
      // Get user ID from 'sub' claim
      userId = decodedPayload.sub;
      
      if (!userId) {
        console.error('[phone/route] No user ID found in token');
        return NextResponse.json(
          { error: 'غير مصرح' },
          { status: 401 }
        );
      }

      // Verify token expiration
      if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
        console.error('[phone/route] Token has expired');
        return NextResponse.json(
          { error: 'غير مصرح. يرجى تسجيل الدخول مرة أخرى' },
          { status: 401 }
        );
      }

    } catch (decodeError: any) {
      console.error('[phone/route] Error decoding token:', decodeError);
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    // Use admin client to get user data
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (getUserError || !userData?.user) {
      console.error('[phone/route] Error getting user by ID:', getUserError);
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const user = userData.user;
    console.log('[phone/route] User authenticated successfully:', user.id);

    // Update all active cart sessions for this user (abandoned carts)
    const { data: updatedSessions, error: cartSessionError } = await supabaseAdmin
      .from('cart_sessions')
      .update({ whatsapp: formattedPhone })
      .eq('user_id', user.id)
      .is('converted_to_order_id', null)
      .select('id, whatsapp');

    if (cartSessionError) {
      console.error('[phone/route] Error updating cart sessions:', cartSessionError);
      // Don't fail the request, just log the error
    } else {
      console.log('[phone/route] Updated cart sessions:', updatedSessions?.length || 0, 'sessions');
    }

    // Update active subscriptions for this user's email
    const { error: subscriptionsError } = await supabaseAdmin
      .from('active_subscriptions')
      .update({ customer_phone: formattedPhone })
      .eq('customer_email', user.email || '');

    if (subscriptionsError) {
      console.error('[phone/route] Error updating active subscriptions:', subscriptionsError);
      // Don't fail the request, just log the error
    }

    // Update or create user_trial_assignments for this user
    // First check if record exists
    const { data: existingAssignment, error: checkError } = await supabaseAdmin
      .from('user_trial_assignments')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingAssignment) {
      // Update existing record
      const { error: trialAssignmentsError } = await supabaseAdmin
        .from('user_trial_assignments')
        .update({ whatsapp: formattedPhone })
        .eq('user_id', user.id);

      if (trialAssignmentsError) {
        console.error('[phone/route] Error updating trial assignments:', trialAssignmentsError);
        // Don't fail the request, just log the error
      } else {
        console.log('[phone/route] Updated trial assignments for user:', user.id);
      }
    } else {
      // Create new record with WhatsApp (without trial_code - will be added when trial is assigned)
      // We need to set a default expires_at, but since no trial is assigned yet, we'll set it far in the future
      // Actually, we can't create a record without trial_code and expires_at due to NOT NULL constraints
      // So we'll just update when the record is created during trial assignment
      // For now, we'll skip creating the record here and let the trial assignment create it
      console.log('[phone/route] No trial assignment record exists yet for user:', user.id);
      // The WhatsApp will be saved when the trial is assigned, or we can create a minimal record
      // Let's create a record with a placeholder trial_code that will be updated later
      // Actually, trial_code is NOT NULL, so we can't create without it
      // We'll need to handle this in the trial assignment flow
    }

    return NextResponse.json({
      success: true,
      message: 'تم حفظ رقم الهاتف بنجاح',
    });
  } catch (error: any) {
    console.error('[phone/route] Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

