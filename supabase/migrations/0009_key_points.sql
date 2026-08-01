-- Screener-style key points: a short fact sheet on what the company is and how
-- it is doing, kept separate from the longer briefing.
--
-- Its own table rather than another column on stock_insights, because the two
-- are generated independently: the fact sheet is cheap and quick and gets
-- refreshed often, the briefing is neither.

create table if not exists public.stock_key_points (
  stock_id uuid primary key references public.stocks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  content jsonb not null,
  generated_at timestamptz not null default now()
);

alter table public.stock_key_points enable row level security;

drop policy if exists "Users can read own key points" on public.stock_key_points;
create policy "Users can read own key points"
  on public.stock_key_points for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own key points" on public.stock_key_points;
create policy "Users can insert own key points"
  on public.stock_key_points for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own key points" on public.stock_key_points;
create policy "Users can update own key points"
  on public.stock_key_points for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own key points" on public.stock_key_points;
create policy "Users can delete own key points"
  on public.stock_key_points for delete using (auth.uid() = user_id);
