-- Holdings: one row per stock the user owns.
-- Prices (last_price / last_refreshed_at) stay empty until the refresh
-- button is built in the next milestone.

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  symbol text not null,
  exchange text not null default 'NSE' check (exchange in ('NSE', 'BSE')),
  quantity numeric(20, 4) not null check (quantity > 0),
  avg_price numeric(20, 4) not null check (avg_price >= 0),
  buy_date date,

  last_price numeric(20, 4),
  last_refreshed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The same stock on the same exchange should only appear once per user.
  unique (user_id, symbol, exchange)
);

create index if not exists holdings_user_id_idx on public.holdings (user_id);

-- Keep updated_at accurate without having to remember it in application code.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists holdings_set_updated_at on public.holdings;
create trigger holdings_set_updated_at
  before update on public.holdings
  for each row
  execute function public.set_updated_at();

-- Row Level Security: every query is filtered to the signed-in user, enforced
-- by the database itself rather than by application code.
alter table public.holdings enable row level security;

drop policy if exists "Users can read own holdings" on public.holdings;
create policy "Users can read own holdings"
  on public.holdings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own holdings" on public.holdings;
create policy "Users can insert own holdings"
  on public.holdings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own holdings" on public.holdings;
create policy "Users can update own holdings"
  on public.holdings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own holdings" on public.holdings;
create policy "Users can delete own holdings"
  on public.holdings for delete
  using (auth.uid() = user_id);
