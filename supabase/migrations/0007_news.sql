-- One cached news digest per user, covering their whole portfolio grouped by
-- sector. Cached because building it costs a search-backed model call.

create table if not exists public.news_digests (
  user_id uuid primary key references auth.users (id) on delete cascade,

  content jsonb not null,
  -- What the digest covered, so a stale one is recognisable after the
  -- portfolio changes.
  symbols text[] not null default '{}',

  generated_at timestamptz not null default now()
);

alter table public.news_digests enable row level security;

drop policy if exists "Users can read own digest" on public.news_digests;
create policy "Users can read own digest"
  on public.news_digests for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own digest" on public.news_digests;
create policy "Users can insert own digest"
  on public.news_digests for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own digest" on public.news_digests;
create policy "Users can update own digest"
  on public.news_digests for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own digest" on public.news_digests;
create policy "Users can delete own digest"
  on public.news_digests for delete using (auth.uid() = user_id);
