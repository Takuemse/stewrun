-- Users table
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('customer','cook')) default 'customer',
  created_at timestamptz default now()
);

-- Menu items (the cook's dishes)
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null check (price > 0),
  available boolean default true,
  created_at timestamptz default now()
);

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.users(id),
  items jsonb not null,
  total numeric(10,2) not null,
  hub text not null check (hub in ('Eastgate','Joina City','Avondale')),
  pickup_time text not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','ready','collected','cancelled')),
  payment_status text not null default 'held'
    check (payment_status in ('held','released','refunded')),
  pickup_code text not null,
  created_at timestamptz default now(),
  collected_at timestamptz
);

-- Ratings
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.users(id),
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

-- Indexes (performance)
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_status_idx on public.orders(status);

-- Enable RLS
alter table public.users enable row level security;
alter table public.orders enable row level security;
alter table public.ratings enable row level security;
alter table public.menu_items enable row level security;

-- Users can only read their own data
create policy "users self" on public.users
  for all using (auth.uid() = id);

-- Menu is publicly readable, only cook can write (temporarily open write during development)
create policy "menu read" on public.menu_items for select using (true);
create policy "menu write" on public.menu_items for all
  using (exists (select 1 from public.users where id = auth.uid() and role='cook'));

-- Customers see their own orders, cook sees all
create policy "orders customer" on public.orders for select
  using (auth.uid() = customer_id);
create policy "orders cook" on public.orders for select
  using (exists (select 1 from public.users where id = auth.uid() and role='cook'));
create policy "orders insert" on public.orders for insert
  with check (auth.uid() = customer_id);

-- Ratings
create policy "ratings insert" on public.ratings for insert
  with check (auth.uid() = customer_id);
create policy "ratings read" on public.ratings for select using (true);