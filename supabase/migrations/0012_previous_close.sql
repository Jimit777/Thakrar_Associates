-- Yesterday's close, so the portfolio can show today's move.
--
-- The price feed returns it in the same response as the current price, so this
-- costs nothing extra to collect — it was simply being thrown away.

alter table public.holdings
  add column if not exists previous_close numeric(20, 4);

comment on column public.holdings.previous_close is
  'Previous session close, captured alongside last_price on each refresh.';
