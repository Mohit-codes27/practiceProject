-- Supabase / Postgres schema for INE Product Price Tracker.
-- Run in Supabase SQL editor, or point DATABASE_URL at the project and start
-- the server (it auto-creates the same tables via CREATE TABLE IF NOT EXISTS).

create extension if not exists "pgcrypto";

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_product_id text unique not null,
  name text not null,
  product_url text not null,
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  option_name text not null,
  option_value text not null,
  store_option_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, option_value)
);

create table if not exists tracked_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  option_id uuid not null references product_options(id) on delete cascade,
  active boolean not null default true,
  scrape_interval_minutes integer not null default 120,
  last_scraped_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, option_id)
);

create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  price numeric not null,
  stock boolean not null,
  scraped_at timestamptz not null default now()
);
create index if not exists idx_price_history_tracked on price_history(tracked_product_id, scraped_at desc);

create table if not exists scrape_attempts (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  attempt_number integer not null,
  status text not null check (status in ('success','retried','failed')),
  strategy text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  price numeric,
  stock boolean,
  http_status integer,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_attempts_tracked on scrape_attempts(tracked_product_id, started_at desc);

create table if not exists scraper_events (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid references tracked_products(id) on delete cascade,
  event_type text not null,
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists scrape_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  trigger text
);
