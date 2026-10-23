-- Imitación mínima de Supabase: auth.users, auth.uid(), storage y roles.
create role anon; create role authenticated;
create schema auth; create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id serial, bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n, '/') $$;
grant usage on schema auth, storage to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
