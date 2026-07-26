# Thakrar Associates

A personal portfolio tracking and stock research app.

## Planned features

1. **Portfolio** — add holdings manually, refresh prices on demand to see profit/loss.
2. **News** — sector and stock-specific news, national and global.
3. **Analyzer** — upload annual/quarterly report PDFs, review extracted financials,
   read concall summaries, and ask an AI questions about a stock.

## Tech

- **Next.js** (App Router) — pages and server code
- **Supabase** — database, authentication, file storage
- **Tailwind CSS** — styling
- **Vercel** — hosting

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

Open http://localhost:3000.

## Project layout

| Path | What lives here |
| --- | --- |
| `src/app/(app)/` | Signed-in pages (dashboard, portfolio, news, analyzer) |
| `src/app/login/` | Sign in / create account |
| `src/components/` | Reusable UI pieces |
| `src/lib/supabase/` | Supabase connection setup |
| `src/middleware.ts` | Keeps the login session fresh, guards private pages |
