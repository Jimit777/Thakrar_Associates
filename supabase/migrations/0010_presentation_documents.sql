-- Investor presentations as a document type.
--
-- The quarterly deck is where a company states the things a fact sheet wants
-- and the financial statements never carry: AUM, customer mix, disbursements,
-- partner names, guidance. Reading one directly beats searching the web for
-- the same slides — cheaper, and it is the primary source rather than
-- somebody's summary of it.

alter table public.documents
  drop constraint if exists documents_kind_check;

alter table public.documents
  add constraint documents_kind_check
  check (kind in ('annual_report', 'quarterly_result', 'concall', 'presentation'));
