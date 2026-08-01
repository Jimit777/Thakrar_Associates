-- Two cached, separately-refreshed research outputs.
--
-- Both are their own table for the same reason key points is: they are
-- generated independently, cost different amounts, and go stale on different
-- schedules. One wide "research" row would mean regenerating all of it to
-- refresh any of it.

-- How the company compares with its listed competitors. The peers' figures come
-- from the web; the company's own column is drawn from confirmed figures and is
-- never stored here.
create table if not exists public.stock_peers (
  stock_id uuid primary key references public.stocks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  content jsonb not null,
  generated_at timestamptz not null default now()
);

-- What management guided to on past earnings calls, set against what the
-- figures went on to show.
create table if not exists public.concall_promises (
  stock_id uuid primary key references public.stocks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  content jsonb not null,
  -- How many call summaries fed it, so a stale tracker is recognisable.
  calls_used int not null default 0,
  generated_at timestamptz not null default now()
);

alter table public.stock_peers enable row level security;
alter table public.concall_promises enable row level security;

drop policy if exists "Users can read own peers" on public.stock_peers;
create policy "Users can read own peers"
  on public.stock_peers for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own peers" on public.stock_peers;
create policy "Users can insert own peers"
  on public.stock_peers for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own peers" on public.stock_peers;
create policy "Users can update own peers"
  on public.stock_peers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own peers" on public.stock_peers;
create policy "Users can delete own peers"
  on public.stock_peers for delete using (auth.uid() = user_id);

drop policy if exists "Users can read own promises" on public.concall_promises;
create policy "Users can read own promises"
  on public.concall_promises for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own promises" on public.concall_promises;
create policy "Users can insert own promises"
  on public.concall_promises for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own promises" on public.concall_promises;
create policy "Users can update own promises"
  on public.concall_promises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own promises" on public.concall_promises;
create policy "Users can delete own promises"
  on public.concall_promises for delete using (auth.uid() = user_id);
