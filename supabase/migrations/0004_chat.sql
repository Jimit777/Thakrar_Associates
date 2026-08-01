-- Per-stock chat history. One conversation per stock, kept so context carries
-- across visits.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stock_id uuid not null references public.stocks (id) on delete cascade,

  role text not null check (role in ('user', 'assistant')),
  content text not null,

  created_at timestamptz not null default now()
);

create index if not exists chat_messages_stock_id_idx
  on public.chat_messages (stock_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Users can read own chat" on public.chat_messages;
create policy "Users can read own chat"
  on public.chat_messages for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own chat" on public.chat_messages;
create policy "Users can insert own chat"
  on public.chat_messages for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own chat" on public.chat_messages;
create policy "Users can delete own chat"
  on public.chat_messages for delete using (auth.uid() = user_id);
