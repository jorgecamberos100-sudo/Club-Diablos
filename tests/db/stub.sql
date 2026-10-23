-- Imitación mínima de Supabase: auth.users, auth.uid(), storage y roles.
create role anon; create role authenticated;
create schema auth; create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id serial, bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n, '/') $$;
grant usage on schema auth, storage to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;

-- Como Supabase: lo que se crea después queda abierto por omisión a anon y authenticated (la seguridad debe venir de RLS y de revocar).
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
-- Como Supabase: el acceso a storage.objects lo deciden las políticas (RLS), no los permisos de tabla.
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant usage, select on sequence storage.objects_id_seq to anon, authenticated;
