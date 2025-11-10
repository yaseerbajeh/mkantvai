-- Create user_credentials table to store verified contact info
create table if not exists public.user_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  phone text not null, -- stored as 966#########
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uniqueness constraints
create unique index if not exists idx_user_credentials_user_id on public.user_credentials(user_id);
create index if not exists idx_user_credentials_email on public.user_credentials(email);
create index if not exists idx_user_credentials_phone on public.user_credentials(phone);

-- Simple trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_credentials_updated_at on public.user_credentials;
create trigger trg_user_credentials_updated_at
before update on public.user_credentials
for each row execute function public.set_updated_at();

comment on table public.user_credentials is 'Stores verified user email and phone (966#########) for trials and contact.';
comment on column public.user_credentials.phone is 'Phone number in format 966[9digits]';


