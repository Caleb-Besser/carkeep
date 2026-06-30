# Personal Expense Tracker

A personal budgeting app built with Next.js App Router, TypeScript, Tailwind CSS, shadcn-style components, Prisma, and a PostgreSQL-compatible schema. The MVP is designed for a single user, prioritizes monthly category budgets, and deploys cleanly to Vercel.

## MVP implementation plan

1. Scaffold a Vercel-friendly Next.js App Router project with TypeScript and Tailwind.
2. Add a PostgreSQL Prisma schema for `User`, `Category`, `Expense`, and `RecurringExpense`.
3. Build a month-aware dashboard that emphasizes remaining budget by category.
4. Add fast manual expense entry, category CRUD, and filtered monthly expense history.
5. Seed realistic sample data so the UI is useful immediately after setup.
6. Keep the architecture simple: server-rendered reads, server actions for writes, reusable UI primitives.

## Current feature set

- Dashboard summary with total budgeted, total spent, and total remaining
- Category budget cards with progress bars and warning states
- Fast add-expense dialog
- Category create, edit, and delete flows
- Expense history table filtered by month and category
- Month switching via URL params
- Recurring expense data model plus a minimal recurring overview panel
- Default single-user setup with no auth required for the MVP

## Tech stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style component structure in `src/components/ui`
- Prisma ORM
- PostgreSQL-compatible schema
- Vercel-friendly server actions and runtime behavior

## Prisma schema

The full schema lives in `prisma/schema.prisma`.

### Models

- `User`
  - Single-user MVP owner record
- `Category`
  - Name, icon, color, monthly budget limit, sort order
- `Expense`
  - Amount in cents, category, date, optional note
- `RecurringExpense`
  - Recurrence-ready structure for rent, subscriptions, and other repeating expenses

### Schema notes

- Currency values are stored as integer cents to avoid floating point issues.
- `Expense.categoryId` and `RecurringExpense.categoryId` are nullable with `onDelete: SetNull`, so deleting a category does not erase historical expenses.
- The schema uses `provider = "postgresql"` for clean deployment to Vercel Postgres, Neon, Supabase, Railway, or any compatible Postgres database.

## Folder structure

```text
.
|-- .env.example
|-- AGENTS.md
|-- CLAUDE.md
|-- components.json
|-- eslint.config.mjs
|-- next.config.ts
|-- package.json
|-- postcss.config.mjs
|-- prisma
|   |-- schema.prisma
|   `-- seed.ts
|-- public
|-- src
|   |-- actions
|   |   `-- budget-actions.ts
|   |-- app
|   |   |-- favicon.ico
|   |   |-- globals.css
|   |   |-- layout.tsx
|   |   |-- loading.tsx
|   |   `-- page.tsx
|   |-- components
|   |   |-- app
|   |   |   |-- add-expense-dialog.tsx
|   |   |   |-- budget-card.tsx
|   |   |   |-- category-icon.tsx
|   |   |   |-- category-manager.tsx
|   |   |   |-- database-state-card.tsx
|   |   |   |-- expense-history-table.tsx
|   |   |   |-- history-filters.tsx
|   |   |   |-- month-switcher.tsx
|   |   |   |-- recurring-expenses-panel.tsx
|   |   |   `-- summary-strip.tsx
|   |   `-- ui
|   |       |-- badge.tsx
|   |       |-- button.tsx
|   |       |-- card.tsx
|   |       |-- dialog.tsx
|   |       |-- input.tsx
|   |       |-- label.tsx
|   |       |-- progress.tsx
|   |       |-- select.tsx
|   |       |-- table.tsx
|   |       `-- textarea.tsx
|   `-- lib
|       |-- constants.ts
|       |-- dashboard.ts
|       |-- default-user.ts
|       |-- finance.ts
|       |-- prisma.ts
|       `-- utils.ts
`-- tsconfig.json
```

## Key architecture decisions

### Single-user MVP without auth

The app auto-creates a default user record server-side. That keeps the first version simple while preserving a clean path to real authentication later.

### Remaining-budget-first dashboard

The dashboard highlights what is left in each category, not just what has already been spent. Cards show:

- category name
- monthly budget
- amount spent this month
- remaining amount
- progress bar
- warning or over-budget state

### URL-based month and filter state

Month and category filters live in search params:

- `?month=2026-03`
- `?month=2026-03&categoryId=...`

That makes the app easy to extend later with deeper reporting, shareable filtered views, or dedicated month pages.

### Server actions for CRUD

Mutations are handled in `src/actions/budget-actions.ts`:

- create expense
- create category
- update category
- delete category

This keeps writes simple, colocated with the app, and easy to deploy on Vercel.

### Vercel-safe rendering

The main dashboard route is marked dynamic so the app does not require a live database connection during static prerendering at build time.

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the database

Copy `.env.example` to `.env` and set a valid Postgres connection string:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/expense_tracker?schema=public"
```

