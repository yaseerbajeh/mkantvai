import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, authenticatedLimiter } from '@/lib/rateLimiter';
import { sendTrialCodeEmail } from '@/utils/sendEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Check if user already has a trial code
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with auth context
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    // Check if user already has a trial code assigned
    // Use service role to bypass RLS for checking (we'll verify user_id ourselves)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: existingTrial, error: fetchError } = await supabaseAdmin
      .from('user_trial_assignments')
      .select('trial_code, expires_at, assigned_at, username, password, link, whatsapp')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching trial code:', {
        code: fetchError.code,
        message: fetchError.message,
        details: fetchError.details,
        hint: fetchError.hint
      });
      
      // PGRST116 = no rows returned (this is OK, user doesn't have a code yet)
      // Also handle case where table might not exist yet
      if (fetchError.code === 'PGRST116' || fetchError.message?.includes('does not exist')) {
        // This is fine, user doesn't have a code yet or table doesn't exist (first time)
        return NextResponse.json({
          trial_code: null,
          expires_at: null,
        });
      } else {
        // Real error - log it and return error
        return NextResponse.json(
          { error: 'حدث خطأ أثناء التحقق من رمز التجربة', details: fetchError.message },
          { status: 500 }
        );
      }
    }

    if (existingTrial) {
      // Check if trial is still valid
      const expiresAt = new Date(existingTrial.expires_at);
      const now = new Date();
      
      if (now < expiresAt) {
        return NextResponse.json({
          trial_code: existingTrial.trial_code,
          expires_at: existingTrial.expires_at,
          username: existingTrial.username || null,
          password: existingTrial.password || null,
          link: existingTrial.link || null,
          whatsapp: existingTrial.whatsapp || null,
        });
      }
    }

    // Check if user has WhatsApp saved (even if no trial code)
    // Check user_trial_assignments first
    const { data: userAssignment } = await supabaseAdmin
      .from('user_trial_assignments')
      .select('whatsapp')
      .eq('user_id', user.id)
      .maybeSingle();

    if (userAssignment?.whatsapp) {
      return NextResponse.json({
        trial_code: null,
        expires_at: null,
        whatsapp: userAssignment.whatsapp,
      });
    }

    // Also check cart_sessions and active_subscriptions
    const { data: cartSession } = await supabaseAdmin
      .from('cart_sessions')
      .select('whatsapp')
      .eq('user_id', user.id)
      .is('converted_to_order_id', null)
      .maybeSingle();
    
    if (cartSession?.whatsapp) {
      return NextResponse.json({
        trial_code: null,
        expires_at: null,
        whatsapp: cartSession.whatsapp,
      });
    }

    const { data: subscription } = await supabaseAdmin
      .from('active_subscriptions')
      .select('customer_phone')
      .eq('customer_email', user.email || '')
      .maybeSingle();

    if (subscription?.customer_phone) {
      return NextResponse.json({
        trial_code: null,
        expires_at: null,
        whatsapp: subscription.customer_phone,
      });
    }

    // No trial code found (either never fetched, or already fetched and deleted)
    return NextResponse.json({
      trial_code: null,
      expires_at: null,
    });
  } catch (error: any) {
    console.error('Error in GET /api/trial:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Generate a new trial code for the user
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, authenticatedLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with auth context
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول.' },
        { status: 401 }
      );
    }

    console.log('User authenticated:', { id: user.id, email: user.email });

    // Use service role key for admin operations (needed for RPC call anyway)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already has a trial code assigned (using admin client to bypass RLS)
    const { data: existingTrial, error: checkError } = await supabaseAdmin
      .from('user_trial_assignments')
      .select('trial_code, expires_at, whatsapp')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('Existing trial check:', { existingTrial, checkError, userId: user.id });

    if (checkError) {
      console.error('Error checking existing trial:', {
        code: checkError.code,
        message: checkError.message,
        details: checkError.details
      });
      // Only return error if it's not "no rows found"
      if (checkError.code !== 'PGRST116' && !checkError.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'حدث خطأ أثناء التحقق من رمز التجربة', details: checkError.message },
          { status: 500 }
        );
      }
    }

    if (existingTrial) {
      // Check if trial is expired
      const expiresAt = new Date(existingTrial.expires_at);
      const now = new Date();
      
      if (now < expiresAt) {
        // Trial still valid
        return NextResponse.json(
          { error: 'مسموح تجربة واحدة فقط' },
          { status: 400 }
        );
      }
      // Trial expired, user can get a new one (optional - you might want to prevent this)
      // For now, we'll allow only one trial ever
      return NextResponse.json(
        { error: 'مسموح تجربة واحدة فقط' },
        { status: 400 }
      );
    }

    // Check if user has WhatsApp number saved
    let userWhatsapp: string | null = null;
    
    if (existingTrial?.whatsapp) {
      userWhatsapp = existingTrial.whatsapp;
    } else {
      // Check if user has WhatsApp in cart_sessions or active_subscriptions
      // Check cart_sessions first
      const { data: cartSession } = await supabaseAdmin
        .from('cart_sessions')
        .select('whatsapp')
        .eq('user_id', user.id)
        .is('converted_to_order_id', null)
        .maybeSingle();
      
      if (cartSession?.whatsapp) {
        userWhatsapp = cartSession.whatsapp;
      } else {
        // Check active_subscriptions
        const { data: subscription } = await supabaseAdmin
          .from('active_subscriptions')
          .select('customer_phone')
          .eq('customer_email', user.email || '')
          .maybeSingle();
        
        if (subscription?.customer_phone) {
          userWhatsapp = subscription.customer_phone;
        }
      }
    }

    // Require WhatsApp before allowing trial code assignment
    if (!userWhatsapp) {
      return NextResponse.json(
        { error: 'يرجى إدخال رقم الواتساب أولاً' },
        { status: 400 }
      );
    }

    // First, clean up expired codes from pool
    const { error: cleanupError } = await supabaseAdmin.rpc('delete_expired_trial_codes_pool');
    if (cleanupError) {
      console.warn('Warning: Failed to cleanup expired codes:', cleanupError);
      // Continue anyway
    }

    // Debug: Check available codes before assignment
    const { data: availableCodes, error: checkPoolError } = await supabaseAdmin
      .from('trial_codes_pool')
      .select('id, trial_code, expires_at, is_assigned')
      .eq('is_assigned', false)
      .gt('expires_at', new Date().toISOString())
      .limit(5);
    
    console.log('Available codes in pool:', availableCodes?.length || 0, checkPoolError);

    // Assign a trial code from pool to this user using the database function
    console.log('Calling RPC function with user_id:', user.id);
    const { data: assignedCode, error: assignError } = await supabaseAdmin
      .rpc('assign_trial_code_to_user', { p_user_id: user.id });

    console.log('RPC call result:', { 
      assignedCode, 
      assignError,
      errorCode: assignError?.code,
      errorMessage: assignError?.message,
      errorDetails: assignError?.details,
      errorHint: assignError?.hint
    });

    if (assignError) {
      console.error('Error assigning trial code:', {
        code: assignError.code,
        message: assignError.message,
        details: assignError.details,
        hint: assignError.hint
      });
      
      // Check if user already has a trial code
      if (assignError.message?.includes('already has a trial code') || 
          assignError.message?.includes('User already has')) {
        return NextResponse.json(
          { error: 'مسموح تجربة واحدة فقط' },
          { status: 400 }
        );
      }
      
      // If no codes available in pool
      if (assignError.message?.includes('No trial codes available') ||
          assignError.message?.includes('No trial codes')) {
        return NextResponse.json(
          { error: 'لا يوجد تجارب حاليا, جرب في وقت لاحق' },
          { status: 503 }
        );
      }
      
      // Check if function doesn't exist
      if (assignError.code === '42883' || (assignError.message?.includes('function') && assignError.message?.includes('does not exist'))) {
        return NextResponse.json(
          { error: 'خطأ في قاعدة البيانات: يرجى التأكد من تشغيل جميع المايجريشنز', details: assignError.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'حدث خطأ أثناء جلب رمز التجربة', details: assignError.message, code: assignError.code },
        { status: 500 }
      );
    }

    // Handle the response - RPC function returns TABLE, so it might be an array
    if (!assignedCode) {
      console.error('No data returned from RPC function');
      return NextResponse.json(
        { error: 'لا يوجد تجارب حاليا, جرب في وقت لاحق' },
        { status: 503 }
      );
    }

    // The function returns TABLE, so it should be an array
    const codeData = Array.isArray(assignedCode) ? assignedCode[0] : assignedCode;
    
    if (!codeData || !codeData.trial_code) {
      console.error('Invalid data structure from RPC:', assignedCode);
      return NextResponse.json(
        { error: 'لا يوجد تجارب حاليا, جرب في وقت لاحق' },
        { status: 503 }
      );
    }

    const trialCode = codeData.trial_code;
    const expiresAt = codeData.expires_at;
    
    // Get username, password, link from trial_codes_pool
    const { data: poolCode, error: poolError } = await supabaseAdmin
      .from('trial_codes_pool')
      .select('username, password, link')
      .eq('trial_code', trialCode)
      .maybeSingle();
    
    const username = poolCode?.username || null;
    const password = poolCode?.password || null;
    const link = poolCode?.link || null;

    // Update user_trial_assignments with username, password, link, user_email, and WhatsApp
    // The record should have been created by the assign_trial_code_to_user function
    // Get user WhatsApp from the check we did earlier
    const finalWhatsapp = userWhatsapp || null;
    
    // Update user_trial_assignments with credentials, user_email, and WhatsApp
    const { error: updateError } = await supabaseAdmin
      .from('user_trial_assignments')
      .update({
        username: username,
        password: password,
        link: link,
        user_email: user.email || null,
        whatsapp: finalWhatsapp,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating user_trial_assignments:', updateError);
      // Continue anyway, credentials update is optional
    } else {
      console.log('Updated user_trial_assignments with WhatsApp:', finalWhatsapp);
    }

    // Send email to user with trial code and credentials
    if (!user.email) {
      console.error('User email is missing, cannot send trial code email');
      // Still return the code, but log the issue
      return NextResponse.json({
        trial_code: trialCode,
        expires_at: expiresAt,
        username,
        password,
        link,
        warning: 'Trial code assigned but email notification failed (no email address)',
      });
    }

    try {
      await sendTrialCodeEmail({
        email: user.email,
        trialCode: trialCode,
        expiresAt: expiresAt,
        username,
        password,
        link,
      });
      console.log(`Trial code email sent successfully to ${user.email}`);
    } catch (emailError: any) {
      console.error('Error sending trial code email:', {
        error: emailError,
        message: emailError?.message,
        stack: emailError?.stack,
        email: user.email,
      });
      // Continue anyway, code was already assigned
      // Return the code with a warning
      return NextResponse.json({
        trial_code: trialCode,
        expires_at: expiresAt,
        username,
        password,
        link,
        warning: 'Trial code assigned but email notification may have failed',
      });
    }

    return NextResponse.json({
      trial_code: trialCode,
      expires_at: expiresAt,
      username,
      password,
      link,
    });
  } catch (error: any) {
    console.error('Error in POST /api/trial:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

