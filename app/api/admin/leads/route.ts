import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, adminLimiter } from '@/lib/rateLimiter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to normalize WhatsApp number (remove +, spaces, @s.whatsapp.net, keep only digits)
function normalizeWhatsAppNumber(whatsapp: string | null | undefined): string | null {
  if (!whatsapp) return null;
  // Remove all non-digit characters
  const normalized = whatsapp.replace(/[^0-9]/g, '');
  return normalized || null;
}

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

// Helper to verify n8n API key
function verifyN8nApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const expectedKey = process.env.N8N_API_KEY;
  return !!expectedKey && apiKey === expectedKey;
}

// GET - Fetch all leads
export async function GET(request: NextRequest) {
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
    const { data: leads, error } = await supabaseAdmin
      .from('crm_leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leads:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      
      // Check if table doesn't exist
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json(
          { 
            error: 'جدول العملاء المحتملين غير موجود. يرجى تشغيل SQL migration في Supabase أولاً.',
            details: 'Run the migration file: supabase/migrations/20250131000000_create_crm_leads_table.sql'
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'حدث خطأ أثناء جلب العملاء المحتملين',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ leads: leads || [] });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST - Create new lead (for WhatsApp/n8n integration or manual creation)
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, adminLimiter);
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    // Check authentication: either admin user or n8n API key
    const adminUser = await getAdminUser(request);
    const isN8nRequest = verifyN8nApiKey(request);
    
    if (!adminUser && !isN8nRequest) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { source, name, email, whatsapp, products, total_amount, source_reference_id } = body;

    if (!name || !source) {
      return NextResponse.json(
        { error: 'الاسم والمصدر مطلوبان' },
        { status: 400 }
      );
    }

    if (!['abandoned_cart', 'whatsapp', 'manual'].includes(source)) {
      return NextResponse.json(
        { error: 'مصدر غير صحيح' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // For WhatsApp leads, check for duplicates
    if (source === 'whatsapp' && whatsapp) {
      const normalizedWhatsApp = normalizeWhatsAppNumber(whatsapp);
      if (normalizedWhatsApp) {
        // Check if lead already exists with this WhatsApp number
        const { data: existingLead, error: checkError } = await supabaseAdmin
          .from('crm_leads')
          .select('*')
          .eq('source', 'whatsapp')
          .eq('whatsapp', normalizedWhatsApp)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is fine
          console.error('Error checking for existing lead:', checkError);
        }

        if (existingLead) {
          // Update existing lead instead of creating duplicate
          const comments = Array.isArray(existingLead.comments) ? existingLead.comments : [];
          comments.push({
            text: 'New message received from customer',
            added_by: 'system',
            added_at: new Date().toISOString(),
          });

          const { data: updatedLead, error: updateError } = await supabaseAdmin
            .from('crm_leads')
            .update({
              updated_at: new Date().toISOString(),
              comments,
            })
            .eq('id', existingLead.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating existing lead:', updateError);
            return NextResponse.json(
              { error: 'حدث خطأ أثناء تحديث العميل المحتمل' },
              { status: 500 }
            );
          }

          return NextResponse.json({ 
            lead: updatedLead,
            message: 'Lead updated (duplicate prevented)'
          });
        }
      }
    }

    // For abandoned_cart leads, check by source_reference_id
    if (source === 'abandoned_cart' && source_reference_id) {
      const { data: existingLead } = await supabaseAdmin
        .from('crm_leads')
        .select('id')
        .eq('source', 'abandoned_cart')
        .eq('source_reference_id', source_reference_id)
        .maybeSingle();

      if (existingLead) {
        // Lead already exists, return existing one
        const { data: lead } = await supabaseAdmin
          .from('crm_leads')
          .select('*')
          .eq('id', existingLead.id)
          .single();

        return NextResponse.json({ 
          lead,
          message: 'Lead already exists'
        });
      }
    }

    // Normalize WhatsApp number before storing
    const normalizedWhatsApp = whatsapp ? normalizeWhatsAppNumber(whatsapp) : null;

    // Auto-set urgent importance for WhatsApp and abandoned_cart sources
    const importance = (source === 'whatsapp' || source === 'abandoned_cart') ? 'urgent' : 'medium';

    // Create new lead
    const { data: lead, error: insertError } = await supabaseAdmin
      .from('crm_leads')
      .insert({
        source,
        name,
        email: email || null,
        whatsapp: normalizedWhatsApp,
        products: products || [],
        total_amount: total_amount || 0,
        source_reference_id: source_reference_id || null,
        status: 'new',
        importance,
        comments: [],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating lead:', insertError);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء إنشاء العميل المحتمل' },
        { status: 500 }
      );
    }

    return NextResponse.json({ lead });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

