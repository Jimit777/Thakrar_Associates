-- Every company the app has encountered, not just the ones being researched.
--
-- `stocks` is what you have deliberately added and uploaded reports for.
-- This is wider: it also picks up companies named as peers, so the app
-- accumulates a small reference set as a by-product of ordinary use rather
-- than needing anything bulk-loaded.
--
-- What it is for today is sectors. The dashboard can only show where your
-- money sits if it knows what each holding does, and that was left to be typed
-- in by hand — so most holdings showed as unclassified. Classifying a company
-- once and reusing it means you pay for that judgement once, ever.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  symbol text not null,
  name text,

  -- A fixed vocabulary rather than free text: "Banking", "Banks" and
  -- "Financial Services" typed on three different days would split one holding
  -- group into three.
  sector text,
  -- 'user' when typed in, 'derived' when the app worked it out. A value the
  -- user set is never overwritten.
  sector_source text check (sector_source in ('user', 'derived')),

  -- How this company came to be known: added deliberately, or named as a peer.
  seen_as text not null default 'peer' check (seen_as in ('holding', 'stock', 'peer')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, symbol)
);

create index if not exists companies_user_id_idx on public.companies (user_id);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row
  execute function public.set_updated_at();

alter table public.companies enable row level security;

drop policy if exists "Users can read own companies" on public.companies;
create policy "Users can read own companies"
  on public.companies for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own companies" on public.companies;
create policy "Users can insert own companies"
  on public.companies for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own companies" on public.companies;
create policy "Users can update own companies"
  on public.companies for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own companies" on public.companies;
create policy "Users can delete own companies"
  on public.companies for delete using (auth.uid() = user_id);
