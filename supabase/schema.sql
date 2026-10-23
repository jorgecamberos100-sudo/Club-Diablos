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
     array['league_panel','tournaments','schedule','standings','sanctions','league_finance','registration','credentials','public_page','actas','team_pro_grant'], '{"tournaments": null, "admins": 5, "pro_teams_included": 0}', true)
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
drop policy if exists leagues_edit on public.leagues;   -- ya no hay escritura directa: todo cambio pasa por funciones que validan (hallazgo de la revisión)
drop policy if exists ladm_read on public.league_admins;
create policy ladm_read on public.league_admins for select using (user_id = auth.uid() or is_league_admin(league_id, 'admins'));

-- Altas solo por funciones; suscripciones solo desde el servidor (nadie se da Pro solo).
grant select on public.accounts, public.subscriptions, public.leagues, public.league_admins to authenticated;
revoke update, insert, delete on public.leagues from authenticated, anon;
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
grant select on public.club_docs to anon, authenticated;   -- escribir solo por funciones
revoke select, insert, update, delete on public.team_docs from anon, authenticated;   -- el equipo se lee con team_doc(): las finanzas no son públicas por omisión

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
  perform log_action(l, 'invite.create', jsonb_build_object('code_end', right(code, 4), 'max_uses', max_uses));
  return code;
end $$;

create or replace function public.revoke_invite(l text, c text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_league_admin(l, 'teams') then raise exception 'Sin permiso'; end if;
  update league_invites set active = false where league_id = l and code = c;
  perform log_action(l, 'invite.revoke', jsonb_build_object('code_end', right(c, 4)));
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

-- ============ Etapa 4 del producto: gestión completa de equipos ============
-- Permiso por función según el plan del equipo. Los equipos de archivo (Diablos, ejemplo) no tienen restricción:
-- se conservan tal cual. Solo los equipos creados en la app (team_docs) respetan las funciones de su plan.
create or replace function public.has_feature(c text, t text, f text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from team_docs where club_id = c and team_id = t)
      or f = any (array(select jsonb_array_elements_text(entitlement('team', c || '/' || t)->'features'))) $$;

-- Funciones de Pro también en la base de datos: calificaciones y finanzas.
drop policy if exists attr_own on public.attr_votes;
create policy attr_own on public.attr_votes for all using (voter = auth.uid())
  with check (voter = auth.uid() and is_member(club_id, team_id) and has_feature(club_id, team_id, 'ratings') and target <> coalesce(my_player(club_id, team_id), ''));
drop policy if exists mv_own on public.match_votes;
create policy mv_own on public.match_votes for all using (voter = auth.uid())
  with check (voter = auth.uid() and is_member(club_id, team_id) and has_feature(club_id, team_id, 'ratings') and target <> coalesce(my_player(club_id, team_id), '')
    and exists (select 1 from results r where r.club_id = match_votes.club_id and r.team_id = match_votes.team_id and r.match_id = match_votes.match_id
                and my_player(club_id, team_id) = any (r.played) and target = any (r.played)));
drop policy if exists mvp_own on public.mvp_votes;
create policy mvp_own on public.mvp_votes for all using (voter = auth.uid())
  with check (voter = auth.uid() and is_member(club_id, team_id) and has_feature(club_id, team_id, 'ratings') and target <> coalesce(my_player(club_id, team_id), '')
    and exists (select 1 from results r where r.club_id = mvp_votes.club_id and r.team_id = mvp_votes.team_id and r.match_id = mvp_votes.match_id
                and my_player(club_id, team_id) = any (r.played) and target = any (r.played)));

-- Ingresos distintos de cuotas (patrocinio, venta de cosas…) y finanzas solo con la función del plan.
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('cuota','uniforme','salida','ingreso'));
drop policy if exists pay_insert on public.payments;
create policy pay_insert on public.payments for insert with check (
  user_id = auth.uid() and has_feature(club_id, team_id, 'finance') and (
    is_admin(club_id, team_id)
    or (status = 'pending' and decided_at is null and kind in ('cuota','uniforme')
        and is_member(club_id, team_id) and player_id = my_player(club_id, team_id))));

