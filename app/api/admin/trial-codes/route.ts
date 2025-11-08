import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Helper to get admin user from auth token
async function getAdminUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (adminEmails.length > 0 && !adminEmails.includes(user.email || '')) {
    return null;
  }

  return user;
}

// GET - List all trial codes
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم: مفاتيح قاعدة البيانات غير متوفرة' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const showExpired = searchParams.get('showExpired') === 'true';
    const status = searchParams.get('status'); // 'available', 'assigned', 'expired', 'all'

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    let query = supabaseAdmin
      .from('trial_codes_pool')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by status
    if (status === 'available') {
      query = query.eq('is_assigned', false).gt('expires_at', new Date().toISOString());
    } else if (status === 'assigned') {
      query = query.eq('is_assigned', true);
    } else if (status === 'expired') {
      query = query.lt('expires_at', new Date().toISOString());
    } else if (!showExpired) {
      // Default: hide expired codes (expired more than 12 hours ago)
      const twelveHoursAgo = new Date();
      twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
      query = query.gt('expires_at', twelveHoursAgo.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching trial codes:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في جلب رموز التجربة' },
        { status: 500 }
      );
    }

    // Calculate status for each code
    const now = new Date();
    const codesWithStatus = (data || []).map((code: any) => {
      const isExpired = new Date(code.expires_at) < now;
      const isAvailable = !code.is_assigned && !isExpired;
      
      return {
        ...code,
        status: code.is_assigned ? 'assigned' : (isExpired ? 'expired' : 'available'),
        is_expired: isExpired,
        is_available: isAvailable,
      };
    });

    // Get counts
    const availableCount = codesWithStatus.filter((c: any) => c.status === 'available').length;
    const assignedCount = codesWithStatus.filter((c: any) => c.status === 'assigned').length;
    const expiredCount = codesWithStatus.filter((c: any) => c.status === 'expired').length;

    return NextResponse.json({ 
      trialCodes: codesWithStatus,
      counts: {
        total: codesWithStatus.length,
        available: availableCount,
        assigned: assignedCount,
        expired: expiredCount,
      }
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Create new trial code
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { trial_code, expires_at, username, password, link } = body;

    // Validate required fields
    if (!trial_code || !expires_at) {
      return NextResponse.json(
        { error: 'رمز التجربة وتاريخ الانتهاء مطلوبان' },
        { status: 400 }
      );
    }

    // Validate expiration date is in the future
    const expirationDate = new Date(expires_at);
    if (expirationDate <= new Date()) {
      return NextResponse.json(
        { error: 'تاريخ الانتهاء يجب أن يكون في المستقبل' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabaseAdmin
      .from('trial_codes_pool')
      .insert({
        trial_code: trial_code.trim(),
        expires_at: expirationDate.toISOString(),
        username: username || null,
        password: password || null,
        link: link || null,
        is_assigned: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating trial code:', error);
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'رمز التجربة موجود بالفعل' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'فشل في إنشاء رمز التجربة' },
        { status: 500 }
      );
    }

    return NextResponse.json({ trialCode: data });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// PUT - Update existing trial code
export async function PUT(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'معرف رمز التجربة مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validate expiration date if provided
    if (updates.expires_at) {
      const expirationDate = new Date(updates.expires_at);
      if (expirationDate <= new Date()) {
        return NextResponse.json(
          { error: 'تاريخ الانتهاء يجب أن يكون في المستقبل' },
          { status: 400 }
        );
      }
      updates.expires_at = expirationDate.toISOString();
    }

    const updateData: any = {
      ...updates,
    };

    if (updates.trial_code) {
      updateData.trial_code = updates.trial_code.trim();
    }

    const { data, error } = await supabaseAdmin
      .from('trial_codes_pool')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating trial code:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'رمز التجربة موجود بالفعل' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'فشل في تحديث رمز التجربة' },
        { status: 500 }
      );
    }

    return NextResponse.json({ trialCode: data });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE - Delete trial code
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'خطأ في إعدادات الخادم' },
        { status: 500 }
      );
    }

    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'معرف رمز التجربة مطلوب' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if code is assigned
    const { data: codeData } = await supabaseAdmin
      .from('trial_codes_pool')
      .select('is_assigned')
      .eq('id', id)
      .single();

    if (codeData?.is_assigned) {
      return NextResponse.json(
        { error: 'لا يمكن حذف رمز التجربة لأنه مستخدم' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('trial_codes_pool')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting trial code:', error);
      return NextResponse.json(
        { error: error.message || 'فشل في حذف رمز التجربة' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

