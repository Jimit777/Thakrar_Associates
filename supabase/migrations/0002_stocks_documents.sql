-- Stocks the user researches, and the report PDFs uploaded for each.
-- Extracted financials arrive in a later migration.

create table if not exists public.stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  symbol text not null,
  name text,
  sector text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, symbol)
);

create index if not exists stocks_user_id_idx on public.stocks (user_id);

drop trigger if exists stocks_set_updated_at on public.stocks;
create trigger stocks_set_updated_at
  before update on public.stocks
  for each row
  execute function public.set_updated_at();

-- One row per uploaded PDF. The file itself lives in Supabase Storage; this
-- table records what it is and where to find it.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete cascade,

  kind text not null check (kind in ('annual_report', 'quarterly_result', 'concall')),
  period_label text not null,          -- e.g. 'FY2024' or 'Q2 FY2025'
  storage_path text not null unique,   -- path inside the 'documents' bucket
  file_name text not null,
  file_size_bytes bigint,

  created_at timestamptz not null default now()
);

create index if not exists documents_stock_id_idx on public.documents (stock_id);

alter table public.stocks enable row level security;
alter table public.documents enable row level security;

drop policy if exists "Users can read own stocks" on public.stocks;
create policy "Users can read own stocks"
  on public.stocks for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own stocks" on public.stocks;
create policy "Users can insert own stocks"
  on public.stocks for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own stocks" on public.stocks;
create policy "Users can update own stocks"
  on public.stocks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own stocks" on public.stocks;
create policy "Users can delete own stocks"
  on public.stocks for delete using (auth.uid() = user_id);

drop policy if exists "Users can read own documents" on public.documents;
create policy "Users can read own documents"
  on public.documents for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own documents" on public.documents;
create policy "Users can delete own documents"
  on public.documents for delete using (auth.uid() = user_id);

-- Private storage bucket for the PDFs.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Files are stored under <user id>/..., so the first path segment decides
-- ownership. This is what stops one user reading another's uploads.
drop policy if exists "Users can read own files" on storage.objects;
create policy "Users can read own files"
  on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own files" on storage.objects;
create policy "Users can upload own files"
  on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own files" on storage.objects;
create policy "Users can delete own files"
  on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
