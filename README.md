# CarKeep

A private, mobile-first tracker for a 2016 Acura ILX 4D. It records mileage,
Maintenance Minder codes, condition photos, recurring checks, notes, and an
oil-change estimate.

## Security model

The four-digit PIN is checked by a Vercel server function. The browser receives
an HTTP-only signed session cookie and never receives the PIN, session secret,
or Supabase service-role key.

Supabase RLS is enabled with no public table policies. Database operations run
through authenticated server functions. The private photo bucket accepts each
upload through a one-time signed upload token.

The PIN is still lightweight privacy, not a replacement for a strong account
system. Choose a PIN that is not used for banking, devices, or other accounts.

## Set up Supabase

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run `supabase/migrations/001_initial_schema.sql`.
4. Copy the project URL, anon key, and service-role key from Project Settings.

The migration creates the tables, indexes, default car, and private
`car-entry-photos` bucket.

## Run locally

Copy `.env.example` to `.env.local` and replace every example value. Generate a
session secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Install and run the Vercel development server:

```powershell
npm install
npx vercel dev
```

Vercel dev serves both Vite and the `/api` functions.

## Deploy

1. Import this repository into Vercel.
2. Add all six variables from `.env.example` under Project Settings >
   Environment Variables. Do not prefix the PIN, session secret, or service
   role key with `VITE_`.
3. Deploy.
4. In Vercel, open Project Settings > Domains and add
   `car.calebbesser.quest`.
5. Follow Vercel's DNS prompt. This will normally be a CNAME for `car` pointing
   at `cname.vercel-dns.com`.

Do not commit `.env.local`.
