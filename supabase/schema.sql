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
