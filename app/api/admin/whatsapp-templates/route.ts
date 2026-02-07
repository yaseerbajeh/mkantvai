import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// GET - Fetch all WhatsApp templates
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_reminder_templates')
      .select('*')
      .order('stage', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'فشل في جلب القوالب', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'خطأ في الخادم', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a template by stage
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { stage, template_name, template_body, is_active } = body;

    if (!stage || (!template_name && !template_body && is_active === undefined)) {
      return NextResponse.json(
        { error: 'يجب تحديد المرحلة والبيانات المطلوب تحديثها' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (template_name !== undefined) updateData.template_name = template_name;
    if (template_body !== undefined) updateData.template_body = template_body;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from('whatsapp_reminder_templates')
      .update(updateData)
      .eq('stage', stage)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'فشل في تحديث القالب', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, template: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'خطأ في الخادم', details: error.message },
      { status: 500 }
    );
  }
}
