# RiceMillOS

Rice mill digital management & analytics system. Connects to a live Supabase
project (database, auth, and row-level security are already set up).

## Run it locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Demo logins

All demo accounts use the password `RiceMill@2026`:

| Role       | Email                        |
|------------|-------------------------------|
| Owner      | owner@ricemillos.demo         |
| Manager    | manager@ricemillos.demo       |
| Accountant | accountant@ricemillos.demo    |
| Operator   | operator@ricemillos.demo      |

## Deploy

Works as-is on Vercel or Netlify:

1. Push this folder to a GitHub repo.
2. Import it into Vercel/Netlify.
3. Set the build command to `npm run build`, output directory `dist`.
4. Add the two environment variables from `.env.example` in your host's
   project settings (same values — they are the public/anon Supabase
   credentials, safe to expose client-side because the database is
   protected by row-level security).

## What's built

Every module from the spec is implemented and wired to the live Supabase project:

- **Dashboard** — KPI cards, production recovery stats, sales/purchase/production trends, expense breakdown, low-stock alerts, recent activity
- **Purchasing** — add/list/filter purchases, record payments, cancel (auto-reverses stock)
- **Sales** — add/list/filter sales with live stock guard, payments, dispatch status, cancel
- **Suppliers / Customers** — profiles with outstanding balances and transaction history
- **Inventory** — live stock by category, low-stock alerts, manual adjustments, per-product transaction history
- **Production** — batches with paddy input, multi-product outputs, recovery %/broken % calculated live
- **Expenses** — categorized expenses with breakdown chart
- **Reports** — 9 report types (daily, purchases, sales, production, inventory, expenses, supplier/customer outstanding, product performance) with print/CSV export
- **Users & Roles** — view team, owner can change roles/active status
- **Settings** — profile editing, mill info
- **Installable as an app** — install button in the top bar (native prompt on Chrome/Edge/Android, "Add to Home Screen" instructions on iOS Safari)

## What's next
