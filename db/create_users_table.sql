-- Create a users table for the user-service
-- Run this in the Supabase SQL editor or via migrations

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  phone text,
  password_hash text,
  roles text[] default '{"user"}',
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Optional: create an index on email
create index if not exists idx_users_email on public.users (lower(email));
