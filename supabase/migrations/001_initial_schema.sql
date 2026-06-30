create extension if not exists pgcrypto;

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  make text,
  model text,
  year int,
  body_style text,
  last_oil_change_mileage int check (last_oil_change_mileage >= 0),
  oil_change_interval int not null default 5000 check (oil_change_interval > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.car_entries (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  mileage int not null check (mileage >= 0),
  fuel_level text,
  check_engine_light boolean not null default false,
  maintenance_minder_code text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.car_entry_photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.car_entries(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  photo_type text not null check (photo_type in ('front', 'back', 'driver_side', 'passenger_side', 'extra')),
  photo_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.car_checks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.car_entries(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  check_key text not null check (
    check_key in (
      'jumper_cables', 'registration', 'insurance', 'engine_oil_level',
      'coolant_level', 'washer_fluid_level', 'brake_fluid_level', 'tire_pressure'
    )
  ),
  label text not null,
  category text not null check (category in ('Essentials', 'Fluids', 'Maintenance')),
  status text not null check (status in ('good', 'missing', 'low', 'bad', 'not_checked')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists car_entries_car_created_idx
  on public.car_entries (car_id, created_at desc);
create index if not exists car_checks_car_key_created_idx
  on public.car_checks (car_id, check_key, created_at desc);

alter table public.cars enable row level security;
alter table public.car_entries enable row level security;
alter table public.car_entry_photos enable row level security;
alter table public.car_checks enable row level security;

-- No public table policies are intentional. The Vercel API uses the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'car-entry-photos',
  'car-entry-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.cars (name, make, model, year, body_style, oil_change_interval)
select '2016 Acura ILX 4D', 'Acura', 'ILX', 2016, '4D', 5000
where not exists (select 1 from public.cars);
