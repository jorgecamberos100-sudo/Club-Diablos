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

-- ============ Cuentas, planes y ligas (etapa 1 del producto) ============
-- Una cuenta puede organizar equipos, ligas o ambos. Los planes y sus límites viven en la tabla
-- "plans": se cambian ahí (Table Editor de Supabase) sin tocar la app. Ningún precio está decidido.
-- La suscripción a la plataforma (subscriptions) está separada de las finanzas internas (payments).

create table if not exists public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  roles text[] not null default '{}' check (roles <@ array['team','league']::text[]),
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id text primary key,
  audience text not null check (audience in ('team','league')),
  name text not null,
  tier smallint not null default 0,                 -- 0 = gratis; el mayor gana si hay varias suscripciones
  features text[] not null default '{}',            -- funciones habilitadas (ver app/plans.js)
  limits jsonb not null default '{}',               -- ej. {"teams": 1, "players": 30}; null = sin límite
  price_monthly numeric(10,2), price_annual numeric(10,2),  -- vacíos hasta decidir precios
  is_default boolean not null default false,        -- plan que recibe quien no tiene suscripción
  active boolean not null default true
);
insert into public.plans (id, audience, name, tier, features, limits, is_default) values
  ('team-free', 'team', 'Equipo Gratis', 0,
     array['roster','attendance','matches','lineup'], '{"teams": 1, "players": 30}', true),
  ('team-pro', 'team', 'Equipo Pro', 1,
     array['roster','attendance','matches','lineup','ratings','finance','receipts','stats','themes','share_capture'], '{"teams": 5, "players": null}', false),
  ('league-base', 'league', 'Liga', 1,
     array['league_panel','tournaments','schedule','standings','sanctions','league_finance','registration','credentials','public_page','team_pro_grant'], '{"tournaments": null, "admins": 5, "pro_teams_included": 0}', true)
on conflict (id) do nothing;

-- subject: 'team' -> 'club/equipo'; 'league' -> id de la liga. source 'league' = Pro pagado por la liga.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('team','league')),
  subject_id text not null,
  plan_id text not null references public.plans(id),
  period text check (period in ('monthly','annual')),
  source text not null default 'direct' check (source in ('direct','league','manual','trial')),
  granted_by text,                                  -- liga que lo otorga cuando source = 'league'
  status text not null default 'active' check (status in ('active','past_due','canceled')),
  starts_at timestamptz not null default now(), ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists subs_subject on public.subscriptions (subject_type, subject_id, status);

create table if not exists public.leagues (
  id text primary key,
  name text not null check (length(trim(name)) between 2 and 80),
  owner uuid not null references auth.users(id),
  settings jsonb not null default '{}',             -- reglamento, precios, conceptos de cobro, marca…
  created_at timestamptz not null default now()
);

