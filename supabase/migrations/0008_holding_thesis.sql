-- Why you bought a holding, in your own words.
--
-- A price and a quantity say what you did; they never say what you expected.
-- Six months later that reasoning is the only way to judge whether the position
-- is working for the reason you took it, or working by accident.

alter table public.holdings
  add column if not exists thesis text,
  add column if not exists review_on date;

comment on column public.holdings.thesis is
  'The user''s own reason for buying — never generated, never overwritten by the app.';
comment on column public.holdings.review_on is
  'Optional date to revisit the thesis.';
