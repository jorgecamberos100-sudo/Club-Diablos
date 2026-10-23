-- Base de datos de la app. Se pega UNA vez en Supabase: SQL Editor > New query > Run.
-- Se puede volver a correr sin riesgo (usa "if not exists" / "or replace").

-- ============ Tablas ============
create table if not exists public.members (
  club_id text not null, team_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id text, display_name text not null,
  role text not null default 'player' check (role in ('admin','player')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  primary key (club_id, team_id, user_id)
);
-- un nombre del plantel solo lo puede reclamar una cuenta
create unique index if not exists members_one_claim on public.members (club_id, team_id, player_id)
  where player_id is not null and status <> 'rejected';

create table if not exists public.profiles (
  club_id text not null, player_id text not null,
  photo_url text, positions text[], updated_at timestamptz not null default now(),
  primary key (club_id, player_id)
);

create table if not exists public.availability (
  club_id text not null, team_id text not null, match_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id text not null, answer text not null check (answer in ('va','no','duda')),
  updated_at timestamptz not null default now(),
  primary key (club_id, team_id, match_id, user_id)
);

create table if not exists public.results (
  club_id text not null, team_id text not null, match_id text not null,
  score_for smallint not null check (score_for >= 0), score_against smallint not null check (score_against >= 0),
  played text[] not null default '{}', stats jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (club_id, team_id, match_id)
);

create table if not exists public.attr_votes (
  club_id text not null, team_id text not null,
  voter uuid not null references auth.users(id) on delete cascade, target text not null,
  vel smallint not null check (vel between 1 and 10), tir smallint not null check (tir between 1 and 10),
  pas smallint not null check (pas between 1 and 10), reg smallint not null check (reg between 1 and 10),
  def smallint not null check (def between 1 and 10), fis smallint not null check (fis between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (club_id, team_id, voter, target)
);

create table if not exists public.match_votes (
  club_id text not null, team_id text not null, match_id text not null,
  voter uuid not null references auth.users(id) on delete cascade, target text not null,
  score smallint not null check (score between 1 and 10),
  primary key (club_id, team_id, match_id, voter, target)
);

create table if not exists public.mvp_votes (
  club_id text not null, team_id text not null, match_id text not null,
  voter uuid not null references auth.users(id) on delete cascade, target text not null,
  primary key (club_id, team_id, match_id, voter)
);

-- ============ Ayudas de permisos ============
create or replace function public.is_member(c text, t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where club_id = c and team_id = t and user_id = auth.uid() and status = 'approved') $$;

create or replace function public.is_admin(c text, t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where club_id = c and team_id = t and user_id = auth.uid() and status = 'approved' and role = 'admin') $$;

create or replace function public.my_player(c text, t text) returns text
language sql stable security definer set search_path = public as $$
  select player_id from members where club_id = c and team_id = t and user_id = auth.uid() and status = 'approved' $$;

-- ============ Funciones que usa la app ============
-- Pedir entrada a un equipo. La primera cuenta de un equipo sin administrador queda como administrador.
create or replace function public.join_team(c text, t text, pid text, nm text) returns text
language plpgsql security definer set search_path = public as $$
declare has_admin boolean; r text; s text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  if nm is null or length(trim(nm)) < 2 then raise exception 'Escribe tu nombre'; end if;
  select exists (select 1 from members where club_id = c and team_id = t and role = 'admin' and status = 'approved') into has_admin;
  r := case when has_admin then 'player' else 'admin' end;
  s := case when has_admin then 'pending' else 'approved' end;
  insert into members (club_id, team_id, user_id, player_id, display_name, role, status)
  values (c, t, auth.uid(), nullif(pid, ''), left(trim(nm), 60), r, s)
  on conflict (club_id, team_id, user_id) do update
    set player_id = excluded.player_id, display_name = excluded.display_name
    where members.status = 'pending';
  select status into s from members where club_id = c and team_id = t and user_id = auth.uid();
  return s;
end $$;

-- Nombres del plantel que ya tienen dueño (para no mostrarlos al elegir).
create or replace function public.claimed(c text, t text) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(player_id), '{}') from members
  where club_id = c and team_id = t and player_id is not null and status <> 'rejected' $$;

-- Votos del equipo sin decir quién votó (cada votante aparece con un código que no se puede rastrear).
create or replace function public.team_votes(c text, t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_member(c, t) then return jsonb_build_object('attr','[]'::jsonb,'rating','[]'::jsonb,'mvp','[]'::jsonb); end if;
  return jsonb_build_object(
    'attr', coalesce((select jsonb_agg(jsonb_build_object('voter', left(md5(voter::text || c || t), 8), 'target', target, 'vel', vel, 'tir', tir, 'pas', pas, 'reg', reg, 'def', def, 'fis', fis)) from attr_votes where club_id = c and team_id = t), '[]'),
    'rating', coalesce((select jsonb_agg(jsonb_build_object('match', match_id, 'voter', left(md5(voter::text || c || t), 8), 'target', target, 'score', score)) from match_votes where club_id = c and team_id = t), '[]'),
    'mvp', coalesce((select jsonb_agg(jsonb_build_object('match', match_id, 'voter', left(md5(voter::text || c || t), 8), 'target', target)) from mvp_votes where club_id = c and team_id = t), '[]'));
end $$;

-- Disponibilidad con nombres (solo miembros aprobados).
create or replace function public.team_availability(c text, t text) returns setof public.availability
language sql stable security definer set search_path = public as $$
  select * from availability where club_id = c and team_id = t and is_member(c, t) $$;

-- ============ Permisos por fila (RLS) ============
alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.availability enable row level security;
alter table public.results enable row level security;
alter table public.attr_votes enable row level security;
alter table public.match_votes enable row level security;
alter table public.mvp_votes enable row level security;

-- members: cada quien ve la suya; el admin ve y decide las de su equipo
drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (user_id = auth.uid() or is_admin(club_id, team_id));
drop policy if exists members_decide on public.members;
create policy members_decide on public.members for update using (is_admin(club_id, team_id)) with check (is_admin(club_id, team_id));

-- profiles: lectura pública; cada jugador edita el suyo; el admin edita los de su club
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for all
  using (exists (select 1 from members m where m.club_id = profiles.club_id and m.user_id = auth.uid() and m.status = 'approved' and (m.player_id = profiles.player_id or m.role = 'admin')))
  with check (exists (select 1 from members m where m.club_id = profiles.club_id and m.user_id = auth.uid() and m.status = 'approved' and (m.player_id = profiles.player_id or m.role = 'admin')));

-- availability: cada miembro escribe y lee solo la suya (la lista completa sale por team_availability)
drop policy if exists avail_own on public.availability;
create policy avail_own on public.availability for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(club_id, team_id) and player_id = my_player(club_id, team_id));

-- results: lectura pública; solo el admin escribe
drop policy if exists results_read on public.results;
create policy results_read on public.results for select using (true);
drop policy if exists results_write on public.results;
create policy results_write on public.results for all using (is_admin(club_id, team_id)) with check (is_admin(club_id, team_id));

-- votos: cada quien ve y escribe solo los suyos, nunca a sí mismo
drop policy if exists attr_own on public.attr_votes;
create policy attr_own on public.attr_votes for all using (voter = auth.uid())
  with check (voter = auth.uid() and is_member(club_id, team_id) and target <> coalesce(my_player(club_id, team_id), ''));

drop policy if exists mv_own on public.match_votes;
create policy mv_own on public.match_votes for all using (voter = auth.uid())
  with check (voter = auth.uid() and is_member(club_id, team_id) and target <> coalesce(my_player(club_id, team_id), '')
    and exists (select 1 from results r where r.club_id = match_votes.club_id and r.team_id = match_votes.team_id and r.match_id = match_votes.match_id
                and my_player(club_id, team_id) = any (r.played) and target = any (r.played)));

drop policy if exists mvp_own on public.mvp_votes;
create policy mvp_own on public.mvp_votes for all using (voter = auth.uid())
  with check (voter = auth.uid() and is_member(club_id, team_id) and target <> coalesce(my_player(club_id, team_id), '')
    and exists (select 1 from results r where r.club_id = mvp_votes.club_id and r.team_id = mvp_votes.team_id and r.match_id = mvp_votes.match_id
                and my_player(club_id, team_id) = any (r.played) and target = any (r.played)));

-- ============ Fotos ============
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select using (bucket_id = 'photos');
drop policy if exists photos_write on storage.objects;
create policy photos_write on storage.objects for insert with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects for update using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ Permisos de acceso ============
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.results to anon, authenticated;
grant select, insert, update, delete on public.members, public.profiles, public.availability, public.results,
  public.attr_votes, public.match_votes, public.mvp_votes to authenticated;
revoke insert, delete on public.members from authenticated;   -- entrar solo por join_team
revoke insert, update, delete on public.profiles, public.results from anon;
grant execute on function public.join_team(text,text,text,text), public.claimed(text,text),
  public.team_votes(text,text), public.team_availability(text,text) to authenticated;
grant execute on function public.claimed(text,text) to anon;

-- ============ Pagos ============
-- El jugador reporta su pago con comprobante (queda pendiente); el administrador lo aprueba con un toque.
-- El administrador también registra pagos en efectivo, uniformes y lo que se paga a la liga (kind = 'salida').
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  club_id text not null, team_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id text,
  kind text not null check (kind in ('cuota','uniforme','salida')),
  item text,
  amount numeric(10,2) not null check (amount > 0 and amount <= 50000),
  detail text check (detail is null or length(detail) <= 120),
  receipt text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists payments_team on public.payments (club_id, team_id, status);

-- Pagos aprobados, sin comprobantes ni cuentas (para que cualquiera vea las cuentas del equipo).
create or replace function public.team_paid(c text, t text)
returns table (kind text, item text, player_id text, amount numeric, detail text, decided_at timestamptz)
language sql stable security definer set search_path = public as $$
  select kind, item, player_id, amount, detail, decided_at from payments
  where club_id = c and team_id = t and status = 'approved' order by decided_at $$;

alter table public.payments enable row level security;
drop policy if exists pay_read on public.payments;
create policy pay_read on public.payments for select using (user_id = auth.uid() or is_admin(club_id, team_id));
drop policy if exists pay_insert on public.payments;
create policy pay_insert on public.payments for insert with check (
  user_id = auth.uid() and (
    is_admin(club_id, team_id)
    or (status = 'pending' and decided_at is null and kind in ('cuota','uniforme')
        and is_member(club_id, team_id) and player_id = my_player(club_id, team_id))));
drop policy if exists pay_decide on public.payments;
create policy pay_decide on public.payments for update using (is_admin(club_id, team_id)) with check (is_admin(club_id, team_id));

grant select, insert, update on public.payments to authenticated;
grant execute on function public.team_paid(text,text) to anon, authenticated;

-- Comprobantes: privados. Ruta club/equipo/usuario/archivo. Los ve quien lo subió y el administrador.
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
drop policy if exists receipts_write on storage.objects;
create policy receipts_write on storage.objects for insert with check (
  bucket_id = 'receipts' and (storage.foldername(name))[3] = auth.uid()::text
  and is_member((storage.foldername(name))[1], (storage.foldername(name))[2]));
drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select using (
  bucket_id = 'receipts' and ((storage.foldername(name))[3] = auth.uid()::text
  or is_admin((storage.foldername(name))[1], (storage.foldername(name))[2])));
