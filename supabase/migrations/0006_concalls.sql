-- Summaries of earnings call transcripts. One per uploaded concall document.

create table if not exists public.concall_summaries (
  document_id uuid primary key references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete cascade,

  period_label text not null,
  content jsonb not null,

  generated_at timestamptz not null default now()
);

create index if not exists concall_summaries_stock_id_idx
  on public.concall_summaries (stock_id);

alter table public.concall_summaries enable row level security;

drop policy if exists "Users can read own concalls" on public.concall_summaries;
create policy "Users can read own concalls"
  on public.concall_summaries for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own concalls" on public.concall_summaries;
create policy "Users can insert own concalls"
  on public.concall_summaries for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own concalls" on public.concall_summaries;
create policy "Users can update own concalls"
  on public.concall_summaries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own concalls" on public.concall_summaries;
create policy "Users can delete own concalls"
  on public.concall_summaries for delete using (auth.uid() = user_id);
