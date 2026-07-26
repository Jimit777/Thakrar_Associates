-- Financial figures extracted from an uploaded report and confirmed by the user.
-- Nothing lands here until the user has reviewed it.

create table if not exists public.financials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete cascade,

  -- Kept so every figure can be traced back to the PDF it came from. Nulled
  -- rather than deleted if that document is later removed.
  source_document_id uuid references public.documents (id) on delete set null,

  period_type text not null check (period_type in ('annual', 'quarterly')),
  period_label text not null,                  -- 'FY2024', 'Q2 FY2025'
  basis text not null default 'unknown'
    check (basis in ('consolidated', 'standalone', 'unknown')),
  currency_unit text,                          -- e.g. 'INR crore'

  -- Line items as JSON: different sectors report different things, and this
  -- avoids a schema change every time a new figure is worth keeping.
  data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The same period on the same reporting basis should appear once per stock.
  unique (stock_id, period_label, basis)
);

create index if not exists financials_stock_id_idx on public.financials (stock_id);

drop trigger if exists financials_set_updated_at on public.financials;
create trigger financials_set_updated_at
  before update on public.financials
  for each row
  execute function public.set_updated_at();

alter table public.financials enable row level security;

drop policy if exists "Users can read own financials" on public.financials;
create policy "Users can read own financials"
  on public.financials for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own financials" on public.financials;
create policy "Users can insert own financials"
  on public.financials for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own financials" on public.financials;
create policy "Users can update own financials"
  on public.financials for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own financials" on public.financials;
create policy "Users can delete own financials"
  on public.financials for delete using (auth.uid() = user_id);
