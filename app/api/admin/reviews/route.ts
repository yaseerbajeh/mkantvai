
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper to check for admin access (using service role for database operations, but checking auth logic ideally)
// For this project, we rely on the specific route or calling client to have validated the session, 
// BUT for robust admin APIs, we should verify the user is an admin.
// Since we are inside `api/admin`, we should double check headers or session if possible, 
// but often in Next.js app directory with client-side admin checks, the API might trust the caller 
// or re-verify. Given the pattern in `admin/page.tsx` checks emails client-side, 
// we should ideally check server-side too. 
// However, looking at other files (like check-email), they might just process logic.
// Let's implement basic admin verification if possible, or at least use service role to perform the operations.

async function isAdmin(request: NextRequest) {
    // In a real app, we'd verify the JWT and check against an admin list/table.
    // For now, consistent with the project style, we'll proceed but rely on the frontend protection 
    // and maybe check if we can decode the user.
    // We will assume the frontend handles the primary gatekeeping, 
    // but for the API, we'll verify the user exists.

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return false;

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return false;

    const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';
    const adminEmails = adminEmailsStr.split(',').map(e => e.trim());

    // If no admin emails defined, maybe allow logic (development) or block. 
    // Based on admin/page.tsx 'No admin emails configured - allowing access for development only' logic:
    if (!adminEmailsStr && process.env.NODE_ENV === 'development') return true;

    return adminEmails.includes(user.email || '');
}

export async function GET(request: NextRequest) {
    // Check admin
    const isAuthorized = await isAdmin(request);
    if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: reviews, error } = await supabase
            .from('reviews')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching reviews:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ reviews });
    } catch (error: any) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    // Check admin
    const isAuthorized = await isAdmin(request);
    if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error } = await supabase
            .from('reviews')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting review:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
