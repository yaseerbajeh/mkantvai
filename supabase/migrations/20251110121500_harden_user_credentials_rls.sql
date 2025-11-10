-- Harden security for user_credentials
-- 1) Enable Row Level Security (RLS)
alter table if exists public.user_credentials enable row level security;

-- 2) Revoke broad privileges from anon/authenticated (policies will govern access)
revoke all on table public.user_credentials from anon;
revoke all on table public.user_credentials from authenticated;

-- 3) Allow the service role to manage rows (bypasses RLS automatically)
-- No explicit grant needed for service role; it bypasses RLS by design in Supabase.

-- 4) Policies for authenticated users to manage ONLY their own record
drop policy if exists "select_own_credentials" on public.user_credentials;
create policy "select_own_credentials"
on public.user_credentials
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "insert_own_credentials" on public.user_credentials;
create policy "insert_own_credentials"
on public.user_credentials
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "update_own_credentials" on public.user_credentials;
create policy "update_own_credentials"
on public.user_credentials
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Optional: prevent deletes by end users
drop policy if exists "delete_own_credentials" on public.user_credentials;
create policy "delete_own_credentials"
on public.user_credentials
for delete
to authenticated
using (false);

comment on policy "select_own_credentials" on public.user_credentials is 'Authenticated users can read only their own credentials';
comment on policy "insert_own_credentials" on public.user_credentials is 'Authenticated users can insert only their own credentials';
comment on policy "update_own_credentials" on public.user_credentials is 'Authenticated users can update only their own credentials';
comment on policy "delete_own_credentials" on public.user_credentials is 'End users cannot delete credentials';


