-- Generated business overview and assessment for a stock. Cached because
-- producing it costs a web-search-backed model call; refreshed on demand.

create table if not exists public.stock_insights (
  stock_id uuid primary key references public.stocks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Whole generated payload: overview, strengths, concerns, what to watch.
  content jsonb not null,

  -- What the assessment was based on, so a stale one is recognisable.
  periods_used int not null default 0,
  generated_at timestamptz not null default now()
);

alter table public.stock_insights enable row level security;

drop policy if exists "Users can read own insights" on public.stock_insights;
create policy "Users can read own insights"
  on public.stock_insights for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own insights" on public.stock_insights;
create policy "Users can insert own insights"
  on public.stock_insights for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own insights" on public.stock_insights;
create policy "Users can update own insights"
  on public.stock_insights for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own insights" on public.stock_insights;
create policy "Users can delete own insights"
  on public.stock_insights for delete using (auth.uid() = user_id);