### 3. Push the Prisma schema

```bash
npm run db:push
```

### 4. Seed example data

```bash
npm run db:seed
```

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful scripts

```bash
npm run dev
npm run build
npm run lint
npm run prisma:generate
npm run db:push
npm run db:seed
npm run import:csv -- --file "C:\path\transactions.csv" --dry-run
npm run import:csv -- --file "C:\path\transactions.csv" --replace
```

## Importing bank CSVs

There is now a reusable importer for transaction exports with columns:

```text
Date, Time, Amount, Type, Description
```

### Preview an import

```bash
npm run import:csv -- --file "C:\path\transactions.csv" --dry-run
```

### Replace demo data with real transactions

```bash
npm run import:csv -- --file "C:\path\transactions.csv" --replace
```

### Import behavior

- Imports negative amounts as expenses
- Skips deposits
- Skips internal transfers to savings
- Skips self-transfers
- Skips likely credit-card payment transfers such as `DISCOVER E-PAYMENT`
- Auto-creates categories and estimates monthly budgets from your imported history

### Current categorization assumptions

- Restaurants, groceries, and vending purchases go to `Food & Dining`
- Fuel and gas station purchases go to `Gas & Auto`
- Bars and nightlife go to `Fun & Going Out`
- Amazon and similar purchases go to `Shopping`
- ATM withdrawals go to `Cash & ATM`
- Outgoing Zelle and Venmo payments go to `Peer Payments`
- Anything unmatched goes to `Misc`

## Deploying to Vercel

## SimpleFIN Bridge syncing

The finance dashboard supports SimpleFIN as its preferred read-only transaction and balance source. Ally and Discover CSV uploads remain available as a fallback and now pass through the same normalized ledger/classification layer. CSV rows are fingerprinted, and a same-amount/same-merchant transaction within two days of a SimpleFIN row is skipped to reduce cross-source duplicates.

1. Copy `.env.example` and configure `DATABASE_URL`, `FINANCE_SETTINGS_PASSWORD`, and a generated `SIMPLEFIN_ENCRYPTION_KEY`.
2. Apply the schema with `npx prisma migrate deploy` (production) or `npx prisma migrate dev` (local development).
3. Open `/finance/settings`, unlock it, and follow the link to create a one-time SimpleFIN Bridge token.
4. Paste the setup token into the server-backed form. The app claims it server-side and stores only an AES-256-GCM encrypted access URL.
5. Review account names/types and choose which accounts contribute to dashboard totals, then use **Sync now**.

Each sync rechecks the latest 45 days, requests pending transactions, updates matching provider IDs, and reconciles likely pending-to-posted replacements. Core totals exclude pending transactions and count only `EXPENSE` as spending; categorized `REFUND` rows reduce spending. Transfers, savings movements, and credit-card payments stay visible without being counted twice.

The same sync service is exposed to Vercel Cron at `GET /api/cron/simplefin`. Configure `CRON_SECRET`; Vercel sends it as `Authorization: Bearer …`. Add a schedule in `vercel.json` when you are ready to enable automatic sync. Never prefix the SimpleFIN variables with `NEXT_PUBLIC_`, log setup tokens/access URLs, or commit real values.

### Recommended database options

- Vercel Postgres
- Neon
- Supabase
- Railway Postgres

### Deployment steps

1. Push this repo to GitHub.
2. Import the project into Vercel.
3. Add `DATABASE_URL` in the Vercel project environment variables.
4. Deploy.
5. Run `npm run db:push` against the production database before using the app, or use Prisma Migrate later if you want versioned SQL migrations.

### Notes

- `postinstall` runs `prisma generate`, so the Prisma client is available in Vercel builds.
- The app uses App Router server components plus server actions, which fit Vercel well.
- The schema is already Postgres-compatible.

## Seed data included

The seed script creates:

- sample categories such as Food, Gas, Rent, Fun, Subscriptions, and Misc
- current-month expenses
- a few previous-month expenses for month switching
- recurring templates for rent and a subscription

## Next extensions

Good follow-up additions after this MVP:

- real authentication
- category-specific recurring expense CRUD
- charts by month and category
- carry-over rules
- import from CSV or bank export
- budget templates and yearly reporting
