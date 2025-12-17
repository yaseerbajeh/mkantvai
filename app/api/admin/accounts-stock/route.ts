import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

// GET: Fetch all accounts
export async function GET(request: NextRequest) {
    try {
        const adminUser = await getAdminUser(request);
        if (!adminUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { data, error } = await supabaseAdmin
            .from('accounts_stock')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ accounts: data });
    } catch (error: any) {
        console.error('Error fetching accounts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Create a new account
export async function POST(request: NextRequest) {
    try {
        const adminUser = await getAdminUser(request);
        if (!adminUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { email, password, expiration_date, renew_until, type, notes } = body;

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { data, error } = await supabaseAdmin
            .from('accounts_stock')
            .insert([
                {
                    email,
                    password,
                    expiration_date: expiration_date || null,
                    renew_until: renew_until || null,
                    type,
                    notes
                }
            ])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ account: data });
    } catch (error: any) {
        console.error('Error creating account:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Update an account
export async function PUT(request: NextRequest) {
    try {
        const adminUser = await getAdminUser(request);
        if (!adminUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // Sanitize dates
        if (updates.expiration_date === '') updates.expiration_date = null;
        if (updates.renew_until === '') updates.renew_until = null;

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { data, error } = await supabaseAdmin
            .from('accounts_stock')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ account: data });
    } catch (error: any) {
        console.error('Error updating account:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Delete an account
export async function DELETE(request: NextRequest) {
    try {
        const adminUser = await getAdminUser(request);
        if (!adminUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { error } = await supabaseAdmin
            .from('accounts_stock')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting account:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