-- Administradores de la liga. owner = superadministrador; perms '*' = todo.
create table if not exists public.league_admins (
  league_id text not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin')),
  perms text[] not null default '{}',
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create or replace function public.is_league_admin(l text, perm text default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from league_admins where league_id = l and user_id = auth.uid() and status = 'active'
    and (role = 'owner' or perm is null or '*' = any (perms) or perm = any (perms))) $$;

-- Elegir qué organiza la cuenta (se puede tener ambos).
create or replace function public.set_roles(r text[]) returns text[]
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  insert into accounts (user_id, roles) values (auth.uid(), coalesce(r, '{}'))
  on conflict (user_id) do update set roles = excluded.roles;
  return r;
end $$;

-- Crear liga: queda como superadministrador quien la crea.
create or replace function public.create_league(nm text) returns text
language plpgsql security definer set search_path = public as $$
declare base text; lid text; n int := 1;
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  if nm is null or length(trim(nm)) < 2 then raise exception 'Escribe el nombre de la liga'; end if;
  base := trim(both '-' from regexp_replace(lower(translate(trim(nm), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g'));
  if base in ('', 'cuenta', 'liga') then base := 'liga'; end if;
  lid := left(base, 40);
  while exists (select 1 from leagues where id = lid) loop n := n + 1; lid := left(base, 36) || '-' || n; end loop;
  insert into leagues (id, name, owner) values (lid, left(trim(nm), 80), auth.uid());
  insert into league_admins (league_id, user_id, role, perms) values (lid, auth.uid(), 'owner', array['*']);
  insert into accounts (user_id, roles) values (auth.uid(), array['league'])
  on conflict (user_id) do update set roles = (select array(select distinct unnest(accounts.roles || array['league'])));
  return lid;
end $$;

-- Equipos que administro y ligas donde soy administrador.
create or replace function public.my_teams() returns table (club_id text, team_id text)
language sql stable security definer set search_path = public as $$
  select club_id, team_id from members where user_id = auth.uid() and status = 'approved' and role = 'admin' order by created_at $$;

create or replace function public.my_leagues() returns table (id text, name text, role text)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, a.role from leagues l join league_admins a on a.league_id = l.id
  where a.user_id = auth.uid() and a.status = 'active' order by l.created_at $$;

-- Plan vigente de un equipo o liga (el de mayor nivel entre sus suscripciones activas, o el gratuito).
create or replace function public.entitlement(st text, sid text) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(p) || jsonb_build_object('source', coalesce(s.source, 'default'), 'period', s.period, 'ends_at', s.ends_at)
  from plans p left join lateral (
    select * from subscriptions x where x.subject_type = st and x.subject_id = sid and x.plan_id = p.id
      and x.status = 'active' and (x.ends_at is null or x.ends_at > now()) limit 1) s on true
  where p.audience = st and p.active and (s.id is not null or p.is_default)
  order by (s.id is not null) desc, p.tier desc limit 1 $$;

alter table public.accounts enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.leagues enable row level security;
alter table public.league_admins enable row level security;

drop policy if exists acc_own on public.accounts;
create policy acc_own on public.accounts for select using (user_id = auth.uid());
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select using (active);
drop policy if exists subs_read on public.subscriptions;
create policy subs_read on public.subscriptions for select using (
  (subject_type = 'league' and is_league_admin(subject_id))
  or (subject_type = 'team' and is_admin(split_part(subject_id, '/', 1), split_part(subject_id, '/', 2))));
drop policy if exists leagues_read on public.leagues;
create policy leagues_read on public.leagues for select using (is_league_admin(id));
drop policy if exists leagues_edit on public.leagues;
create policy leagues_edit on public.leagues for update using (is_league_admin(id, 'settings')) with check (is_league_admin(id, 'settings'));
drop policy if exists ladm_read on public.league_admins;
create policy ladm_read on public.league_admins for select using (user_id = auth.uid() or is_league_admin(league_id, 'admins'));

-- Altas solo por funciones; suscripciones solo desde el servidor (nadie se da Pro solo).
grant select on public.accounts, public.subscriptions, public.leagues, public.league_admins to authenticated;
grant update (name, settings) on public.leagues to authenticated;
grant select on public.plans to anon, authenticated;
grant execute on function public.set_roles(text[]), public.create_league(text), public.my_teams(), public.my_leagues(),
  public.entitlement(text,text), public.is_league_admin(text,text) to authenticated;

-- ============ Equipos en la base de datos (etapa 2) ============
-- Los equipos que se crean en la app viven aquí, con la MISMA forma que los archivos de data/clubs.
-- La app lee primero los archivos (Diablos y el club de ejemplo) y, si no existe, la base.
create table if not exists public.club_docs (
  id text primary key,
  owner uuid not null references auth.users(id),
  club jsonb not null,                              -- como club.json
  players jsonb not null default '[]',              -- como players.json
  created_at timestamptz not null default now()
);
create table if not exists public.team_docs (
  club_id text not null references public.club_docs(id) on delete cascade,
  team_id text not null,
  data jsonb not null,                              -- como teams/<equipo>.json
  primary key (club_id, team_id)
);
alter table public.club_docs enable row level security;
alter table public.team_docs enable row level security;
drop policy if exists club_docs_read on public.club_docs;
create policy club_docs_read on public.club_docs for select using (true);
drop policy if exists team_docs_read on public.team_docs;
create policy team_docs_read on public.team_docs for select using (true);
grant select on public.club_docs, public.team_docs to anon, authenticated;   -- escribir solo por funciones

create or replace function public.slugify(s text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(translate(trim(s), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g')) $$;

-- Cuántos equipos puede administrar esta cuenta: el mayor límite "teams" entre sus planes (sin dato = sin límite).
create or replace function public.team_cap() returns int
language sql stable security definer set search_path = public as $$
  select greatest(
    coalesce((select (limits->>'teams')::int from plans where id = 'team-free'), 1),
    coalesce((select max(coalesce((entitlement('team', m.club_id || '/' || m.team_id)->'limits'->>'teams')::int, 1000000))
              from members m where m.user_id = auth.uid() and m.status = 'approved' and m.role = 'admin'), 0)) $$;

-- Crear equipo: queda como administrador quien lo crea. fmt = jugadores por lado (hoy 7 u 11).
create or replace function public.create_team(nm text, fmt int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare base text; cid text; n int := 1; who text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  if nm is null or length(trim(nm)) < 2 then raise exception 'Escribe el nombre del equipo'; end if;
  if fmt not in (7, 11) then raise exception 'Elige el formato del equipo'; end if;
  if (select count(*) from members where user_id = auth.uid() and status = 'approved' and role = 'admin') >= team_cap()
    then raise exception 'Ya tienes el máximo de equipos de tu plan'; end if;
  base := slugify(nm);
  if base in ('', 'cuenta', 'liga', 'diablos', 'ejemplo') then base := 'equipo'; end if;
  cid := left(base, 40);
  while exists (select 1 from club_docs where id = cid) or cid in ('cuenta', 'liga', 'diablos', 'ejemplo') loop n := n + 1; cid := left(base, 36) || '-' || n; end loop;
  insert into club_docs (id, owner, club) values (cid, auth.uid(), jsonb_build_object(
    'id', cid, 'name', left(trim(nm), 60), 'shortName', left(trim(nm), 24), 'crest', '', 'contact', 'el administrador',
    'teams', jsonb_build_array(jsonb_build_object('id', 'principal', 'name', 'Principal')),
    'theme', jsonb_build_object('colors', jsonb_build_object('bg', '#0e1110', 'panel', '#151a18', 'raise', '#1c2321', 'line', '#2a3330',
      'text', '#ffffff', 'muted', '#a0aaa6', 'primary', '#1f9d61', 'primarySoft', '#3fd18a', 'onPrimary', '#ffffff'), 'card', 'escudo', 'pattern', 'franjas')));
  insert into team_docs (club_id, team_id, data) values (cid, 'principal', jsonb_build_object(
    'id', 'principal', 'name', 'Principal', 'competition', '', 'format', fmt, 'roster', '[]'::jsonb, 'matches', '[]'::jsonb, 'evaluations', '[]'::jsonb, 'lineups', '[]'::jsonb));
  select coalesce(nullif(split_part(email, '@', 1), ''), 'Administrador') into who from auth.users where id = auth.uid();
  insert into members (club_id, team_id, user_id, display_name, role, status) values (cid, 'principal', auth.uid(), left(who, 60), 'admin', 'approved');
  return jsonb_build_object('club', cid, 'team', 'principal');
end $$;

-- Agregar un jugador al plantel (sin que tenga cuenta). Respeta el límite "players" del plan del equipo.
create or replace function public.add_player(c text, t text, nm text, num text, pos text) returns text
language plpgsql security definer set search_path = public as $$
declare pid text; lim int; cnt int;
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if nm is null or length(trim(nm)) < 2 then raise exception 'Escribe el nombre del jugador'; end if;
  if pos is not null and pos <> '' and pos not in ('POR','LAT','DFC','MCD','MCO','EXT','DC') then raise exception 'Posición no válida'; end if;
  select jsonb_array_length(data->'roster') into cnt from team_docs where club_id = c and team_id = t;
  if cnt is null then raise exception 'Este equipo se administra desde archivos'; end if;
  lim := (entitlement('team', c || '/' || t)->'limits'->>'players')::int;
  if lim is not null and cnt >= lim then raise exception 'Tu plan llegó al límite de jugadores'; end if;
  select 'p' || (jsonb_array_length(players) + 1) into pid from club_docs where id = c;
  update club_docs set players = players || jsonb_build_array(jsonb_build_object('id', pid, 'name', left(trim(nm), 40),
    'positions', case when coalesce(pos, '') = '' then '[]'::jsonb else jsonb_build_array(pos) end, 'photo', null, 'attrs', null)) where id = c;
  update team_docs set data = jsonb_set(data, '{roster}', (data->'roster') || jsonb_build_array(jsonb_build_object('player', pid, 'number', left(coalesce(num, ''), 3))))
    where club_id = c and team_id = t;
  return pid;
end $$;

grant execute on function public.create_team(text,int), public.add_player(text,text,text,text,text), public.team_cap() to authenticated;

-- ============ Etapa 3 del producto: invitaciones, vinculación y Pro por contrato de liga ============
-- Importante: en Supabase las tablas nuevas de "public" nacen con permisos amplios; por eso TODAS llevan RLS
-- y solo las funciones de abajo (security definer) escriben. Los contratos los administra la plataforma
-- (SQL Editor / servidor), nunca la app: nadie puede darse cupos de Pro.

-- Bitácora de acciones administrativas (se llena solo por log_action; nadie la edita ni la borra desde la app).
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  league_id text references public.leagues(id) on delete cascade,
  actor uuid references auth.users(id) on delete set null,
  action text not null, detail jsonb not null default '{}',
  at timestamptz not null default now()
);
create index if not exists audit_league on public.audit_log (league_id, at desc);
alter table public.audit_log enable row level security;
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select using (is_league_admin(league_id, 'audit'));
grant select on public.audit_log to authenticated;

create or replace function public.log_action(l text, a text, d jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into audit_log (league_id, actor, action, detail) values (l, auth.uid(), a, coalesce(d, '{}')) $$;
revoke all on function public.log_action(text,text,jsonb) from public, anon, authenticated;

-- Contrato de la liga con la plataforma: cuántos equipos con Pro incluye y hasta cuándo. Sin precios aquí.
create table if not exists public.league_contracts (
  league_id text primary key references public.leagues(id) on delete cascade,
  pro_slots int not null default 0 check (pro_slots >= 0),
  pro_plan text not null default 'team-pro' references public.plans(id),
  status text not null default 'active' check (status in ('active','paused','canceled')),
  starts_at timestamptz not null default now(), ends_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.league_contracts enable row level security;
drop policy if exists contracts_read on public.league_contracts;
create policy contracts_read on public.league_contracts for select using (is_league_admin(league_id));
grant select on public.league_contracts to authenticated;

-- Códigos de invitación. El código es largo y aleatorio (48 bits); además hay límite de intentos fallidos.
create table if not exists public.league_invites (
  code text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  label text, max_uses int check (max_uses is null or max_uses > 0), uses int not null default 0,
  expires_at timestamptz, active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.league_invites enable row level security;
drop policy if exists invites_read on public.league_invites;
create policy invites_read on public.league_invites for select using (is_league_admin(league_id, 'teams'));
grant select on public.league_invites to authenticated;

create table if not exists public.invite_attempts (
  user_id uuid not null, at timestamptz not null default now()
);
create index if not exists invite_attempts_user on public.invite_attempts (user_id, at desc);
alter table public.invite_attempts enable row level security;   -- sin políticas: solo las funciones la usan

-- Equipos vinculados a una liga. La historia se conserva (removed / left / rejected), nunca se borra.
create table if not exists public.league_teams (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  club_id text not null, team_id text not null, team_name text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','removed','left')),
  pro boolean not null default false,
  invite_code text, requested_by uuid references auth.users(id), requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id), decided_at timestamptz
);
create unique index if not exists league_teams_open on public.league_teams (league_id, club_id, team_id) where status in ('pending','approved');
create index if not exists league_teams_team on public.league_teams (club_id, team_id);
alter table public.league_teams enable row level security;
drop policy if exists lteams_read on public.league_teams;
create policy lteams_read on public.league_teams for select using (is_league_admin(league_id, 'teams') or is_admin(club_id, team_id));
grant select on public.league_teams to authenticated;

-- Equipos que hoy reciben Pro de su liga: aprobados, con Pro, contrato vigente y dentro del cupo
-- (si el cupo baja, conservan Pro los más antiguos). Interna: no la puede llamar la app.
create or replace function public.league_pro_teams(l text default null)
returns table (league_id text, club_id text, team_id text)
language sql stable security definer set search_path = public as $$
  select r.league_id, r.club_id, r.team_id from (
    select lt.*, row_number() over (partition by lt.league_id order by lt.decided_at, lt.id) rn
    from league_teams lt where lt.status = 'approved' and lt.pro and (l is null or lt.league_id = l)) r
  join league_contracts c on c.league_id = r.league_id
  where c.status = 'active' and (c.ends_at is null or c.ends_at > now()) and c.starts_at <= now() and r.rn <= c.pro_slots $$;
revoke all on function public.league_pro_teams(text) from public, anon, authenticated;

-- El plan vigente de un equipo o liga: el de mayor nivel entre suscripción propia, Pro de liga y el plan gratuito.
-- A igualdad de nivel gana la suscripción propia, así el Pro propio se conserva si la liga lo retira.
create or replace function public.entitlement(st text, sid text) returns jsonb
language sql stable security definer set search_path = public as $$
  with cands as (
    select x.plan_id, x.source, x.period, x.ends_at, null::text as league_id, 0 as pri
    from subscriptions x where x.subject_type = st and x.subject_id = sid and x.status = 'active' and (x.ends_at is null or x.ends_at > now())
    union all
    select c.pro_plan, 'league', null, c.ends_at, p.league_id, 1
    from league_pro_teams() p join league_contracts c on c.league_id = p.league_id
    where st = 'team' and p.club_id || '/' || p.team_id = sid)
  select to_jsonb(p) || jsonb_build_object('source', coalesce(s.source, 'default'), 'period', s.period, 'ends_at', s.ends_at, 'league_id', s.league_id)
  from plans p left join cands s on s.plan_id = p.id
  where p.audience = st and p.active and (s.plan_id is not null or p.is_default)
  order by (s.plan_id is not null) desc, p.tier desc, s.pri asc limit 1 $$;

-- ---- Operaciones de la liga ----
create or replace function public.create_invite(l text, lbl text, max_uses int default null, days int default null) returns text
language plpgsql security definer set search_path = public as $$
declare raw text; code text;
begin
  if not is_league_admin(l, 'teams') then raise exception 'Sin permiso'; end if;
  if max_uses is not null and max_uses < 1 then raise exception 'Datos no válidos'; end if;
  raw := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 12));
  code := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
  insert into league_invites (code, league_id, label, max_uses, expires_at, created_by)
  values (code, l, nullif(left(trim(coalesce(lbl, '')), 60), ''), max_uses, case when days is null then null else now() + make_interval(days => days) end, auth.uid());
  perform log_action(l, 'invite.create', jsonb_build_object('code', code, 'max_uses', max_uses));
  return code;
end $$;

create or replace function public.revoke_invite(l text, c text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_league_admin(l, 'teams') then raise exception 'Sin permiso'; end if;
  update league_invites set active = false where league_id = l and code = c;
  perform log_action(l, 'invite.revoke', jsonb_build_object('code', c));
end $$;

-- El delegado pide vincular su equipo con un código. Un código malo devuelve {error} (sin excepción)
-- para que el intento quede contado; tras 8 fallos en una hora se bloquea un rato.
create or replace function public.request_link(p_code text, c text, t text, nm text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv league_invites; tname text; cid text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if (select count(*) from invite_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 8 then
    return jsonb_build_object('error', 'throttled');
  end if;
  select * into inv from league_invites i
   where i.code = substr(cid, 1, 4) || '-' || substr(cid, 5, 4) || '-' || substr(cid, 9, 4) and i.active
     and (i.expires_at is null or i.expires_at > now()) and (i.max_uses is null or i.uses < i.max_uses);
  if inv.code is null then
    insert into invite_attempts (user_id) values (auth.uid());
    return jsonb_build_object('error', 'invalid');
  end if;
  if exists (select 1 from league_teams where league_id = inv.league_id and club_id = c and team_id = t and status in ('pending','approved')) then
    return jsonb_build_object('error', 'duplicate');
  end if;
  select club->>'name' into tname from club_docs where id = c;
  tname := coalesce(tname, nullif(left(trim(coalesce(nm, '')), 60), ''), c);
  insert into league_teams (league_id, club_id, team_id, team_name, invite_code, requested_by) values (inv.league_id, c, t, tname, inv.code, auth.uid());
  update league_invites set uses = uses + 1 where code = inv.code;
  return jsonb_build_object('ok', true, 'league', (select name from leagues where id = inv.league_id));
end $$;

-- La liga aprueba o rechaza. Al aprobar recibe Pro solo si hay cupo en un contrato vigente.
create or replace function public.decide_link(l text, lt uuid, approve boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r league_teams; c league_contracts; v_pro boolean := false;
begin
  if not is_league_admin(l, 'teams') then raise exception 'Sin permiso'; end if;
  select * into r from league_teams where id = lt and league_id = l and status = 'pending' for update;
  if r.id is null then raise exception 'La solicitud ya no está pendiente'; end if;
  if approve then
    select * into c from league_contracts where league_id = l;
    v_pro := c.league_id is not null and c.status = 'active' and (c.ends_at is null or c.ends_at > now()) and c.starts_at <= now()
           and (select count(*) from league_teams x where x.league_id = l and x.status = 'approved' and x.pro) < c.pro_slots;
  end if;
  update league_teams set status = case when approve then 'approved' else 'rejected' end, pro = v_pro and approve, decided_by = auth.uid(), decided_at = now() where id = lt;
  perform log_action(l, case when approve then 'team.approve' else 'team.reject' end, jsonb_build_object('team', r.club_id || '/' || r.team_id, 'pro', v_pro and approve));
  return jsonb_build_object('ok', true, 'pro', v_pro and approve);
end $$;

-- Asignar o quitar el Pro de un equipo ya vinculado, dentro del cupo.
create or replace function public.set_team_pro(l text, lt uuid, want boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c league_contracts; r league_teams;
begin
  if not is_league_admin(l, 'teams') then raise exception 'Sin permiso'; end if;
  select * into r from league_teams where id = lt and league_id = l and status = 'approved' for update;
  if r.id is null then raise exception 'Equipo no vinculado'; end if;
  if want and not r.pro then
    select * into c from league_contracts where league_id = l;
    if c.league_id is null or c.status <> 'active' or (c.ends_at is not null and c.ends_at <= now()) then raise exception 'La liga no tiene un contrato vigente'; end if;
    if (select count(*) from league_teams x where x.league_id = l and x.status = 'approved' and x.pro) >= c.pro_slots then raise exception 'No quedan espacios de Pro en tu contrato'; end if;
  end if;
  update league_teams set pro = want where id = lt;
  perform log_action(l, 'team.pro', jsonb_build_object('team', r.club_id || '/' || r.team_id, 'pro', want));
end $$;

-- Desvincular (la liga o el delegado). Solo se retira el beneficio que venía de la liga; todo lo demás se conserva.
create or replace function public.unlink_team(lt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r league_teams; by_league boolean;
begin
  select * into r from league_teams where id = lt and status in ('pending','approved') for update;
  if r.id is null then raise exception 'La vinculación ya no está activa'; end if;
  by_league := is_league_admin(r.league_id, 'teams');
  if not by_league and not is_admin(r.club_id, r.team_id) then raise exception 'Sin permiso'; end if;
  update league_teams set status = case when by_league then 'removed' else 'left' end, decided_by = auth.uid(), decided_at = now() where id = lt;
  perform log_action(r.league_id, 'team.unlink', jsonb_build_object('team', r.club_id || '/' || r.team_id, 'by', case when by_league then 'league' else 'team' end));
end $$;

-- Contrato y cupo de una liga (solo sus administradores).
create or replace function public.league_contract(l text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not is_league_admin(l) then null else coalesce(
    (select jsonb_build_object('pro_slots', c.pro_slots, 'status', c.status, 'ends_at', c.ends_at,
       'valid', c.status = 'active' and (c.ends_at is null or c.ends_at > now()) and c.starts_at <= now(),
       'used', (select count(*) from league_teams x where x.league_id = l and x.status = 'approved' and x.pro)) from league_contracts c where c.league_id = l),
    jsonb_build_object('pro_slots', 0, 'status', 'none', 'valid', false, 'used', 0)) end $$;

-- Vínculos de un equipo, para su delegado.
create or replace function public.team_links(c text, t text)
returns table (id uuid, league_id text, league_name text, status text, pro boolean, requested_at timestamptz)
language sql stable security definer set search_path = public as $$
  select x.id, x.league_id, (select name from leagues where id = x.league_id), x.status, x.pro, x.requested_at
  from league_teams x where x.club_id = c and x.team_id = t and is_admin(c, t) order by x.requested_at desc $$;

grant execute on function public.create_invite(text,text,int,int), public.revoke_invite(text,text), public.request_link(text,text,text,text),
  public.decide_link(text,uuid,boolean), public.set_team_pro(text,uuid,boolean), public.unlink_team(uuid),
  public.league_contract(text), public.team_links(text,text) to authenticated;