-- Formatos: fútbol 5, 6, 7, 8, 9 y 11.
create or replace function public.create_team(nm text, fmt int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare base text; cid text; n int := 1; who text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  if nm is null or length(trim(nm)) < 2 then raise exception 'Escribe el nombre del equipo'; end if;
  if fmt not in (5, 6, 7, 8, 9, 11) then raise exception 'Elige el formato del equipo'; end if;
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

-- Datos del equipo.
create or replace function public.update_team(c text, t text, nm text, comp text, fmt int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if nm is null or length(trim(nm)) < 2 then raise exception 'Escribe el nombre del equipo'; end if;
  if fmt not in (5, 6, 7, 8, 9, 11) then raise exception 'Elige el formato del equipo'; end if;
  if not exists (select 1 from team_docs where club_id = c and team_id = t) then raise exception 'Este equipo se administra desde archivos'; end if;
  update club_docs set club = club || jsonb_build_object('name', left(trim(nm), 60), 'shortName', left(trim(nm), 24)) where id = c;
  update team_docs set data = data || jsonb_build_object('competition', left(trim(coalesce(comp, '')), 80), 'format', fmt) where club_id = c and team_id = t;
end $$;

-- Escudo: la imagen se sube a la carpeta propia del usuario en el almacenamiento público; aquí solo se guarda su enlace.
create or replace function public.set_crest(c text, url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(c, t_of(c)) then raise exception 'Sin permiso'; end if;
  if url is null or url !~ ('^https://[^ ]+/storage/v1/object/public/photos/' || auth.uid()::text || '/[^ ]+$') then raise exception 'Datos no válidos'; end if;
  update club_docs set club = club || jsonb_build_object('crest', url) where id = c;
end $$;
create or replace function public.t_of(c text) returns text language sql stable security definer set search_path = public as $$
  select team_id from team_docs where club_id = c order by team_id limit 1 $$;
revoke all on function public.t_of(text) from public, anon, authenticated;

-- Colores y forma de las tarjetas (función Pro "themes").
create or replace function public.set_theme(c text, t text, colors jsonb, card text, pattern text) returns void
language plpgsql security definer set search_path = public as $$
declare k text; v text;
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if not has_feature(c, t, 'themes') then raise exception 'Tu plan no incluye esa función'; end if;
  if card not in ('escudo', 'redonda', 'recta') or pattern not in ('franjas', 'diagonal', 'liso') then raise exception 'Datos no válidos'; end if;
  for k, v in select key, value from jsonb_each_text(colors) loop
    if k not in ('bg','panel','raise','line','text','muted','primary','primarySoft','onPrimary') or v !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Datos no válidos'; end if;
  end loop;
  update club_docs set club = jsonb_set(club, '{theme}', coalesce(club->'theme', '{}') || jsonb_build_object('colors', coalesce(club->'theme'->'colors', '{}') || colors, 'card', card, 'pattern', pattern)) where id = c;
end $$;

-- Jugadores: editar datos y dar de baja/alta. Nunca se borran: su historial de partidos y cuentas se conserva.
create or replace function public.update_player(c text, t text, pid text, nm text, num text, pos text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if nm is null or length(trim(nm)) < 2 then raise exception 'Escribe el nombre del jugador'; end if;
  if coalesce(pos, '') <> '' and pos not in ('POR','LAT','DFC','MCD','MCO','EXT','DC') then raise exception 'Posición no válida'; end if;
  if not exists (select 1 from team_docs d, jsonb_array_elements(d.data->'roster') e where d.club_id = c and d.team_id = t and e->>'player' = pid) then raise exception 'Jugador no encontrado'; end if;
  update club_docs set players = (select coalesce(jsonb_agg(case when e->>'id' = pid then e || jsonb_build_object('name', left(trim(nm), 40),
      'positions', case when coalesce(pos, '') = '' then '[]'::jsonb else jsonb_build_array(pos) end) else e end order by ord), '[]')
    from jsonb_array_elements(players) with ordinality x(e, ord)) where id = c;
  update team_docs set data = jsonb_set(data, '{roster}', (select coalesce(jsonb_agg(case when e->>'player' = pid then e || jsonb_build_object('number', left(coalesce(num, ''), 3)) else e end order by ord), '[]')
    from jsonb_array_elements(data->'roster') with ordinality x(e, ord))) where club_id = c and team_id = t;
end $$;

create or replace function public.set_player_status(c text, t text, pid text, st text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if st not in ('activo', 'congelado') then raise exception 'Datos no válidos'; end if;
  if not exists (select 1 from team_docs d, jsonb_array_elements(d.data->'roster') e where d.club_id = c and d.team_id = t and e->>'player' = pid) then raise exception 'Jugador no encontrado'; end if;
  update team_docs set data = jsonb_set(data, '{roster}', (select coalesce(jsonb_agg(case when e->>'player' = pid then
      case when st = 'activo' then e - 'status' else e || jsonb_build_object('status', 'congelado') end else e end order by ord), '[]')
    from jsonb_array_elements(data->'roster') with ordinality x(e, ord))) where club_id = c and team_id = t;
end $$;

-- add_player: cuenta solo a los jugadores activos para el límite del plan.
create or replace function public.add_player(c text, t text, nm text, num text, pos text) returns text
language plpgsql security definer set search_path = public as $$
declare pid text; lim int; cnt int;
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if nm is null or length(trim(nm)) < 2 then raise exception 'Escribe el nombre del jugador'; end if;
  if pos is not null and pos <> '' and pos not in ('POR','LAT','DFC','MCD','MCO','EXT','DC') then raise exception 'Posición no válida'; end if;
  select count(*) filter (where e->>'status' is distinct from 'congelado') into cnt from team_docs d, jsonb_array_elements(d.data->'roster') e where d.club_id = c and d.team_id = t;
  if not exists (select 1 from team_docs where club_id = c and team_id = t) then raise exception 'Este equipo se administra desde archivos'; end if;
  lim := (entitlement('team', c || '/' || t)->'limits'->>'players')::int;
  if lim is not null and cnt >= lim then raise exception 'Tu plan llegó al límite de jugadores'; end if;
  select 'p' || (jsonb_array_length(players) + 1) into pid from club_docs where id = c;
  update club_docs set players = players || jsonb_build_array(jsonb_build_object('id', pid, 'name', left(trim(nm), 40),
    'positions', case when coalesce(pos, '') = '' then '[]'::jsonb else jsonb_build_array(pos) end, 'photo', null, 'attrs', null)) where id = c;
  update team_docs set data = jsonb_set(data, '{roster}', (data->'roster') || jsonb_build_array(jsonb_build_object('player', pid, 'number', left(coalesce(num, ''), 3))))
    where club_id = c and team_id = t;
  return pid;
end $$;

-- Calendario: agregar o editar un partido (los resultados viven aparte, en "results").
create or replace function public.save_match(c text, t text, m jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare mid text := nullif(m->>'id', ''); ts timestamptz; item jsonb; rival text := left(trim(coalesce(m->>'rival', '')), 40);
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if not exists (select 1 from team_docs where club_id = c and team_id = t) then raise exception 'Este equipo se administra desde archivos'; end if;
  if rival = '' then raise exception 'Escribe el rival'; end if;
  begin ts := (m->>'date')::timestamptz; exception when others then raise exception 'Fecha no válida'; end;
  if ts is null then raise exception 'Fecha no válida'; end if;
  item := jsonb_build_object('jornada', left(trim(coalesce(m->>'jornada', '')), 20), 'date', m->>'date', 'rival', rival,
    'home', coalesce((m->>'home')::boolean, true), 'venue', left(trim(coalesce(m->>'venue', '')), 40));
  if mid is null then
    mid := 'm' || substr(md5(gen_random_uuid()::text), 1, 6);
    update team_docs set data = jsonb_set(data, '{matches}', coalesce(data->'matches', '[]') || jsonb_build_array(item || jsonb_build_object('id', mid))) where club_id = c and team_id = t;
  else
    if not exists (select 1 from team_docs d, jsonb_array_elements(d.data->'matches') e where d.club_id = c and d.team_id = t and e->>'id' = mid) then raise exception 'Partido no encontrado'; end if;
    update team_docs set data = jsonb_set(data, '{matches}', (select jsonb_agg(case when e->>'id' = mid then e || item else e end order by ord)
      from jsonb_array_elements(data->'matches') with ordinality x(e, ord))) where club_id = c and team_id = t;
  end if;
  return mid;
end $$;

-- Un partido con resultado no se borra (es historial); sin resultado sí se puede quitar del calendario.
create or replace function public.delete_match(c text, t text, mid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if exists (select 1 from results where club_id = c and team_id = t and match_id = mid) then raise exception 'Ese partido ya tiene resultado'; end if;
  update team_docs set data = jsonb_set(data, '{matches}', (select coalesce(jsonb_agg(e order by ord), '[]') from jsonb_array_elements(data->'matches') with ordinality x(e, ord) where e->>'id' <> mid))
    where club_id = c and team_id = t;
end $$;

-- Finanzas internas del equipo (registros administrativos, no pagos reales). Lo "pagado" no lo manda el cliente:
-- se calcula con los pagos aprobados. Solo con la función "finance" del plan.
create or replace function public.save_finance(c text, t text, fin jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cuota numeric; item jsonb; liga jsonb := '[]'; gastos jsonb := '[]'; cuentas jsonb := '[]'; orden jsonb := '[]'; multa jsonb := null;
        k text; lbl text; costo numeric; n int := 0; used text[] := '{}'; r jsonb; flags jsonb := coalesce(fin->'multas', '[]'); fl jsonb; mt numeric;
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if not exists (select 1 from team_docs where club_id = c and team_id = t) then raise exception 'Este equipo se administra desde archivos'; end if;
  if not has_feature(c, t, 'finance') then raise exception 'Tu plan no incluye las finanzas del equipo'; end if;
  begin cuota := (fin->>'cuota')::numeric; exception when others then raise exception 'Datos no válidos'; end;
  if cuota is null or cuota < 0 or cuota > 50000 then raise exception 'Datos no válidos'; end if;
  -- conceptos de la liga y gastos
  for item in select jsonb_build_object('s', 'liga', 'x', x) from jsonb_array_elements(coalesce(fin->'liga', '[]')) x
              union all select jsonb_build_object('s', 'gastos', 'x', x) from jsonb_array_elements(coalesce(fin->'gastos', '[]')) x loop
    n := n + 1; if n > 40 then raise exception 'Datos no válidos'; end if;
    lbl := left(trim(coalesce(item->'x'->>'label', '')), 40); if lbl = '' then raise exception 'Datos no válidos'; end if;
    begin costo := (item->'x'->>'costo')::numeric; exception when others then raise exception 'Datos no válidos'; end;
    if costo is null or costo < 0 or costo > 500000 then raise exception 'Datos no válidos'; end if;
    k := left(coalesce(nullif(slugify(coalesce(item->'x'->>'k', '')), ''), slugify(lbl), 'x'), 24); if k = '' then k := 'x'; end if;
    while k = any (used) loop k := left(k, 21) || '-' || n; end loop;
    used := used || k; orden := orden || to_jsonb(k);
    r := jsonb_build_object('k', k, 'label', lbl, 'costo', costo, 'pagado', 0, 'desc', left(trim(coalesce(item->'x'->>'desc', '')), 120));
    if item->>'s' = 'liga' then liga := liga || jsonb_build_array(r); else gastos := gastos || jsonb_build_array(r); end if;
  end loop;
  -- multa repartida entre los jugadores marcados
  begin mt := coalesce((fin->>'multaTotal')::numeric, 0); exception when others then raise exception 'Datos no válidos'; end;
  if mt < 0 or mt > 50000 then raise exception 'Datos no válidos'; end if;
  if mt > 0 then multa := jsonb_build_object('total', mt, 'original', mt); liga := liga || jsonb_build_array(jsonb_build_object('k', 'multa', 'label', 'Multas', 'costo', mt, 'pagado', 0, 'desc', '')); orden := orden || '"multa"'; end if;
  for r in select e from team_docs d, jsonb_array_elements(d.data->'roster') e where d.club_id = c and d.team_id = t and e->>'status' is distinct from 'congelado' loop
    select f into fl from jsonb_array_elements(flags) f where f->>'player' = r->>'player' limit 1;
    cuentas := cuentas || jsonb_build_array(jsonb_build_object('player', r->>'player', 'aportado', 0, 'multa', mt > 0 and fl is not null, 'why', case when mt > 0 and fl is not null then left(coalesce(fl->>'why', ''), 60) else '' end));
  end loop;
  update team_docs set data = jsonb_set(data, '{finance}', jsonb_strip_nulls(jsonb_build_object('updated', now(), 'cuota', cuota, 'multa', multa, 'liga', liga, 'gastos', gastos, 'orden', orden,
    'cuotaNota', left(trim(coalesce(fin->>'cuotaNota', '')), 200), 'cuentas', cuentas, 'faq', '[]'::jsonb))) where club_id = c and team_id = t;
end $$;

grant execute on function public.has_feature(text,text,text), public.update_team(text,text,text,text,int), public.set_crest(text,text),
  public.set_theme(text,text,jsonb,text,text), public.update_player(text,text,text,text,text,text), public.set_player_status(text,text,text,text),
  public.save_match(text,text,jsonb), public.delete_match(text,text,text), public.save_finance(text,text,jsonb) to authenticated;

-- ============ Etapa 5 del producto: torneos, calendario, resultados ============
-- Todas las tablas llevan RLS (lectura solo para administradores de la liga) y se escriben únicamente por funciones.
-- La lectura pública llega en la etapa de página pública, por funciones que no exponen datos privados.

create or replace function public.league_feature(l text, f text) returns boolean
language sql stable security definer set search_path = public as $$
  select f = any (array(select jsonb_array_elements_text(entitlement('league', l)->'features'))) $$;
revoke all on function public.league_feature(text,text) from public, anon, authenticated;

-- ============ Etapa 9: infraestructura de seguridad (va antes de todo lo que la usa) ============
-- Migraciones de datos de una sola vez: cada cambio de datos se anota aquí y no se repite al volver a correr el archivo.
create table if not exists public.schema_migrations (id text primary key, applied_at timestamptz not null default now());
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;

-- Secreto interno, generado al azar en la primera corrida. Sirve para guardar huellas de IP en vez de IPs.
create table if not exists public.app_secret (id int primary key default 1 check (id = 1), salt text not null);
alter table public.app_secret enable row level security;
revoke all on public.app_secret from anon, authenticated;
insert into public.app_secret (id, salt) values (1, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')) on conflict (id) do nothing;

-- Contadores para límites de frecuencia (ventanas fijas). Nadie los lee ni escribe directo.
create table if not exists public.rate_limits (bucket text not null, k text not null, win timestamptz not null, n int not null default 0, primary key (bucket, k, win));
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Huella de quien llama: la IP que Supabase pasa en X-Forwarded-For, mezclada con el secreto (la IP nunca se guarda).
-- Los topes por enlace, por liga y por cuenta no dependen de la IP: aunque alguien falsifique la cabecera, esos siguen aplicando.
-- Si no hay cabeceras (por ejemplo, en pruebas), se usa la cuenta o "sin-ip": el límite se vuelve común y más estricto, nunca más laxo.
create or replace function public.client_key() returns text
language plpgsql stable security definer set search_path = public as $$
declare h json; ip text;
begin
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  ip := nullif(trim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), '');   -- como indica la guía de Supabase (Securing your API)
  if ip is null then return coalesce(auth.uid()::text, 'sin-ip'); end if;
  return encode(sha256(convert_to((select salt from app_secret where id = 1) || ip, 'UTF8')), 'hex');
end $$;

-- Cuenta un intento y dice si todavía está dentro del límite (p_max intentos por ventana de p_secs segundos).
create or replace function public.rate_ok(p_bucket text, p_key text, p_max int, p_secs int) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_secs) * p_secs); c int;
begin
  insert into rate_limits as r (bucket, k, win, n) values (p_bucket, left(coalesce(p_key, '-'), 200), w, 1)
    on conflict (bucket, k, win) do update set n = r.n + 1 where r.n < p_max returning r.n into c;
  if random() < 0.02 then delete from rate_limits where win < now() - interval '2 days'; end if;
  return c is not null;
end $$;
revoke all on function public.client_key(), public.rate_ok(text,text,int,int) from public, anon, authenticated;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  season text check (season is null or length(season) <= 40),
  category text check (category is null or length(category) <= 40),
  modality smallint not null default 7 check (modality in (5,6,7,8,9,11)),
  day text check (day is null or length(day) <= 20), shift text check (shift is null or length(shift) <= 20),
  fee numeric(10,2) check (fee is null or (fee >= 0 and fee <= 100000)), fee_note text check (fee_note is null or length(fee_note) <= 200),
  rules text check (rules is null or length(rules) <= 8000),
  pts_win smallint not null default 3 check (pts_win between 0 and 10),
  pts_draw smallint not null default 1 check (pts_draw between 0 and 10),
  pts_loss smallint not null default 0 check (pts_loss between 0 and 10),
  tiebreakers text[] not null default '{dg,gf,h2h,fairplay}' check (tiebreakers <@ array['dg','gf','wins','gc_low','h2h','fairplay','alpha']::text[]),
  status text not null default 'draft' check (status in ('draft','published','paused','finished')),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tournaments_league on public.tournaments (league_id, created_at desc);

create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  league_id text not null references public.leagues(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 60),
  link_id uuid references public.league_teams(id) on delete set null,   -- equipo de la app, si lo tiene
  contact text check (contact is null or length(contact) <= 120),        -- PRIVADO: nunca sale en páginas públicas
  status text not null default 'active' check (status in ('active','withdrawn')),
  created_at timestamptz not null default now()
);
create unique index if not exists tt_name on public.tournament_teams (tournament_id, lower(name)) where status = 'active';
create unique index if not exists tt_link on public.tournament_teams (tournament_id, link_id) where status = 'active' and link_id is not null;

create table if not exists public.league_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  league_id text not null references public.leagues(id) on delete cascade,
  round text check (round is null or length(round) <= 20), starts_at timestamptz, venue text check (venue is null or length(venue) <= 40),
  home_id uuid not null references public.tournament_teams(id), away_id uuid not null references public.tournament_teams(id),
  status text not null default 'scheduled' check (status in ('scheduled','played','postponed','canceled')),
  home_goals smallint check (home_goals between 0 and 99), away_goals smallint check (away_goals between 0 and 99),
  notes text check (notes is null or length(notes) <= 500),
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
  check (home_id <> away_id),
  check ((status = 'played') = (home_goals is not null and away_goals is not null))
);
create index if not exists lm_tournament on public.league_matches (tournament_id, starts_at);
create unique index if not exists lm_pair on public.league_matches (tournament_id, coalesce(round, ''), home_id, away_id);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.league_matches(id) on delete cascade,
  league_id text not null references public.leagues(id) on delete cascade,
  team_id uuid not null references public.tournament_teams(id),
  player text not null check (length(trim(player)) between 1 and 60), player_id uuid,   -- player_id se enlaza con el registro de jugadores (etapa 7)
  kind text not null check (kind in ('goal','own_goal','yellow','red')),
  n smallint not null default 1 check (n between 1 and 20)
);
create index if not exists me_match on public.match_events (match_id);

alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.league_matches enable row level security;
alter table public.match_events enable row level security;
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select using (is_league_admin(league_id));
drop policy if exists tt_read on public.tournament_teams;
create policy tt_read on public.tournament_teams for select using (is_league_admin(league_id));
drop policy if exists lm_read on public.league_matches;
create policy lm_read on public.league_matches for select using (is_league_admin(league_id));
drop policy if exists me_read on public.match_events;
create policy me_read on public.match_events for select using (is_league_admin(league_id));
grant select on public.tournaments, public.tournament_teams, public.league_matches, public.match_events to authenticated;

-- Un equipo no juega dos veces en la misma jornada; los equipos son del torneo y están activos; un torneo terminado no se modifica.
create or replace function public.lm_guard() returns trigger language plpgsql as $$
declare st text;
begin
  select status into st from tournaments where id = new.tournament_id;
  if st = 'finished' then raise exception 'El torneo ya terminó'; end if;
  if tg_op = 'INSERT' or new.home_id is distinct from old.home_id or new.away_id is distinct from old.away_id then
    if (select count(*) from tournament_teams where tournament_id = new.tournament_id and status = 'active' and id in (new.home_id, new.away_id)) <> 2 then
      raise exception 'Los equipos deben estar inscritos y activos en el torneo'; end if;
  end if;
  if new.round is not null and new.status <> 'canceled' and exists (
      select 1 from league_matches m where m.tournament_id = new.tournament_id and m.round = new.round and m.status <> 'canceled' and m.id <> new.id
        and (m.home_id in (new.home_id, new.away_id) or m.away_id in (new.home_id, new.away_id))) then
    raise exception 'Un equipo ya juega en esa jornada'; end if;
  return new;
end $$;
drop trigger if exists lm_guard on public.league_matches;
create trigger lm_guard before insert or update on public.league_matches for each row execute function public.lm_guard();

-- ---- Torneos ----
create or replace function public.create_tournament(l text, t jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid; lim int; n int; tb text[] := '{dg,gf,h2h,fairplay}';
begin
  if not is_league_admin(l, 'tournaments') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'tournaments') then raise exception 'Tu plan no incluye esa función'; end if;
  lim := (entitlement('league', l)->'limits'->>'tournaments')::int;
  select count(*) into n from tournaments where league_id = l and status <> 'finished';
  if lim is not null and n >= lim then raise exception 'Tu plan llegó al límite de torneos'; end if;
  if t ? 'tiebreakers' then select coalesce(array_agg(x), '{}') into tb from jsonb_array_elements_text(t->'tiebreakers') x; end if;
  insert into tournaments (league_id, name, season, category, modality, day, shift, fee, fee_note, rules, pts_win, pts_draw, pts_loss, tiebreakers, created_by)
  values (l, left(trim(coalesce(t->>'name', '')), 80), nullif(left(trim(coalesce(t->>'season', '')), 40), ''), nullif(left(trim(coalesce(t->>'category', '')), 40), ''),
    coalesce((t->>'modality')::int, 7), nullif(left(trim(coalesce(t->>'day', '')), 20), ''), nullif(left(trim(coalesce(t->>'shift', '')), 20), ''),
    nullif(t->>'fee', '')::numeric, nullif(left(trim(coalesce(t->>'fee_note', '')), 200), ''), nullif(left(coalesce(t->>'rules', ''), 8000), ''),
    coalesce((t->>'pts_win')::int, 3), coalesce((t->>'pts_draw')::int, 1), coalesce((t->>'pts_loss')::int, 0), tb, auth.uid())
  returning id into tid;
  perform log_action(l, 'tournament.create', jsonb_build_object('tournament', tid, 'name', t->>'name'));
  return tid;
end $$;

create or replace function public.update_tournament(l text, tid uuid, t jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare tb text[]; cur tournaments;
begin
  if not is_league_admin(l, 'tournaments') then raise exception 'Sin permiso'; end if;
  select * into cur from tournaments where id = tid and league_id = l for update;
  if cur.id is null then raise exception 'Torneo no encontrado'; end if;
  if cur.status = 'finished' then raise exception 'El torneo ya terminó'; end if;
  tb := cur.tiebreakers; if t ? 'tiebreakers' then select coalesce(array_agg(x), '{}') into tb from jsonb_array_elements_text(t->'tiebreakers') x; end if;
  update tournaments set
    name = case when t ? 'name' then left(trim(t->>'name'), 80) else name end,
    season = case when t ? 'season' then nullif(left(trim(coalesce(t->>'season', '')), 40), '') else season end,
    category = case when t ? 'category' then nullif(left(trim(coalesce(t->>'category', '')), 40), '') else category end,
    modality = case when t ? 'modality' then (t->>'modality')::int else modality end,
    day = case when t ? 'day' then nullif(left(trim(coalesce(t->>'day', '')), 20), '') else day end,
    shift = case when t ? 'shift' then nullif(left(trim(coalesce(t->>'shift', '')), 20), '') else shift end,
    fee = case when t ? 'fee' then nullif(t->>'fee', '')::numeric else fee end,
    fee_note = case when t ? 'fee_note' then nullif(left(trim(coalesce(t->>'fee_note', '')), 200), '') else fee_note end,
    rules = case when t ? 'rules' then nullif(left(coalesce(t->>'rules', ''), 8000), '') else rules end,
    pts_win = case when t ? 'pts_win' then (t->>'pts_win')::int else pts_win end,
    pts_draw = case when t ? 'pts_draw' then (t->>'pts_draw')::int else pts_draw end,
    pts_loss = case when t ? 'pts_loss' then (t->>'pts_loss')::int else pts_loss end,
    tiebreakers = tb, updated_at = now()
  where id = tid;
  perform log_action(l, 'tournament.update', jsonb_build_object('tournament', tid, 'fields', (select jsonb_agg(k) from jsonb_object_keys(t) k)));
end $$;

create or replace function public.set_tournament_status(l text, tid uuid, st text) returns void
language plpgsql security definer set search_path = public as $$
declare cur tournaments; lim int; n int;
begin
  if not is_league_admin(l, 'tournaments') then raise exception 'Sin permiso'; end if;
  if st not in ('draft','published','paused','finished') then raise exception 'Datos no válidos'; end if;
  select * into cur from tournaments where id = tid and league_id = l for update;
  if cur.id is null then raise exception 'Torneo no encontrado'; end if;
  if cur.status = 'finished' and st <> 'published' then raise exception 'El torneo ya terminó'; end if;   -- solo se puede reabrir publicándolo de nuevo
  if cur.status = 'finished' then   -- reabrir cuenta como torneo activo: respeta el mismo límite del plan
    lim := (entitlement('league', l)->'limits'->>'tournaments')::int;
    select count(*) into n from tournaments where league_id = l and status <> 'finished';
    if lim is not null and n >= lim then raise exception 'Tu plan llegó al límite de torneos'; end if;
  end if;
  update tournaments set status = st, updated_at = now() where id = tid;
  perform log_action(l, 'tournament.status', jsonb_build_object('tournament', tid, 'from', cur.status, 'to', st));
end $$;

-- ---- Inscripción de equipos ----
create or replace function public.add_tournament_team(l text, tid uuid, nm text, link uuid default null, contact text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare ttid uuid; nm2 text := left(trim(coalesce(nm, '')), 60); lt league_teams;
begin
  if not is_league_admin(l, 'tournaments') then raise exception 'Sin permiso'; end if;
  if not exists (select 1 from tournaments where id = tid and league_id = l and status <> 'finished') then raise exception 'Torneo no encontrado'; end if;
  if link is not null then
    select * into lt from league_teams where id = link and league_id = l and status = 'approved';
    if lt.id is null then raise exception 'Ese equipo no está vinculado a la liga'; end if;
    nm2 := coalesce(nullif(nm2, ''), lt.team_name);
  end if;
  if length(nm2) < 2 then raise exception 'Escribe el nombre del equipo'; end if;
  if exists (select 1 from tournament_teams where tournament_id = tid and status = 'active' and (lower(name) = lower(nm2) or (link is not null and link_id = link))) then raise exception 'Ese equipo ya está inscrito'; end if;
  insert into tournament_teams (tournament_id, league_id, name, link_id, contact) values (tid, l, nm2, link, nullif(left(trim(coalesce(contact, '')), 120), '')) returning id into ttid;
  perform log_action(l, 'tournament.team_add', jsonb_build_object('tournament', tid, 'team', nm2));
  return ttid;
end $$;

create or replace function public.remove_tournament_team(l text, ttid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r tournament_teams;
begin
  if not is_league_admin(l, 'tournaments') then raise exception 'Sin permiso'; end if;
  select * into r from tournament_teams where id = ttid and league_id = l and status = 'active' for update;
  if r.id is null then raise exception 'Equipo no encontrado'; end if;
  if exists (select 1 from league_matches where status = 'played' and (home_id = ttid or away_id = ttid))
     or exists (select 1 from league_charges where team_id = ttid) or exists (select 1 from league_movements where team_id = ttid) or exists (select 1 from player_registrations where team_id = ttid) then
    update tournament_teams set status = 'withdrawn' where id = ttid;       -- con partidos jugados, cobros o jugadores registrados no se borra: se retira y se conserva el historial
    update league_matches set status = 'canceled', notes = coalesce(notes || ' · ', '') || 'Equipo retirado' where status in ('scheduled','postponed') and (home_id = ttid or away_id = ttid);
  else
    delete from league_matches where home_id = ttid or away_id = ttid;
    delete from tournament_teams where id = ttid;
  end if;
  perform log_action(l, 'tournament.team_remove', jsonb_build_object('tournament', r.tournament_id, 'team', r.name));
end $$;

-- ---- Calendario ----
create or replace function public.league_save_match(l text, m jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare mid uuid := nullif(m->>'id', '')::uuid; tid uuid := (m->>'tournament')::uuid; cur league_matches; st text := coalesce(m->>'status', 'scheduled');
begin
  if not is_league_admin(l, 'schedule') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'schedule') then raise exception 'Tu plan no incluye esa función'; end if;
  if st not in ('scheduled','postponed','canceled') then raise exception 'Datos no válidos'; end if;
  if mid is null then
    if not exists (select 1 from tournaments where id = tid and league_id = l) then raise exception 'Torneo no encontrado'; end if;
    insert into league_matches (tournament_id, league_id, round, starts_at, venue, home_id, away_id, status, notes, updated_by)
    values (tid, l, nullif(left(trim(coalesce(m->>'round', '')), 20), ''), nullif(m->>'starts_at', '')::timestamptz, nullif(left(trim(coalesce(m->>'venue', '')), 40), ''),
      (m->>'home')::uuid, (m->>'away')::uuid, st, nullif(left(trim(coalesce(m->>'notes', '')), 500), ''), auth.uid()) returning id into mid;
    perform log_action(l, 'match.create', jsonb_build_object('match', mid));
  else
    select * into cur from league_matches where id = mid and league_id = l for update;
    if cur.id is null then raise exception 'Partido no encontrado'; end if;
    if cur.status = 'played' then raise exception 'Ese partido ya tiene resultado'; end if;
    update league_matches set round = nullif(left(trim(coalesce(m->>'round', '')), 20), ''), starts_at = nullif(m->>'starts_at', '')::timestamptz,
      venue = nullif(left(trim(coalesce(m->>'venue', '')), 40), ''), status = st, notes = nullif(left(trim(coalesce(m->>'notes', '')), 500), ''),
      home_id = coalesce(nullif(m->>'home', '')::uuid, home_id), away_id = coalesce(nullif(m->>'away', '')::uuid, away_id), updated_by = auth.uid(), updated_at = now() where id = mid;
    perform log_action(l, case when cur.starts_at is distinct from nullif(m->>'starts_at', '')::timestamptz or cur.venue is distinct from nullif(m->>'venue', '') then 'match.reschedule' else 'match.update' end,
      jsonb_build_object('match', mid, 'from', jsonb_build_object('starts_at', cur.starts_at, 'venue', cur.venue, 'status', cur.status), 'to', jsonb_build_object('starts_at', m->>'starts_at', 'venue', m->>'venue', 'status', st)));
  end if;
  return mid;
end $$;

create or replace function public.league_create_matches(l text, tid uuid, ms jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare m jsonb; n int := 0;
begin
  if not is_league_admin(l, 'schedule') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'schedule') then raise exception 'Tu plan no incluye esa función'; end if;
  if jsonb_typeof(ms) <> 'array' or jsonb_array_length(ms) > 400 then raise exception 'Datos no válidos'; end if;
  if not exists (select 1 from tournaments where id = tid and league_id = l) then raise exception 'Torneo no encontrado'; end if;
  for m in select * from jsonb_array_elements(ms) loop
    insert into league_matches (tournament_id, league_id, round, starts_at, venue, home_id, away_id, updated_by)
    values (tid, l, nullif(left(trim(coalesce(m->>'round', '')), 20), ''), nullif(m->>'starts_at', '')::timestamptz, nullif(left(trim(coalesce(m->>'venue', '')), 40), ''), (m->>'home')::uuid, (m->>'away')::uuid, auth.uid());
    n := n + 1;
  end loop;
  perform log_action(l, 'match.generate', jsonb_build_object('tournament', tid, 'count', n));
  return n;
end $$;

create or replace function public.league_delete_match(l text, mid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cur league_matches;
begin
  if not is_league_admin(l, 'schedule') then raise exception 'Sin permiso'; end if;
  select * into cur from league_matches where id = mid and league_id = l for update;
  if cur.id is null then raise exception 'Partido no encontrado'; end if;
  if cur.status = 'played' then raise exception 'Ese partido ya tiene resultado'; end if;
  delete from league_matches where id = mid;
  perform log_action(l, 'match.delete', jsonb_build_object('match', mid, 'round', cur.round));
end $$;

-- ---- Resultados oficiales (solo administradores con permiso; todo cambio queda en la bitácora con el antes y el después) ----
create or replace function public.record_result(l text, mid uuid, hg int, ag int, events jsonb default '[]', note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare cur league_matches; e jsonb; k text; tm uuid; gh int := 0; ga int := 0; cnt int;
begin
  if not is_league_admin(l, 'results') then raise exception 'Sin permiso'; end if;
  select * into cur from league_matches where id = mid and league_id = l for update;
  if cur.id is null then raise exception 'Partido no encontrado'; end if;
  if (select status from tournaments where id = cur.tournament_id) = 'finished' then raise exception 'El torneo ya terminó'; end if;
  if hg is null or ag is null or hg < 0 or ag < 0 or hg > 99 or ag > 99 then raise exception 'Datos no válidos'; end if;
  if jsonb_typeof(coalesce(events, '[]')) <> 'array' or jsonb_array_length(coalesce(events, '[]')) > 100 then raise exception 'Datos no válidos'; end if;
  for e in select * from jsonb_array_elements(coalesce(events, '[]')) loop
    tm := (e->>'team')::uuid; k := e->>'kind';
    if tm not in (cur.home_id, cur.away_id) or k not in ('goal','own_goal','yellow','red') or length(trim(coalesce(e->>'player', ''))) < 1 then raise exception 'Datos no válidos'; end if;
    if k = 'goal' then if tm = cur.home_id then gh := gh + coalesce((e->>'n')::int, 1); else ga := ga + coalesce((e->>'n')::int, 1); end if;
    elsif k = 'own_goal' then if tm = cur.home_id then ga := ga + coalesce((e->>'n')::int, 1); else gh := gh + coalesce((e->>'n')::int, 1); end if; end if;
  end loop;
  if gh > hg or ga > ag then raise exception 'Los goles de los jugadores superan el marcador'; end if;
  select count(*) into cnt from match_events where match_id = mid;
  delete from match_events where match_id = mid;
  for e in select * from jsonb_array_elements(coalesce(events, '[]')) loop
    insert into match_events (match_id, league_id, team_id, player, kind, n) values (mid, l, (e->>'team')::uuid, left(trim(e->>'player'), 60), e->>'kind', coalesce((e->>'n')::int, 1));
  end loop;
  update league_matches set status = 'played', home_goals = hg, away_goals = ag, notes = nullif(left(trim(coalesce(note, '')), 500), ''), updated_by = auth.uid(), updated_at = now() where id = mid;
  perform log_action(l, case when cur.status = 'played' then 'result.correct' else 'result.record' end, jsonb_build_object('match', mid,
    'before', jsonb_build_object('status', cur.status, 'home', cur.home_goals, 'away', cur.away_goals, 'events', cnt), 'after', jsonb_build_object('home', hg, 'away', ag, 'events', jsonb_array_length(coalesce(events, '[]')))));
end $$;

create or replace function public.clear_result(l text, mid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cur league_matches;
begin
  if not is_league_admin(l, 'results') then raise exception 'Sin permiso'; end if;
  select * into cur from league_matches where id = mid and league_id = l and status = 'played' for update;
  if cur.id is null then raise exception 'Partido no encontrado'; end if;
  if (select status from tournaments where id = cur.tournament_id) = 'finished' then raise exception 'El torneo ya terminó'; end if;
  delete from match_events where match_id = mid;
  update league_matches set status = 'scheduled', home_goals = null, away_goals = null, updated_by = auth.uid(), updated_at = now() where id = mid;
  perform log_action(l, 'result.clear', jsonb_build_object('match', mid, 'before', jsonb_build_object('home', cur.home_goals, 'away', cur.away_goals)));
end $$;

grant execute on function public.create_tournament(text,jsonb), public.update_tournament(text,uuid,jsonb), public.set_tournament_status(text,uuid,text),
  public.add_tournament_team(text,uuid,text,uuid,text), public.remove_tournament_team(text,uuid), public.league_save_match(text,jsonb),
  public.league_create_matches(text,uuid,jsonb), public.league_delete_match(text,uuid), public.record_result(text,uuid,int,int,jsonb,text),
  public.clear_result(text,uuid) to authenticated;

-- ============ Etapa 6 del producto: administradores, sanciones, objeciones, finanzas de liga ============
-- Las finanzas de la liga (cargos y pagos de los equipos a la liga) son registros administrativos de la liga.
-- No tienen relación con las suscripciones ni el contrato con la plataforma (tablas subscriptions y league_contracts).

create or replace function public.valid_admin_perms(p text[]) returns boolean language sql immutable as $$
  select coalesce(p <@ array['teams','tournaments','schedule','results','sanctions','finance','registration','audit','settings']::text[], false) $$;

create table if not exists public.admin_invites (
  code text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  perms text[] not null check (valid_admin_perms(perms)),
  label text check (label is null or length(label) <= 60),
  expires_at timestamptz not null,
  active boolean not null default true,
  used_by uuid references auth.users(id), used_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.admin_invites enable row level security;
drop policy if exists admin_invites_read on public.admin_invites;
create policy admin_invites_read on public.admin_invites for select using (is_league_admin(league_id, 'admins'));
grant select on public.admin_invites to authenticated;

create or replace function public.create_admin_invite(l text, p text[], lbl text default null, days int default 7) returns text
language plpgsql security definer set search_path = public as $$
declare raw text; c text;
begin
  if not is_league_admin(l, 'admins') then raise exception 'Sin permiso'; end if;
  if p is null or cardinality(p) = 0 or not valid_admin_perms(p) then raise exception 'Datos no válidos'; end if;
  if days is null or days < 1 or days > 60 then raise exception 'Datos no válidos'; end if;
  raw := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 12));
  c := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
  insert into admin_invites (code, league_id, perms, label, expires_at, created_by) values (c, l, p, nullif(left(trim(coalesce(lbl, '')), 60), ''), now() + make_interval(days => days), auth.uid());
  perform log_action(l, 'admin.invite', jsonb_build_object('code_end', right(c, 4), 'perms', p));
  return c;
end $$;

create or replace function public.revoke_admin_invite(l text, c text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_league_admin(l, 'admins') then raise exception 'Sin permiso'; end if;
  update admin_invites set active = false where code = c and league_id = l;
  perform log_action(l, 'admin.invite_revoke', jsonb_build_object('code_end', right(c, 4)));
end $$;

-- Un código sirve una sola vez. Comparte el límite de intentos fallidos con las invitaciones de equipos.
create or replace function public.accept_admin_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv admin_invites; cid text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); lim int; n int; cur league_admins;
begin
  if auth.uid() is null then raise exception 'Inicia sesión primero'; end if;
  if (select count(*) from invite_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 8 then return jsonb_build_object('error', 'throttled'); end if;
  select * into inv from admin_invites i where i.code = substr(cid, 1, 4) || '-' || substr(cid, 5, 4) || '-' || substr(cid, 9, 4) and i.active and i.used_by is null and i.expires_at > now() for update;
  if inv.code is null then insert into invite_attempts (user_id) values (auth.uid()); return jsonb_build_object('error', 'invalid'); end if;
  select * into cur from league_admins where league_id = inv.league_id and user_id = auth.uid();
  if cur.user_id is not null and cur.status = 'active' then return jsonb_build_object('error', 'already'); end if;
  lim := (entitlement('league', inv.league_id)->'limits'->>'admins')::int;
  select count(*) into n from league_admins where league_id = inv.league_id and status = 'active';
  if lim is not null and n >= lim then return jsonb_build_object('error', 'limit'); end if;
  insert into league_admins (league_id, user_id, role, perms, status) values (inv.league_id, auth.uid(), 'admin', inv.perms, 'active')
    on conflict (league_id, user_id) do update set status = 'active', perms = excluded.perms, role = 'admin';
  update admin_invites set used_by = auth.uid(), used_at = now(), active = false where code = inv.code;
  perform log_action(inv.league_id, 'admin.join', jsonb_build_object('user', auth.uid(), 'perms', inv.perms));
  return jsonb_build_object('ok', true, 'league', (select name from leagues where id = inv.league_id), 'league_id', inv.league_id);
end $$;

create or replace function public.set_admin_perms(l text, u uuid, p text[]) returns void
language plpgsql security definer set search_path = public as $$
declare cur league_admins;
begin
  if not is_league_admin(l, 'admins') then raise exception 'Sin permiso'; end if;
  if p is null or not valid_admin_perms(p) then raise exception 'Datos no válidos'; end if;
  select * into cur from league_admins where league_id = l and user_id = u and status = 'active' for update;
  if cur.user_id is null then raise exception 'Administrador no encontrado'; end if;
  if cur.role = 'owner' then raise exception 'El superadministrador no se modifica'; end if;
  update league_admins set perms = p where league_id = l and user_id = u;
  perform log_action(l, 'admin.perms', jsonb_build_object('user', u, 'before', cur.perms, 'after', p));
end $$;

create or replace function public.revoke_admin(l text, u uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cur league_admins;
begin
  if not is_league_admin(l, 'admins') then raise exception 'Sin permiso'; end if;
  select * into cur from league_admins where league_id = l and user_id = u and status = 'active' for update;
  if cur.user_id is null then raise exception 'Administrador no encontrado'; end if;
  if cur.role = 'owner' then raise exception 'El superadministrador no se modifica'; end if;
  update league_admins set status = 'revoked' where league_id = l and user_id = u;
  perform log_action(l, 'admin.revoke', jsonb_build_object('user', u, 'perms', cur.perms));
end $$;

create or replace function public.league_admins_list(l text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_league_admin(l, 'admins') then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email, 'role', a.role, 'perms', a.perms, 'status', a.status, 'since', a.created_at) order by a.role, a.created_at)
    from league_admins a join auth.users u on u.id = a.user_id where a.league_id = l), '[]');
end $$;

-- Historial de la liga con el nombre (correo) de quien actuó; ref filtra por un registro concreto (partido, sanción, objeción…).
create or replace function public.audit_view(l text, lim int default 100, ref text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_league_admin(l, 'audit') then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(x order by x->>'at' desc) from (
    select jsonb_build_object('id', a.id, 'action', a.action, 'detail', a.detail, 'at', a.at, 'actor', u.email) x
    from audit_log a left join auth.users u on u.id = a.actor
    where a.league_id = l and (ref is null or exists (select 1 from jsonb_each_text(a.detail) e where e.value = ref))
    order by a.at desc, a.id desc limit least(greatest(coalesce(lim, 100), 1), 500)) s), '[]');
end $$;

-- ---- Finanzas de la liga ----
create table if not exists public.sanctions (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  team_id uuid references public.tournament_teams(id) on delete set null,
  player text check (player is null or length(trim(player)) between 1 and 60),
  kind text not null check (kind in ('amonestacion','suspension','multa','puntos','expulsion')),
  reason text not null check (length(trim(reason)) between 3 and 500),
  matches smallint check (matches is null or matches between 1 and 99),
  points smallint check (points is null or points between 1 and 50),
  amount numeric(10,2) check (amount is null or (amount > 0 and amount <= 100000)),
  starts_on date, ends_on date, evidence text check (evidence is null or length(evidence) <= 500),
  status text not null default 'active' check (status in ('active','served','revoked')),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (team_id is not null or player is not null),
  check (kind <> 'multa' or amount is not null),
  check (kind <> 'puntos' or (points is not null and team_id is not null)),
  check (kind <> 'suspension' or matches is not null or ends_on is not null),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists sanctions_league on public.sanctions (league_id, created_at desc);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  match_id uuid references public.league_matches(id) on delete set null,
  sanction_id uuid references public.sanctions(id) on delete set null,
  team_id uuid references public.tournament_teams(id) on delete set null,
  kind text not null check (kind in ('objection','protest')),
  subject text not null check (length(trim(subject)) between 3 and 120),
  detail text check (detail is null or length(detail) <= 2000),
  status text not null default 'open' check (status in ('open','in_review','accepted','rejected','withdrawn')),
  resolution text check (resolution is null or length(resolution) <= 2000),
  resolved_by uuid references auth.users(id), resolved_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists disputes_league on public.disputes (league_id, created_at desc);

create table if not exists public.league_charges (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  team_id uuid not null references public.tournament_teams(id),
  concept text not null check (length(trim(concept)) between 2 and 80),
  amount numeric(10,2) not null check (amount > 0 and amount <= 1000000),
  due_on date, sanction_id uuid references public.sanctions(id) on delete set null,
  status text not null default 'active' check (status in ('active','void')), void_reason text check (void_reason is null or length(void_reason) <= 300),
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists charges_league on public.league_charges (league_id, created_at desc);

create table if not exists public.league_movements (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  team_id uuid references public.tournament_teams(id),
  charge_id uuid references public.league_charges(id),
  kind text not null check (kind in ('payment','income','expense')),
  concept text not null check (length(trim(concept)) between 2 and 80),
  amount numeric(10,2) not null check (amount > 0 and amount <= 1000000),
  method text not null default 'efectivo' check (method in ('efectivo','transferencia','otro')),
  paid_on date not null default current_date, note text check (note is null or length(note) <= 300),
  status text not null default 'active' check (status in ('active','void')), void_reason text check (void_reason is null or length(void_reason) <= 300),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  check (kind <> 'payment' or team_id is not null)
);
create index if not exists movements_league on public.league_movements (league_id, paid_on desc);

alter table public.sanctions enable row level security; alter table public.disputes enable row level security;
alter table public.league_charges enable row level security; alter table public.league_movements enable row level security;
drop policy if exists sanctions_read on public.sanctions; create policy sanctions_read on public.sanctions for select using (is_league_admin(league_id, 'sanctions'));
drop policy if exists disputes_read on public.disputes; create policy disputes_read on public.disputes for select using (is_league_admin(league_id, 'sanctions'));
drop policy if exists charges_read on public.league_charges; create policy charges_read on public.league_charges for select using (is_league_admin(league_id, 'finance'));
drop policy if exists movements_read on public.league_movements; create policy movements_read on public.league_movements for select using (is_league_admin(league_id, 'finance'));
grant select on public.sanctions, public.disputes, public.league_charges, public.league_movements to authenticated;

create or replace function public.save_sanction(l text, s jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid := nullif(s->>'id', '')::uuid; cur sanctions; tm tournament_teams; k text := s->>'kind'; cid uuid;
begin
  if not is_league_admin(l, 'sanctions') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'sanctions') then raise exception 'Tu plan no incluye esa función'; end if;
  if nullif(s->>'team', '') is not null then
    select * into tm from tournament_teams where id = (s->>'team')::uuid and league_id = l;
    if tm.id is null then raise exception 'Equipo no encontrado'; end if;
  end if;
  if sid is null then
    insert into sanctions (league_id, tournament_id, team_id, player, kind, reason, matches, points, amount, starts_on, ends_on, evidence, created_by)
    values (l, tm.tournament_id, tm.id, nullif(left(trim(coalesce(s->>'player', '')), 60), ''), k, left(trim(coalesce(s->>'reason', '')), 500), nullif(s->>'matches', '')::int, nullif(s->>'points', '')::int,
      nullif(s->>'amount', '')::numeric, nullif(s->>'starts_on', '')::date, nullif(s->>'ends_on', '')::date, nullif(left(trim(coalesce(s->>'evidence', '')), 500), ''), auth.uid()) returning id into sid;
    if k = 'multa' and tm.id is not null and coalesce((s->>'charge')::boolean, false) then
      insert into league_charges (league_id, tournament_id, team_id, concept, amount, sanction_id, created_by)
      values (l, tm.tournament_id, tm.id, left('Multa: ' || trim(s->>'reason'), 80), (s->>'amount')::numeric, sid, auth.uid()) returning id into cid;
      if not league_feature(l, 'league_finance') then raise exception 'Tu plan no incluye esa función'; end if;
    end if;
    perform log_action(l, 'sanction.create', jsonb_build_object('sanction', sid, 'kind', k, 'team', tm.id, 'player', s->>'player', 'charge', cid));
  else
    select * into cur from sanctions where id = sid and league_id = l for update;
    if cur.id is null then raise exception 'Sanción no encontrada'; end if;
    if cur.status = 'revoked' then raise exception 'Esa sanción está revocada'; end if;
    update sanctions set reason = left(trim(coalesce(s->>'reason', reason)), 500), matches = nullif(coalesce(s->>'matches', matches::text), '')::int, points = nullif(coalesce(s->>'points', points::text), '')::int,
      amount = nullif(coalesce(s->>'amount', amount::text), '')::numeric, starts_on = nullif(coalesce(s->>'starts_on', starts_on::text), '')::date, ends_on = nullif(coalesce(s->>'ends_on', ends_on::text), '')::date,
      evidence = case when s ? 'evidence' then nullif(left(trim(coalesce(s->>'evidence', '')), 500), '') else evidence end, updated_at = now() where id = sid;
    perform log_action(l, 'sanction.update', jsonb_build_object('sanction', sid, 'before', jsonb_build_object('reason', cur.reason, 'matches', cur.matches, 'points', cur.points, 'amount', cur.amount, 'ends_on', cur.ends_on, 'evidence', cur.evidence),
      'after', jsonb_build_object('reason', s->>'reason', 'matches', s->>'matches', 'points', s->>'points', 'amount', s->>'amount', 'ends_on', s->>'ends_on', 'evidence', s->>'evidence')));
  end if;
  return sid;
end $$;

create or replace function public.set_sanction_status(l text, sid uuid, st text, note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare cur sanctions;
begin
  if not is_league_admin(l, 'sanctions') then raise exception 'Sin permiso'; end if;
  if st not in ('active','served','revoked') then raise exception 'Datos no válidos'; end if;
  select * into cur from sanctions where id = sid and league_id = l for update;
  if cur.id is null then raise exception 'Sanción no encontrada'; end if;
  if cur.status = 'revoked' then raise exception 'Esa sanción está revocada'; end if;
  if st = 'revoked' and length(trim(coalesce(note, ''))) < 3 then raise exception 'Escribe el motivo'; end if;
  update sanctions set status = st, updated_at = now() where id = sid;
  if st = 'revoked' then update league_charges set status = 'void', void_reason = 'Sanción revocada' where sanction_id = sid and status = 'active'; end if;
  perform log_action(l, 'sanction.status', jsonb_build_object('sanction', sid, 'from', cur.status, 'to', st, 'note', left(note, 300)));
end $$;

create or replace function public.file_dispute(l text, d jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare did uuid; tid uuid; m league_matches; tm tournament_teams;
begin
  if not is_league_admin(l, 'sanctions') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'sanctions') then raise exception 'Tu plan no incluye esa función'; end if;
  if d->>'kind' not in ('objection','protest') then raise exception 'Datos no válidos'; end if;
  if nullif(d->>'match', '') is not null then select * into m from league_matches where id = (d->>'match')::uuid and league_id = l; if m.id is null then raise exception 'Partido no encontrado'; end if; tid := m.tournament_id; end if;
  if nullif(d->>'team', '') is not null then select * into tm from tournament_teams where id = (d->>'team')::uuid and league_id = l; if tm.id is null then raise exception 'Equipo no encontrado'; end if; tid := coalesce(tid, tm.tournament_id); end if;
  if nullif(d->>'sanction', '') is not null and not exists (select 1 from sanctions where id = (d->>'sanction')::uuid and league_id = l) then raise exception 'Sanción no encontrada'; end if;
  insert into disputes (league_id, tournament_id, match_id, sanction_id, team_id, kind, subject, detail, created_by)
  values (l, tid, m.id, nullif(d->>'sanction', '')::uuid, tm.id, d->>'kind', left(trim(coalesce(d->>'subject', '')), 120), nullif(left(trim(coalesce(d->>'detail', '')), 2000), ''), auth.uid()) returning id into did;
  perform log_action(l, 'dispute.file', jsonb_build_object('dispute', did, 'kind', d->>'kind', 'match', m.id, 'sanction', d->>'sanction', 'team', tm.id));
  return did;
end $$;

create or replace function public.resolve_dispute(l text, did uuid, st text, res text default null) returns void
language plpgsql security definer set search_path = public as $$
declare cur disputes;
begin
  if not is_league_admin(l, 'sanctions') then raise exception 'Sin permiso'; end if;
  if st not in ('open','in_review','accepted','rejected','withdrawn') then raise exception 'Datos no válidos'; end if;
  select * into cur from disputes where id = did and league_id = l for update;
  if cur.id is null then raise exception 'Objeción no encontrada'; end if;
  if st in ('accepted','rejected') and length(trim(coalesce(res, ''))) < 3 then raise exception 'Escribe la resolución'; end if;
  update disputes set status = st, resolution = case when st in ('accepted','rejected') then left(trim(res), 2000) else coalesce(nullif(left(trim(coalesce(res, '')), 2000), ''), resolution) end,
    resolved_by = case when st in ('accepted','rejected','withdrawn') then auth.uid() else null end, resolved_at = case when st in ('accepted','rejected','withdrawn') then now() else null end, updated_at = now() where id = did;
  perform log_action(l, case when cur.status in ('accepted','rejected','withdrawn') then 'dispute.change' else 'dispute.resolve' end,
    jsonb_build_object('dispute', did, 'before', jsonb_build_object('status', cur.status, 'resolution', cur.resolution), 'after', jsonb_build_object('status', st, 'resolution', left(res, 2000))));
end $$;

create or replace function public.create_charges(l text, tid uuid, p_concept text, p_amount numeric, p_due date default null, p_team uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r tournament_teams; cn text := left(trim(coalesce(p_concept, '')), 80);
begin
  if not is_league_admin(l, 'finance') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'league_finance') then raise exception 'Tu plan no incluye esa función'; end if;
  if length(cn) < 2 or p_amount is null or p_amount <= 0 or p_amount > 1000000 then raise exception 'Datos no válidos'; end if;
  if not exists (select 1 from tournaments where id = tid and league_id = l) then raise exception 'Torneo no encontrado'; end if;
  for r in select * from tournament_teams where tournament_id = tid and league_id = l and status = 'active' and (p_team is null or id = p_team) loop
    if not exists (select 1 from league_charges where team_id = r.id and lower(concept) = lower(cn) and status = 'active' and sanction_id is null) then    -- sin duplicar el mismo concepto
      insert into league_charges (league_id, tournament_id, team_id, concept, amount, due_on, created_by) values (l, tid, r.id, cn, p_amount, p_due, auth.uid()); n := n + 1;
    end if;
  end loop;
  if p_team is not null and n = 0 then raise exception 'Ese cargo ya existe para el equipo'; end if;
  perform log_action(l, 'charge.create', jsonb_build_object('tournament', tid, 'concept', cn, 'amount', p_amount, 'count', n));
  return n;
end $$;

create or replace function public.void_charge(l text, cid uuid, reason text) returns void
language plpgsql security definer set search_path = public as $$
declare cur league_charges;
begin
  if not is_league_admin(l, 'finance') then raise exception 'Sin permiso'; end if;
  if length(trim(coalesce(reason, ''))) < 3 then raise exception 'Escribe el motivo'; end if;
  select * into cur from league_charges where id = cid and league_id = l and status = 'active' for update;
  if cur.id is null then raise exception 'Cargo no encontrado'; end if;
  update league_charges set status = 'void', void_reason = left(trim(reason), 300) where id = cid;
  perform log_action(l, 'charge.void', jsonb_build_object('charge', cid, 'team', cur.team_id, 'concept', cur.concept, 'amount', cur.amount, 'reason', left(reason, 300)));
end $$;

create or replace function public.record_movement(l text, m jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare mid uuid; k text := m->>'kind'; tm tournament_teams; ch league_charges; amt numeric := nullif(m->>'amount', '')::numeric;
begin
  if not is_league_admin(l, 'finance') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'league_finance') then raise exception 'Tu plan no incluye esa función'; end if;
  if k not in ('payment','income','expense') or amt is null or amt <= 0 then raise exception 'Datos no válidos'; end if;
  if nullif(m->>'team', '') is not null then select * into tm from tournament_teams where id = (m->>'team')::uuid and league_id = l; if tm.id is null then raise exception 'Equipo no encontrado'; end if; end if;
  if k = 'payment' and tm.id is null then raise exception 'Elige el equipo que pagó'; end if;
  if k <> 'payment' and length(trim(coalesce(m->>'concept', ''))) < 2 then raise exception 'Escribe el concepto'; end if;
  if nullif(m->>'charge', '') is not null then
    select * into ch from league_charges where id = (m->>'charge')::uuid and league_id = l and status = 'active';
    if ch.id is null or ch.team_id is distinct from tm.id then raise exception 'Cargo no encontrado'; end if;
  end if;
  insert into league_movements (league_id, tournament_id, team_id, charge_id, kind, concept, amount, method, paid_on, note, created_by)
  values (l, coalesce(tm.tournament_id, ch.tournament_id), tm.id, ch.id, k, left(trim(coalesce(nullif(trim(m->>'concept'), ''), ch.concept, case when k = 'payment' then 'Pago' end, '')), 80), amt, coalesce(nullif(m->>'method', ''), 'efectivo'),
    coalesce(nullif(m->>'paid_on', '')::date, current_date), nullif(left(trim(coalesce(m->>'note', '')), 300), ''), auth.uid()) returning id into mid;
  perform log_action(l, 'movement.' || k, jsonb_build_object('movement', mid, 'team', tm.id, 'charge', ch.id, 'amount', amt));
  return mid;
end $$;

create or replace function public.void_movement(l text, mid uuid, reason text) returns void
language plpgsql security definer set search_path = public as $$
declare cur league_movements;
begin
  if not is_league_admin(l, 'finance') then raise exception 'Sin permiso'; end if;
  if length(trim(coalesce(reason, ''))) < 3 then raise exception 'Escribe el motivo'; end if;
  select * into cur from league_movements where id = mid and league_id = l and status = 'active' for update;
  if cur.id is null then raise exception 'Movimiento no encontrado'; end if;
  update league_movements set status = 'void', void_reason = left(trim(reason), 300) where id = mid;
  perform log_action(l, 'movement.void', jsonb_build_object('movement', mid, 'kind', cur.kind, 'team', cur.team_id, 'amount', cur.amount, 'reason', left(reason, 300)));
end $$;

grant execute on function public.create_admin_invite(text,text[],text,int), public.revoke_admin_invite(text,text), public.accept_admin_invite(text),
  public.set_admin_perms(text,uuid,text[]), public.revoke_admin(text,uuid), public.league_admins_list(text), public.audit_view(text,int,text),
  public.save_sanction(text,jsonb), public.set_sanction_status(text,uuid,text,text), public.file_dispute(text,jsonb), public.resolve_dispute(text,uuid,text,text),
  public.create_charges(text,uuid,text,numeric,date,uuid), public.void_charge(text,uuid,text), public.record_movement(text,jsonb), public.void_movement(text,uuid,text) to authenticated;

-- Descuentos de puntos por sanción: los ve cualquier administrador de la liga (la tabla de posiciones debe ser igual para todos),
-- sin exponer el resto de los datos de la sanción.
create or replace function public.standings_adjustments(l text, tid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_league_admin(l) then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('team_id', team_id, 'points', pts)) from (
    select team_id, sum(points)::int as pts from sanctions where league_id = l and tournament_id = tid and kind = 'puntos' and status <> 'revoked' group by team_id) x), '[]');
end $$;
grant execute on function public.standings_adjustments(text,uuid) to authenticated;

-- ============ Etapa 7 del producto: registro de jugadores, padrón central y credenciales ============
-- Reglas de registro por liga (foto, documento, aprobación de lo que mandan los delegados). Valores por omisión: foto y documento opcionales, con aprobación.
create or replace function public.reg_rules(l text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('photo', 'optional', 'doc', 'off', 'delegate_approval', true) || coalesce((select settings->'registration' from leagues where id = l), '{}') $$;
revoke all on function public.reg_rules(text) from public, anon, authenticated;

create or replace function public.set_registration_rules(l text, r jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_league_admin(l, 'settings') then raise exception 'Sin permiso'; end if;
  if (r->>'photo') not in ('off','optional','required') or (r->>'doc') not in ('off','optional','required') or jsonb_typeof(r->'delegate_approval') <> 'boolean' then raise exception 'Datos no válidos'; end if;
  update leagues set settings = jsonb_set(settings, '{registration}', jsonb_build_object('photo', r->>'photo', 'doc', r->>'doc', 'delegate_approval', r->'delegate_approval')) where id = l;
  perform log_action(l, 'registration.rules', jsonb_build_object('rules', r));
end $$;
create or replace function public.registration_rules(l text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_league_admin(l) ) then raise exception 'Sin permiso'; end if;
  return reg_rules(l);
end $$;

-- Nombre normalizado: minúsculas, sin acentos, sin signos ni espacios repetidos.
create or replace function public.norm_name(x text) returns text language sql immutable as $$
  select trim(regexp_replace(translate(lower(coalesce(x, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'), '[^a-z0-9]+', ' ', 'g')) $$;

create table if not exists public.league_players (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  norm text not null,
  birth_date date check (birth_date is null or (birth_date > date '1900-01-01' and birth_date <= current_date)),
  doc_id text check (doc_id is null or length(doc_id) between 3 and 30), doc_norm text,
  photo_path text check (photo_path is null or length(photo_path) <= 300),
  status text not null default 'pending' check (status in ('pending','active','inactive')),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (birth_date is not null or doc_norm is not null)      -- identidad mínima para no duplicar
);
create unique index if not exists lp_doc on public.league_players (league_id, doc_norm) where doc_norm is not null;
create unique index if not exists lp_name on public.league_players (league_id, norm, birth_date) where birth_date is not null;
create index if not exists lp_search on public.league_players (league_id, norm);

create table if not exists public.player_registrations (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.league_players(id),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.tournament_teams(id),
  number smallint check (number is null or number between 0 and 99),
  status text not null default 'pending' check (status in ('pending','active','rejected','removed')),
  via text not null check (via in ('office','delegate','link')),
  requested_by uuid references auth.users(id), decided_by uuid references auth.users(id), decided_at timestamptz,
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now()
);
create unique index if not exists pr_one_team on public.player_registrations (tournament_id, player_id) where status in ('pending','active');
create unique index if not exists pr_number on public.player_registrations (team_id, number) where status = 'active' and number is not null;
create index if not exists pr_league on public.player_registrations (league_id, status);

create table if not exists public.registration_links (
  code text primary key,
  league_id text not null references public.leagues(id) on delete cascade,
  team_id uuid not null references public.tournament_teams(id) on delete cascade,
  max_uses int not null check (max_uses between 1 and 200), uses int not null default 0,
  expires_at timestamptz not null, active boolean not null default true,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);

alter table public.league_players enable row level security; alter table public.player_registrations enable row level security; alter table public.registration_links enable row level security;
drop policy if exists lp_read on public.league_players; create policy lp_read on public.league_players for select using (is_league_admin(league_id, 'registration'));
drop policy if exists pr_read on public.player_registrations; create policy pr_read on public.player_registrations for select using (is_league_admin(league_id, 'registration'));
drop policy if exists rl_read on public.registration_links; create policy rl_read on public.registration_links for select using (is_league_admin(league_id, 'registration'));
grant select on public.league_players, public.player_registrations, public.registration_links to authenticated;

-- Fotos de jugadores: bucket PRIVADO (a diferencia de los escudos). Se leen con enlaces firmados temporales y solo los administradores con permiso de registro.
insert into storage.buckets (id, name, public) values ('player-photos', 'player-photos', false) on conflict (id) do nothing;
drop policy if exists pphotos_write on storage.objects;
create policy pphotos_write on storage.objects for insert with check (bucket_id = 'player-photos' and is_league_admin((storage.foldername(name))[1], 'registration'));
drop policy if exists pphotos_update on storage.objects;
create policy pphotos_update on storage.objects for update using (bucket_id = 'player-photos' and is_league_admin((storage.foldername(name))[1], 'registration'));
drop policy if exists pphotos_read on storage.objects;
create policy pphotos_read on storage.objects for select using (bucket_id = 'player-photos' and is_league_admin((storage.foldername(name))[1], 'registration'));

-- Encuentra o crea al jugador del padrón. Mismo documento, o mismo nombre y fecha de nacimiento = la misma persona (no se duplica).
drop function if exists public.upsert_player(text,jsonb,text);
create or replace function public.upsert_player(l text, p jsonb, st text, p_update boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare r jsonb := reg_rules(l); nm text := left(trim(coalesce(p->>'name', '')), 80); bd date := nullif(p->>'birth_date', '')::date; dn text := nullif(upper(regexp_replace(coalesce(p->>'doc_id', ''), '[^A-Za-z0-9]', '', 'g')), ''); pid uuid;
begin
  if length(nm) < 2 then raise exception 'Escribe el nombre del jugador'; end if;
  if r->>'doc' = 'required' and dn is null then raise exception 'Esta liga pide documento de identidad'; end if;
  if r->>'doc' = 'off' then dn := null; end if;
  if bd is null then raise exception 'Indica la fecha de nacimiento'; end if;
  select id into pid from league_players where league_id = l and ((dn is not null and doc_norm = dn) or (norm = norm_name(nm) and birth_date = bd)) limit 1;
  if pid is not null then
    if p_update then
      update league_players set doc_id = coalesce(doc_id, case when dn is not null then left(trim(p->>'doc_id'), 30) end), doc_norm = coalesce(doc_norm, dn), birth_date = coalesce(birth_date, bd), updated_at = now() where id = pid;
    end if;
    return pid;
  end if;
  insert into league_players (league_id, name, norm, birth_date, doc_id, doc_norm, status, created_by)
  values (l, nm, norm_name(nm), bd, case when dn is not null then left(trim(p->>'doc_id'), 30) end, dn, st, auth.uid()) returning id into pid;
  return pid;
end $$;
revoke all on function public.upsert_player(text,jsonb,text,boolean) from public, anon, authenticated;

-- Reglas para activar a un jugador en un equipo.
create or replace function public.check_can_activate(l text, pid uuid, rid uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare r jsonb := reg_rules(l); pl league_players;
begin
  select * into pl from league_players where id = pid and league_id = l;
  if r->>'photo' = 'required' and pl.photo_path is null then raise exception 'Falta la foto del jugador'; end if;
  if r->>'doc' = 'required' and pl.doc_norm is null then raise exception 'Falta el documento del jugador'; end if;
end $$;
revoke all on function public.check_can_activate(text,uuid,uuid) from public, anon, authenticated;

-- Consentimiento al registrar: la liga debe tener publicado su aviso de privacidad; quien registra lo acepta (o lo declara, si es la liga o el delegado);
-- para menores de 18 años se pide a madre, padre o tutor. Se guarda en el registro con la versión del aviso. La fecha de nacimiento es obligatoria (sin ella no se sabe si es menor).
create or replace function public.consent_check(l text, p jsonb, via text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pv jsonb := coalesce((select settings->'privacy' from leagues where id = l), '{}'); c jsonb := p->'consent'; bd date; minor boolean; g text;
begin
  if coalesce(trim(pv->>'notice'), '') = '' then raise exception 'La liga aún no publica su aviso de privacidad'; end if;
  if c is null or jsonb_typeof(c) <> 'object' or (c->>'accepted') is distinct from 'true' then raise exception 'Falta aceptar el aviso de privacidad'; end if;
  if via = 'link' and (c->>'version') is distinct from (pv->>'version') then raise exception 'El aviso de privacidad cambió; vuelve a abrir el enlace'; end if;
  bd := nullif(p->>'birth_date', '')::date;
  if bd is null then raise exception 'Indica la fecha de nacimiento'; end if;
  minor := bd > (current_date - interval '18 years')::date;
  g := left(trim(coalesce(c->>'guardian_name', '')), 80);
  if minor and ((c->>'by') is distinct from 'guardian' or length(g) < 3) then raise exception 'Para menores de edad se necesita el consentimiento de madre, padre o tutor'; end if;
  return jsonb_build_object('version', (pv->>'version')::int, 'by', case when minor or (c->>'by') = 'guardian' then 'guardian' else 'self' end, 'guardian_name', case when length(g) >= 3 then g end,
    'minor', minor, 'via', via, 'at', now(), 'attested_by', auth.uid());
end $$;
revoke all on function public.consent_check(text,jsonb,text) from public, anon, authenticated;
alter table public.player_registrations add column if not exists consent jsonb;

create or replace function public.conflict_msg(tid uuid, pid uuid) returns text
language sql stable security definer set search_path = public as $$
  select 'Ese jugador ya está inscrito en ' || t.name from player_registrations r join tournament_teams t on t.id = r.team_id where r.tournament_id = tid and r.player_id = pid and r.status in ('pending','active') limit 1 $$;
revoke all on function public.conflict_msg(uuid,uuid) from public, anon, authenticated;

drop function if exists public.add_registration(text,tournament_teams,uuid,int,text,text);
create or replace function public.add_registration(l text, tt tournament_teams, pid uuid, num int, st text, v text, cons jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid; msg text;
begin
  msg := conflict_msg(tt.tournament_id, pid);
  if msg is not null then
    if v = 'office' then raise exception '%', msg; end if;
    raise exception 'Ese jugador ya está inscrito en este torneo';
  end if;
  if st = 'active' and num is not null and exists (select 1 from player_registrations where team_id = tt.id and number = num and status = 'active') then raise exception 'Ese número ya lo usa otro jugador del equipo'; end if;
  insert into player_registrations (league_id, player_id, tournament_id, team_id, number, status, via, requested_by, decided_by, decided_at, consent)
  values (l, pid, tt.tournament_id, tt.id, num, st, v, auth.uid(), case when st = 'active' then auth.uid() end, case when st = 'active' then now() end, cons) returning id into rid;
  if st = 'active' then update league_players set status = 'active', updated_at = now() where id = pid; end if;
  return rid;
end $$;
revoke all on function public.add_registration(text,tournament_teams,uuid,int,text,text,jsonb) from public, anon, authenticated;

-- Método 2: registro en oficina por un administrador (con foto y documento según las reglas de la liga).
create or replace function public.office_register(l text, ttid uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare tt tournament_teams; pid uuid; rid uuid; num int := nullif(p->>'number', '')::int; ph text := nullif(p->>'photo_path', ''); cons jsonb;
begin
  if not is_league_admin(l, 'registration') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'registration') then raise exception 'Tu plan no incluye esa función'; end if;
  select * into tt from tournament_teams where id = ttid and league_id = l and status = 'active';
  if tt.id is null then raise exception 'Equipo no encontrado'; end if;
  cons := consent_check(l, p, 'office');
  pid := upsert_player(l, p, 'pending');
  if ph is not null then
    if ph !~ ('^' || l || '/[0-9a-f-]{36}/[A-Za-z0-9._-]+$') then raise exception 'Datos no válidos'; end if;
    update league_players set photo_path = ph where id = pid;
  end if;
  perform check_can_activate(l, pid);
  rid := add_registration(l, tt, pid, num, 'active', 'office', cons);
  perform log_action(l, 'player.register', jsonb_build_object('player', pid, 'registration', rid, 'team', tt.id, 'via', 'office'));
  return rid;
end $$;

-- Método 1a: el delegado del equipo vinculado registra a su gente. Queda pendiente si la liga pide aprobación.
create or replace function public.delegate_targets(c text, t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', tt.id, 'league_id', tt.league_id, 'league', lg.name, 'tournament', tn.name, 'team', tt.name, 'rules', reg_rules(tt.league_id),
      'privacy', case when coalesce(trim(lg.settings->'privacy'->>'notice'), '') = '' then null else jsonb_build_object('notice', lg.settings->'privacy'->>'notice', 'contact', lg.settings->'privacy'->>'contact', 'version', (lg.settings->'privacy'->>'version')::int) end) order by tn.name)
    from tournament_teams tt join league_teams lt on lt.id = tt.link_id and lt.club_id = c and lt.team_id = t and lt.status = 'approved'
    join tournaments tn on tn.id = tt.tournament_id join leagues lg on lg.id = tt.league_id where tt.status = 'active' and tn.status <> 'finished'), '[]');
end $$;

create or replace function public.delegate_register(c text, t text, ttid uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tt tournament_teams; pid uuid; rid uuid; cons jsonb; st text := 'pending';
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if not rate_ok('delegate', auth.uid()::text, 60, 3600) then return jsonb_build_object('error', 'rate', 'message', 'Demasiados intentos; espera unos minutos'); end if;
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 3000 then return jsonb_build_object('error', 'data', 'message', 'Datos no válidos'); end if;
  select tt2.* into tt from tournament_teams tt2 join league_teams lt on lt.id = tt2.link_id and lt.club_id = c and lt.team_id = t and lt.status = 'approved'
   where tt2.id = ttid and tt2.status = 'active';
  if tt.id is null then return jsonb_build_object('error', 'data', 'message', 'Equipo no encontrado'); end if;
  begin
    if not league_feature(tt.league_id, 'registration') then raise exception 'Tu plan no incluye esa función'; end if;
    if (select status from tournaments where id = tt.tournament_id) = 'finished' then raise exception 'El torneo ya terminó'; end if;
    cons := consent_check(tt.league_id, p, 'delegate');
    pid := upsert_player(tt.league_id, p, 'pending', false);
    rid := add_registration(tt.league_id, tt, pid, null, st, 'delegate', cons);
    perform log_action(tt.league_id, 'player.submit', jsonb_build_object('player', pid, 'registration', rid, 'team', tt.id, 'via', 'delegate'));
  exception when others then
    return jsonb_build_object('error', 'data', 'message', case when sqlstate = 'P0001' then sqlerrm else 'Datos no válidos' end);
  end;
  return jsonb_build_object('ok', true, 'registration', rid, 'status', st);
end $$;

create or replace function public.delegate_registrations(c text, t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'name', lp.name, 'status', pr.status, 'number', pr.number, 'team', tt.name, 'created_at', pr.created_at) order by pr.created_at desc)
    from player_registrations pr join league_players lp on lp.id = pr.player_id join tournament_teams tt on tt.id = pr.team_id join league_teams lt on lt.id = tt.link_id and lt.club_id = c and lt.team_id = t
    where pr.status <> 'removed'), '[]');
end $$;

-- Método 1b: enlace de registro. Lo crea la liga para un equipo; quien lo recibe manda sus datos y queda pendiente de aprobación.
create or replace function public.create_reg_link(l text, ttid uuid, max_uses int default 30, days int default 14) returns text
language plpgsql security definer set search_path = public as $$
declare raw text; c text;
begin
  if not is_league_admin(l, 'registration') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'registration') then raise exception 'Tu plan no incluye esa función'; end if;
  if not exists (select 1 from tournament_teams where id = ttid and league_id = l and status = 'active') then raise exception 'Equipo no encontrado'; end if;
  if max_uses is null or max_uses < 1 or max_uses > 200 or days is null or days < 1 or days > 90 then raise exception 'Datos no válidos'; end if;
  raw := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 12));
  c := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
  insert into registration_links (code, league_id, team_id, max_uses, expires_at, created_by) values (c, l, ttid, max_uses, now() + make_interval(days => days), auth.uid());
  perform log_action(l, 'reglink.create', jsonb_build_object('code_end', right(c, 4), 'team', ttid, 'max_uses', max_uses));
  return c;
end $$;

create or replace function public.revoke_reg_link(l text, c text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_league_admin(l, 'registration') then raise exception 'Sin permiso'; end if;
  update registration_links set active = false where code = c and league_id = l;
  perform log_action(l, 'reglink.revoke', jsonb_build_object('code_end', right(c, 4)));
end $$;

create or replace function public.reg_link_info(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid text := upper(regexp_replace(left(coalesce(p_code, ''), 40), '[^A-Za-z0-9]', '', 'g')); x record; pv jsonb;
begin
  if not rate_ok('reglink-info', client_key(), 30, 600) then return jsonb_build_object('error', 'rate'); end if;
  select rl.*, lg.name as lname, lg.settings as lset, tn.name as tname, tt.name as team into x from registration_links rl join leagues lg on lg.id = rl.league_id join tournament_teams tt on tt.id = rl.team_id join tournaments tn on tn.id = tt.tournament_id
   where rl.code = substr(cid, 1, 4) || '-' || substr(cid, 5, 4) || '-' || substr(cid, 9, 4) and rl.active and rl.expires_at > now() and rl.uses < rl.max_uses and tt.status = 'active' and tn.status <> 'finished';
  if x.code is null then return jsonb_build_object('error', 'invalid'); end if;
  pv := coalesce(x.lset->'privacy', '{}');
  return jsonb_build_object('league', x.lname, 'tournament', x.tname, 'team', x.team, 'rules', reg_rules(x.league_id) - 'delegate_approval',
    'privacy', case when coalesce(trim(pv->>'notice'), '') = '' then null else jsonb_build_object('notice', pv->>'notice', 'contact', pv->>'contact', 'version', (pv->>'version')::int) end);
end $$;

create or replace function public.register_by_link(p_code text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid text := upper(regexp_replace(left(coalesce(p_code, ''), 40), '[^A-Za-z0-9]', '', 'g')); rl registration_links; tt tournament_teams; pid uuid; rid uuid; cons jsonb;
begin
  -- Los topes se cuentan ANTES de cualquier error (los errores se devuelven, no se lanzan, para que el conteo no se deshaga).
  if not rate_ok('reglink-ip', client_key(), 10, 600) then return jsonb_build_object('error', 'rate'); end if;
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 3000 then return jsonb_build_object('error', 'data', 'message', 'Datos no válidos'); end if;
  select * into rl from registration_links where code = substr(cid, 1, 4) || '-' || substr(cid, 5, 4) || '-' || substr(cid, 9, 4) and active and expires_at > now() and uses < max_uses for update;
  if rl.code is null then return jsonb_build_object('error', 'invalid'); end if;
  if not rate_ok('reglink-code', rl.code, 40, 3600) then return jsonb_build_object('error', 'rate'); end if;
  select * into tt from tournament_teams where id = rl.team_id and status = 'active';
  if tt.id is null or (select status from tournaments where id = tt.tournament_id) = 'finished' then return jsonb_build_object('error', 'invalid'); end if;
  begin
    cons := consent_check(rl.league_id, p, 'link');
    pid := upsert_player(rl.league_id, p, 'pending', false);
    if conflict_msg(tt.tournament_id, pid) is not null then
      -- Ya inscrito en este torneo: se responde igual que un registro normal (no se revela nada) y la liga lo ve en la bitácora.
      perform log_action(rl.league_id, 'player.submit_duplicate', jsonb_build_object('player', pid, 'team', tt.id, 'via', 'link', 'code_end', right(rl.code, 4)));
    else
      rid := add_registration(rl.league_id, tt, pid, null, 'pending', 'link', cons);
      perform log_action(rl.league_id, 'player.submit', jsonb_build_object('player', pid, 'registration', rid, 'team', tt.id, 'via', 'link', 'code_end', right(rl.code, 4)));
    end if;
  exception when others then
    return jsonb_build_object('error', 'data', 'message', case when sqlstate = 'P0001' then sqlerrm else 'Datos no válidos' end);
  end;
  update registration_links set uses = uses + 1 where code = rl.code;
  return jsonb_build_object('ok', true, 'team', tt.name);
end $$;

create or replace function public.decide_registration(l text, rid uuid, approve boolean, num int default null, why text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r player_registrations;
begin
  if not is_league_admin(l, 'registration') then raise exception 'Sin permiso'; end if;
  select * into r from player_registrations where id = rid and league_id = l and status = 'pending' for update;
  if r.id is null then raise exception 'ya no está pendiente'; end if;
  if approve then
    perform check_can_activate(l, r.player_id);
    if num is not null and exists (select 1 from player_registrations where team_id = r.team_id and number = num and status = 'active') then raise exception 'Ese número ya lo usa otro jugador del equipo'; end if;
    update player_registrations set status = 'active', number = num, decided_by = auth.uid(), decided_at = now() where id = rid;
    update league_players set status = 'active', updated_at = now() where id = r.player_id;
  else
    update player_registrations set status = 'rejected', note = nullif(left(trim(coalesce(why, '')), 200), ''), decided_by = auth.uid(), decided_at = now() where id = rid;
    if not exists (select 1 from player_registrations where player_id = r.player_id and status in ('pending','active')) and not exists (select 1 from player_registrations where player_id = r.player_id and status = 'removed') then
      update league_players set status = 'inactive' where id = r.player_id and status = 'pending';
    end if;
  end if;
  perform log_action(l, case when approve then 'player.approve' else 'player.reject' end, jsonb_build_object('player', r.player_id, 'registration', rid, 'team', r.team_id, 'number', num, 'note', left(why, 200)));
end $$;

create or replace function public.remove_registration(l text, rid uuid, why text) returns void
language plpgsql security definer set search_path = public as $$
declare r player_registrations;
begin
  if not is_league_admin(l, 'registration') then raise exception 'Sin permiso'; end if;
  if length(trim(coalesce(why, ''))) < 3 then raise exception 'Escribe el motivo'; end if;
  select * into r from player_registrations where id = rid and league_id = l and status in ('pending','active') for update;
  if r.id is null then raise exception 'Registro no encontrado'; end if;
  update player_registrations set status = 'removed', note = left(trim(why), 200), decided_by = auth.uid(), decided_at = now() where id = rid;
  perform log_action(l, 'player.remove', jsonb_build_object('player', r.player_id, 'registration', rid, 'team', r.team_id, 'reason', left(why, 200)));
end $$;

create or replace function public.update_league_player(l text, pid uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cur league_players; nm text; dn text; ph text := nullif(p->>'photo_path', '');
begin
  if not is_league_admin(l, 'registration') then raise exception 'Sin permiso'; end if;
  select * into cur from league_players where id = pid and league_id = l for update;
  if cur.id is null then raise exception 'Jugador no encontrado'; end if;
  nm := case when p ? 'name' then left(trim(p->>'name'), 80) else cur.name end;
  dn := case when p ? 'doc_id' then nullif(upper(regexp_replace(coalesce(p->>'doc_id', ''), '[^A-Za-z0-9]', '', 'g')), '') else cur.doc_norm end;
  if ph is not null and ph !~ ('^' || l || '/[0-9a-f-]{36}/[A-Za-z0-9._-]+$') then raise exception 'Datos no válidos'; end if;
  begin
    update league_players set name = nm, norm = norm_name(nm), birth_date = case when p ? 'birth_date' then nullif(p->>'birth_date', '')::date else birth_date end,
      doc_id = case when p ? 'doc_id' then nullif(left(trim(p->>'doc_id'), 30), '') else doc_id end, doc_norm = dn, photo_path = coalesce(ph, photo_path), updated_at = now() where id = pid;
  exception when unique_violation then raise exception 'Ya existe un jugador con esos datos';
  end;
  perform log_action(l, 'player.update', jsonb_build_object('player', pid, 'before', jsonb_build_object('name', cur.name, 'birth_date', cur.birth_date, 'doc', cur.doc_norm is not null, 'photo', cur.photo_path is not null),
    'after', jsonb_build_object('name', nm, 'birth_date', p->>'birth_date', 'doc', dn is not null, 'photo', coalesce(ph, cur.photo_path) is not null)));
end $$;

grant execute on function public.set_registration_rules(text,jsonb), public.registration_rules(text), public.office_register(text,uuid,jsonb), public.delegate_targets(text,text),
  public.delegate_register(text,text,uuid,jsonb), public.delegate_registrations(text,text), public.create_reg_link(text,uuid,int,int), public.revoke_reg_link(text,text),
  public.decide_registration(text,uuid,boolean,int,text), public.remove_registration(text,uuid,text), public.update_league_player(text,uuid,jsonb) to authenticated;
-- Estas dos las usa quien recibe el enlace, sin cuenta. Solo exponen nombres de liga/equipo y reciben datos con tope por enlace.
grant execute on function public.reg_link_info(text), public.register_by_link(text,jsonb) to anon, authenticated;

-- Marca de la liga (credenciales y página pública): color y logo. El logo vive en el bucket público de imágenes, en la carpeta de quien lo sube.
create or replace function public.set_league_brand(l text, color text, logo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare cur jsonb;
begin
  if not is_league_admin(l, 'settings') then raise exception 'Sin permiso'; end if;
  if color is null or color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Datos no válidos'; end if;
  -- logo = ruta dentro del almacén público "photos", en la carpeta de quien lo sube, y el archivo debe existir.
  if logo is not null and (logo !~ ('^' || auth.uid()::text || '/league-[a-z0-9-]{1,60}-[0-9]{1,15}\.(png|jpg|jpeg|webp)$')
      or not exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name = logo)) then raise exception 'Datos no válidos'; end if;
  select settings->'brand' into cur from leagues where id = l;
  update leagues set settings = jsonb_set(settings, '{brand}', jsonb_build_object('color', lower(color), 'logo_path', coalesce(logo, cur->>'logo_path'))) where id = l;
  perform log_action(l, 'league.brand', jsonb_build_object('color', lower(color), 'logo_changed', logo is not null));
end $$;
create or replace function public.league_brand(l text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_league_admin(l) then raise exception 'Sin permiso'; end if;
  return jsonb_build_object('color', coalesce((select settings->'brand'->>'color' from leagues where id = l), '#c8102e'), 'logo_path', (select settings->'brand'->>'logo_path' from leagues where id = l));
end $$;
grant execute on function public.set_league_brand(text,text,text), public.league_brand(text) to authenticated;

-- ============ Etapa 8 del producto: página pública, acta por foto y chatbot ============
-- Página pública: opcional (apagada por omisión). Las funciones públicas solo devuelven lo que ya es público en cualquier liga:
-- nombres de equipos, calendario, marcadores, tabla y (si la liga lo permite) goleadores. Nunca contactos, documentos, fotos, fechas de nacimiento,
-- finanzas, sanciones ni notas internas. Los nombres de quien recibe tarjetas no salen.
create or replace function public.public_settings(l text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s jsonb := coalesce((select settings->'public' from leagues where id = l), '{}'); pv jsonb := coalesce((select settings->'privacy' from leagues where id = l), '{}'); r jsonb;
begin
  r := jsonb_build_object('enabled', false, 'names', 'off', 'details', true, 'chat', false, 'chat_daily', 100, 'tz', 'America/Tijuana') || (s - 'scorers');
  if (pv->>'minors')::boolean is true then r := r || jsonb_build_object('names', 'off'); end if;   -- con menores, nunca se publican nombres
  return r || jsonb_build_object('minors', coalesce((pv->>'minors')::boolean, false));
end $$;
revoke all on function public.public_settings(text) from public, anon, authenticated;

drop function if exists public.set_public_page(text,boolean,boolean,boolean,int);
create or replace function public.set_public_page(l text, s jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cur jsonb := public_settings(l); n jsonb;
begin
  if not is_league_admin(l, 'settings') then raise exception 'Sin permiso'; end if;
  if s is null or jsonb_typeof(s) <> 'object' then raise exception 'Datos no válidos'; end if;
  n := jsonb_build_object('enabled', coalesce(s->'enabled', cur->'enabled'), 'names', coalesce(s->'names', cur->'names'), 'details', coalesce(s->'details', cur->'details'),
    'chat', coalesce(s->'chat', cur->'chat'), 'chat_daily', coalesce(s->'chat_daily', cur->'chat_daily'), 'tz', coalesce(s->'tz', cur->'tz'));
  if jsonb_typeof(n->'enabled') <> 'boolean' or jsonb_typeof(n->'details') <> 'boolean' or jsonb_typeof(n->'chat') <> 'boolean'
     or (n->>'names') not in ('off', 'initials', 'full') or jsonb_typeof(n->'chat_daily') <> 'number' or (n->>'chat_daily') !~ '^[0-9]{1,4}$' or (n->>'chat_daily')::int > 5000
     or not exists (select 1 from pg_timezone_names where name = n->>'tz') then raise exception 'Datos no válidos'; end if;
  if (n->>'names') <> 'off' and (cur->>'minors')::boolean then raise exception 'Con menores de edad no se publican nombres'; end if;
  if (n->>'enabled')::boolean and not league_feature(l, 'public_page') then raise exception 'Tu plan no incluye esa función'; end if;
  update leagues set settings = jsonb_set(settings, '{public}', n) where id = l;
  perform log_action(l, 'public.settings', n);
end $$;
create or replace function public.public_page_state(l text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_league_admin(l) then raise exception 'Sin permiso'; end if;
  return public_settings(l);
end $$;

-- "Pepe Pérez López" -> "Pepe P." (para publicar nombres sin apellido completo).
create or replace function public.short_name(n text) returns text
language sql immutable set search_path = public as $$
  select case when array_length(w, 1) > 1 then w[1] || ' ' || left(w[2], 1) || '.' else w[1] end
  from (select regexp_split_to_array(trim(coalesce(n, '')), '\s+') as w) x $$;
revoke all on function public.short_name(text) from public, anon;

create or replace function public.public_league(l text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ps jsonb; lg leagues;
begin
  if not rate_ok('public-ip', client_key(), 600, 600) then return jsonb_build_object('error', 'rate'); end if;
  ps := public_settings(l);
  select * into lg from leagues where id = l;
  if lg.id is null or not (ps->>'enabled')::boolean or not league_feature(l, 'public_page') then return jsonb_build_object('error', 'not_found'); end if;
  return jsonb_build_object('league', jsonb_build_object('id', lg.id, 'name', lg.name, 'brand', jsonb_build_object('color', coalesce(lg.settings->'brand'->>'color', '#c8102e'), 'logo_path', lg.settings->'brand'->>'logo_path')),
    'chat', (ps->>'chat')::boolean,
    'privacy', case when coalesce(trim(lg.settings->'privacy'->>'notice'), '') = '' then null else jsonb_build_object('notice', lg.settings->'privacy'->>'notice', 'contact', lg.settings->'privacy'->>'contact') end,
    'tournaments', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'season', t.season, 'category', t.category, 'modality', t.modality, 'status', t.status) order by t.created_at desc)
      from tournaments t where t.league_id = l and t.status in ('published','paused','finished')), '[]'));
end $$;

create or replace function public.public_tournament(l text, tid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ps jsonb; t tournaments; nm text; dt boolean;
begin
  if not rate_ok('public-ip', client_key(), 600, 600) then return jsonb_build_object('error', 'rate'); end if;
  ps := public_settings(l);
  select * into t from tournaments where id = tid and league_id = l and status in ('published','paused','finished');
  if t.id is null or not (ps->>'enabled')::boolean or not league_feature(l, 'public_page') then return jsonb_build_object('error', 'not_found'); end if;
  nm := ps->>'names'; dt := (ps->>'details')::boolean;
  return jsonb_build_object(
    'tournament', jsonb_build_object('id', t.id, 'name', t.name, 'season', t.season, 'category', t.category, 'modality', t.modality, 'status', t.status, 'pts_win', t.pts_win, 'pts_draw', t.pts_draw, 'pts_loss', t.pts_loss, 'tiebreakers', t.tiebreakers),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'status', x.status) order by x.name) from tournament_teams x where x.tournament_id = tid), '[]'),
    'matches', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'round', m.round, 'starts_at', case when dt then to_jsonb(m.starts_at) else to_jsonb(to_char((m.starts_at at time zone (ps->>'tz'))::date, 'YYYY-MM-DD')) end, 'venue', case when dt then m.venue end,
        'home_id', m.home_id, 'away_id', m.away_id, 'status', m.status, 'home_goals', m.home_goals, 'away_goals', m.away_goals) order by m.starts_at nulls last, m.round)
      from league_matches m where m.tournament_id = tid), '[]'),
    'events', coalesce((select jsonb_agg(jsonb_build_object('match_id', e.match_id, 'team_id', e.team_id, 'kind', e.kind, 'n', e.n,
        'player', case when e.kind = 'goal' and nm = 'full' then e.player when e.kind = 'goal' and nm = 'initials' then short_name(e.player) else '' end))
      from match_events e join league_matches m on m.id = e.match_id where m.tournament_id = tid and e.kind in ('goal','yellow','red')), '[]'),
    'adjust', coalesce((select jsonb_agg(jsonb_build_object('team_id', team_id, 'points', pts)) from (select team_id, sum(points)::int as pts from sanctions where tournament_id = tid and kind = 'puntos' and status <> 'revoked' group by team_id) s), '[]'),
    'scorers', nm <> 'off', 'names', nm, 'details', dt);
end $$;
grant execute on function public.set_public_page(text,jsonb), public.public_page_state(text) to authenticated;
grant execute on function public.public_league(text), public.public_tournament(text,uuid) to anon, authenticated;


-- =====================================================================================================
-- Etapa 7: actas digitalizadas desde foto.
-- La foto del acta (el original) se guarda en un bucket PRIVADO y no se borra. Un borrador (a mano o leído por OCR)
-- no cambia nada oficial: solo "confirm_acta" registra el resultado, con la misma función que usa la captura manual.
-- =====================================================================================================
do $$ begin
  if not exists (select 1 from public.schema_migrations where id = '2026-10-plan-actas') then
    update public.plans set features = array_append(features, 'actas') where id = 'league-base' and not ('actas' = any(features));
    insert into public.schema_migrations (id) values ('2026-10-plan-actas');
  end if;
end $$;

insert into storage.buckets (id, name, public) values ('actas', 'actas', false) on conflict (id) do nothing;
drop policy if exists actas_write on storage.objects;
create policy actas_write on storage.objects for insert with check (bucket_id = 'actas' and is_league_admin((storage.foldername(name))[1], 'results'));
drop policy if exists actas_read on storage.objects;
create policy actas_read on storage.objects for select using (bucket_id = 'actas' and is_league_admin((storage.foldername(name))[1], 'results'));
-- A propósito no hay políticas de update ni delete: el original queda como evidencia.

create table if not exists public.acta_uploads (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues(id) on delete cascade,
  match_id uuid not null references public.league_matches(id) on delete cascade,
  path text not null check (path like league_id || '/%' and length(path) <= 300),
  status text not null default 'pending' check (status in ('pending','confirmed','discarded')),
  draft jsonb,
  engine text check (engine in ('manual','browser','server')),
  ocr_text text check (length(ocr_text) <= 8000),
  discard_reason text check (length(discard_reason) <= 200),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz
);
create index if not exists acta_uploads_match on public.acta_uploads (match_id, created_at desc);
alter table public.acta_uploads enable row level security;
drop policy if exists acta_read on public.acta_uploads;
create policy acta_read on public.acta_uploads for select using (is_league_admin(league_id, 'results'));
grant select on public.acta_uploads to authenticated;

create or replace function public.create_acta(l text, mid uuid, p_path text) returns uuid
language plpgsql security definer set search_path = public as $$
declare m league_matches; nid uuid;
begin
  if not is_league_admin(l, 'results') then raise exception 'Sin permiso'; end if;
  if not league_feature(l, 'actas') then raise exception 'Tu plan no incluye esa función'; end if;
  select * into m from league_matches where id = mid and league_id = l;
  if m.id is null then raise exception 'Partido no encontrado'; end if;
  if (select status from tournaments where id = m.tournament_id) = 'finished' then raise exception 'El torneo ya terminó'; end if;
  if p_path is null or p_path not like l || '/%' or length(p_path) > 300 then raise exception 'Datos no válidos'; end if;
  if (select count(*) from acta_uploads where match_id = mid and status = 'pending') >= 5 then raise exception 'Demasiadas actas pendientes'; end if;
  insert into acta_uploads (league_id, match_id, path) values (l, mid, p_path) returning acta_uploads.id into nid;
  perform log_action(l, 'acta.upload', jsonb_build_object('acta', nid, 'match', mid));
  return nid;
end $$;

-- Guarda lo que se leyó o escribió. Sigue siendo un borrador: no toca el partido.
create or replace function public.save_acta_draft(l text, aid uuid, p_draft jsonb, p_engine text, p_text text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a acta_uploads;
begin
  if not is_league_admin(l, 'results') then raise exception 'Sin permiso'; end if;
  select * into a from acta_uploads where id = aid and league_id = l and status = 'pending' for update;
  if a.id is null then raise exception 'Acta no encontrada'; end if;
  if jsonb_typeof(p_draft) <> 'object' or length(p_draft::text) > 20000 or p_engine not in ('manual','browser','server') then raise exception 'Datos no válidos'; end if;
  if p_draft ? 'events' and (jsonb_typeof(p_draft->'events') <> 'array' or jsonb_array_length(p_draft->'events') > 100) then raise exception 'Datos no válidos'; end if;
  if (p_draft ? 'hg' and jsonb_typeof(p_draft->'hg') <> 'null' and (jsonb_typeof(p_draft->'hg') <> 'number' or (p_draft->>'hg') !~ '^[0-9]{1,2}$'))
     or (p_draft ? 'ag' and jsonb_typeof(p_draft->'ag') <> 'null' and (jsonb_typeof(p_draft->'ag') <> 'number' or (p_draft->>'ag') !~ '^[0-9]{1,2}$')) then raise exception 'Datos no válidos'; end if;
  update acta_uploads set draft = p_draft, engine = p_engine, ocr_text = left(p_text, 8000) where id = aid;
end $$;

-- Confirmación humana: recién aquí el resultado pasa a ser oficial. Usa record_result, así que aplica las mismas reglas.
create or replace function public.confirm_acta(l text, aid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a acta_uploads; m league_matches; d jsonb;
begin
  if not is_league_admin(l, 'results') then raise exception 'Sin permiso'; end if;
  select * into a from acta_uploads where id = aid and league_id = l and status = 'pending' for update;
  if a.id is null then raise exception 'Acta no encontrada'; end if;
  d := a.draft;
  if d is null or d->>'hg' is null or d->>'ag' is null then raise exception 'Falta el marcador en el borrador'; end if;
  select * into m from league_matches where id = a.match_id for update;
  if m.status = 'played' then raise exception 'Ese partido ya tiene resultado'; end if;
  perform record_result(l, a.match_id, (d->>'hg')::int, (d->>'ag')::int, coalesce(d->'events', '[]'), d->>'note');
  update acta_uploads set status = 'confirmed', decided_by = auth.uid(), decided_at = now() where id = aid;
  perform log_action(l, 'acta.confirm', jsonb_build_object('acta', aid, 'match', a.match_id, 'engine', a.engine));
end $$;

create or replace function public.discard_acta(l text, aid uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a acta_uploads;
begin
  if not is_league_admin(l, 'results') then raise exception 'Sin permiso'; end if;
  select * into a from acta_uploads where id = aid and league_id = l and status = 'pending' for update;
  if a.id is null then raise exception 'Acta no encontrada'; end if;
  update acta_uploads set status = 'discarded', discard_reason = left(trim(coalesce(p_reason, '')), 200), decided_by = auth.uid(), decided_at = now() where id = aid;
  perform log_action(l, 'acta.discard', jsonb_build_object('acta', aid, 'match', a.match_id));
end $$;

revoke all on function public.create_acta(text,uuid,text), public.save_acta_draft(text,uuid,jsonb,text,text), public.confirm_acta(text,uuid), public.discard_acta(text,uuid,text) from public, anon;
grant execute on function public.create_acta(text,uuid,text), public.save_acta_draft(text,uuid,jsonb,text,text), public.confirm_acta(text,uuid), public.discard_acta(text,uuid,text) to authenticated;

-- =====================================================================================================
-- Etapa 7b: control de costo del asistente de la liga.
-- El asistente solo ve los datos públicos (public_tournament). Cada pregunta que cueste dinero (un modelo de lenguaje
-- detrás de un servicio propio) debe pasar antes por chat_take: tope diario por liga que fija la propia liga.
-- La respuesta local por reglas no cuesta y no pasa por aquí.
-- =====================================================================================================
create table if not exists public.chat_usage (
  league_id text not null references public.leagues(id) on delete cascade,
  day date not null default current_date,
  n int not null default 0,
  primary key (league_id, day)
);
alter table public.chat_usage enable row level security;   -- sin políticas: nadie la lee ni escribe directo

create or replace function public.chat_take(l text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ps jsonb := public_settings(l); lim int; cnt int; dia date;
begin
  if not exists (select 1 from leagues where id = l) or not (ps->>'enabled')::boolean or not (ps->>'chat')::boolean or not league_feature(l, 'public_page') then
    return jsonb_build_object('ok', false, 'error', 'off'); end if;
  if not rate_ok('chat-ip', l || ':' || client_key(), 20, 3600) then return jsonb_build_object('ok', false, 'error', 'rate'); end if;
  lim := (ps->>'chat_daily')::int; dia := (now() at time zone (ps->>'tz'))::date;
  if lim <= 0 then return jsonb_build_object('ok', false, 'error', 'limit', 'limit', lim); end if;
  insert into chat_usage as u (league_id, day, n) values (l, dia, 1)
    on conflict (league_id, day) do update set n = u.n + 1 where u.n < lim returning u.n into cnt;
  if cnt is null then return jsonb_build_object('ok', false, 'error', 'limit', 'limit', lim); end if;
  return jsonb_build_object('ok', true, 'remaining', lim - cnt, 'limit', lim);
end $$;
revoke all on function public.chat_take(text) from public;
grant execute on function public.chat_take(text) to anon, authenticated;

-- Uso de hoy, para que la liga vea cuánto lleva (solo administradores con permiso de ajustes).
create or replace function public.chat_usage_today(l text) returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_league_admin(l, 'settings') then raise exception 'Sin permiso'; end if;
  return coalesce((select n from chat_usage where league_id = l and day = (now() at time zone (public_settings(l)->>'tz'))::date), 0);
end $$;
revoke all on function public.chat_usage_today(text) from public, anon;
grant execute on function public.chat_usage_today(text) to authenticated;

-- =====================================================================================================
-- Etapa 9: almacenes con límites de tamaño y tipo, privacidad por liga y derecho a borrar datos.
-- =====================================================================================================
-- Tamaño máximo y tipos permitidos por almacén (Supabase los aplica al subir). Los privados se fuerzan a privados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('player-photos', 'player-photos', false, 1048576, array['image/jpeg','image/png','image/webp']),
  ('actas', 'actas', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Quién puede subir qué y dónde (lo usan las políticas de storage). Valida forma de la ruta, permiso, plan y, en actas, que el partido sea de esa liga.
create or replace function public.storage_can_write(b text, p text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare f text[] := string_to_array(coalesce(p, ''), '/');
begin
  if b = 'player-photos' then
    return p ~ '^[a-z0-9-]{1,45}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}\.(jpg|jpeg|png|webp)$' and is_league_admin(f[1], 'registration') and league_feature(f[1], 'registration');
  elsif b = 'actas' then
    return p ~ '^[a-z0-9-]{1,45}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' and is_league_admin(f[1], 'results') and league_feature(f[1], 'actas')
      and exists (select 1 from league_matches m where m.id::text = f[2] and m.league_id = f[1]);
  end if;
  return false;
end $$;
revoke all on function public.storage_can_write(text,text) from public, anon;
grant execute on function public.storage_can_write(text,text) to authenticated;

drop policy if exists pphotos_write on storage.objects;
create policy pphotos_write on storage.objects for insert with check (bucket_id = 'player-photos' and storage_can_write(bucket_id, name));
drop policy if exists pphotos_delete on storage.objects;   -- para borrar la foto de quien pide que se eliminen sus datos
create policy pphotos_delete on storage.objects for delete using (bucket_id = 'player-photos' and is_league_admin((storage.foldername(name))[1], 'registration'));
drop policy if exists actas_write on storage.objects;
create policy actas_write on storage.objects for insert with check (bucket_id = 'actas' and storage_can_write(bucket_id, name));
-- El almacén público "photos" se sirve por URL pública; listar su contenido por la API ya no está abierto a todos (solo tu propia carpeta).
drop policy if exists photos_read on storage.objects;
create policy photos_read on storage.objects for select using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Aviso de privacidad y datos de contacto por liga. La versión sube cada vez que cambia el texto: lo aceptado queda ligado a su versión.
create or replace function public.set_privacy(l text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur jsonb := coalesce((select settings->'privacy' from leagues where id = l), '{}'); nt text; ct text; mn boolean; v int;
begin
  if not is_league_admin(l, 'settings') then raise exception 'Sin permiso'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Datos no válidos'; end if;
  nt := trim(coalesce(p->>'notice', '')); ct := left(trim(coalesce(p->>'contact', '')), 160); mn := coalesce((p->>'minors')::boolean, false);
  if length(nt) > 8000 or (length(nt) > 0 and length(nt) < 80) then raise exception 'El aviso debe tener entre 80 y 8000 caracteres'; end if;
  if length(nt) > 0 and length(ct) < 5 then raise exception 'Indica un contacto para dudas de privacidad'; end if;
  v := coalesce((cur->>'version')::int, 0) + case when nt is distinct from coalesce(cur->>'notice', '') then 1 else 0 end;
  update leagues set settings = jsonb_set(settings, '{privacy}', jsonb_build_object('notice', nullif(nt, ''), 'contact', nullif(ct, ''), 'minors', mn, 'version', v, 'updated_at', now())) where id = l;
  if mn then update leagues set settings = jsonb_set(settings, '{public,names}', '"off"') where id = l and settings ? 'public'; end if;
  perform log_action(l, 'privacy.update', jsonb_build_object('version', v, 'minors', mn));
  return jsonb_build_object('version', v);
end $$;
create or replace function public.privacy_state(l text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_league_admin(l) then raise exception 'Sin permiso'; end if;
  return jsonb_build_object('notice', null, 'contact', null, 'minors', false, 'version', 0) || coalesce((select settings->'privacy' from leagues where id = l), '{}');
end $$;

-- Derecho a borrar: se quitan nombre, fecha de nacimiento, documento y foto; queda un registro anónimo para no romper el historial.
-- Devuelve la ruta de la foto para que la app la borre del almacén. Los nombres escritos a mano en actas y goles no se tocan (son resultados).
create or replace function public.forget_player(l text, pid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare pl league_players;
begin
  if not is_league_admin(l, 'registration') then raise exception 'Sin permiso'; end if;
  select * into pl from league_players where id = pid and league_id = l for update;
  if pl.id is null then raise exception 'Jugador no encontrado'; end if;
  update player_registrations set status = 'removed', note = 'Datos eliminados a petición', consent = null where player_id = pid and status in ('pending','active');
  update player_registrations set consent = null where player_id = pid;
  update league_players set name = 'Jugador eliminado', norm = 'eliminado-' || pid::text, birth_date = null, doc_id = null, doc_norm = 'ELIM' || replace(pid::text, '-', ''), photo_path = null, status = 'inactive', updated_at = now() where id = pid;
  perform log_action(l, 'player.forget', jsonb_build_object('player', pid));
  return pl.photo_path;
end $$;
grant execute on function public.set_privacy(text,jsonb), public.privacy_state(text), public.forget_player(text,uuid) to authenticated;

-- Finanzas de los equipos creados en la app: privadas por omisión (solo miembros aprobados). El administrador puede abrirlas a quien tenga el enlace.
-- Los equipos de archivo (Diablos y el ejemplo) siguen como siempre: su dueño publica sus propios archivos.
create or replace function public.finance_public(c text, t text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from team_docs where club_id = c and team_id = t) then true
              else coalesce((select (data->>'finance_public')::boolean from team_docs where club_id = c and team_id = t), false) end $$;
revoke all on function public.finance_public(text,text) from public, anon, authenticated;

create or replace function public.team_doc(c text, t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when finance_public(c, t) or is_member(c, t) or is_admin(c, t) then data else data - 'finance' end
  from team_docs where club_id = c and team_id = t $$;
revoke all on function public.team_doc(text,text) from public;
grant execute on function public.team_doc(text,text) to anon, authenticated;

create or replace function public.team_paid(c text, t text)
returns table (kind text, item text, player_id text, amount numeric, detail text, decided_at timestamptz)
language sql stable security definer set search_path = public as $$
  select kind, item, player_id, amount, detail, decided_at from payments
  where club_id = c and team_id = t and status = 'approved' and (finance_public(c, t) or is_member(c, t) or is_admin(c, t)) order by decided_at $$;

create or replace function public.set_finance_public(c text, t text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(c, t) then raise exception 'Sin permiso'; end if;
  if not exists (select 1 from team_docs where club_id = c and team_id = t) then raise exception 'Este equipo se administra desde archivos'; end if;
  update team_docs set data = data || jsonb_build_object('finance_public', coalesce(p_on, false)) where club_id = c and team_id = t;
end $$;
grant execute on function public.set_finance_public(text,text,boolean) to authenticated;

-- =====================================================================================================
-- Endurecimiento: los visitantes sin cuenta (anon) solo pueden ejecutar las funciones públicas de abajo.
-- (En Postgres toda función nueva es ejecutable por PUBLIC y Supabase además la abre a anon; cada función ya valida
-- permisos por dentro, esto cierra la puerta antes de llegar.) Quien ya podía ejecutarlas con sesión (authenticated) sigue pudiendo;
-- las funciones internas que ya estaban cerradas para todos siguen cerradas. Se vuelve a aplicar en cada corrida del archivo.
-- =====================================================================================================
do $$
declare f record; keep oid[] := '{}';
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind in ('f', 'p') and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    if has_function_privilege('authenticated', f.oid, 'execute') then keep := keep || f.oid; end if;
  end loop;
  for f in select p.oid, p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind in ('f', 'p') and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.oid = any(keep) then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;
grant execute on function public.claimed(text,text), public.team_paid(text,text), public.team_doc(text,text), public.reg_link_info(text), public.register_by_link(text,jsonb),
  public.public_league(text), public.public_tournament(text,uuid), public.chat_take(text) to anon;
