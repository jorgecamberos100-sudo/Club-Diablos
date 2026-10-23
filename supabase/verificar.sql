-- Verificación de seguridad después de aplicar schema.sql en Supabase.
-- SOLO LEE: no cambia nada. Pégalo en SQL Editor > New query y toca Run. Cada fila debe decir "OK".
-- Si alguna dice "REVISAR", no actives la app todavía: vuelve a correr schema.sql completo y repite esta verificación.
with
anon_fn as (
  select string_agg(p.proname, ',' order by p.proname) as f
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and has_function_privilege('anon', p.oid, 'execute')
),
sin_rls as (
  select string_agg(c.relname, ', ') as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
),
bk as (
  select id, public, file_size_limit, allowed_mime_types from storage.buckets where id in ('photos', 'receipts', 'player-photos', 'actas')
),
pol as (
  select string_agg(policyname, ',' order by policyname) as p from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname in ('photos_read','photos_write','photos_update','receipts_read','receipts_write','pphotos_read','pphotos_write','pphotos_update','pphotos_delete','actas_read','actas_write')
),
peligrosas as (   -- políticas de storage que dejarían borrar o cambiar actas
  select count(*) as n from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual like '%''actas''%' or with_check like '%''actas''%') and cmd in ('UPDATE', 'DELETE', 'ALL')
)
select 1 as n, 'Todas las tablas tienen RLS (permisos por fila)' as revision,
       case when (select t from sin_rls) is null then 'OK' else 'REVISAR: sin RLS -> ' || (select t from sin_rls) end as resultado
union all
select 2, 'Sin cuenta solo se ejecutan las funciones públicas',
       case when (select f from anon_fn) = 'chat_take,claimed,public_league,public_tournament,reg_link_info,register_by_link,team_doc,team_paid' then 'OK' else 'REVISAR: ' || coalesce((select f from anon_fn), '(ninguna)') end
union all
select 3, 'Almacenes privados siguen privados',
       case when (select count(*) from bk where id in ('receipts', 'player-photos', 'actas') and not public) = 3 then 'OK' else 'REVISAR: algún almacén privado es público o no existe' end
union all
select 4, 'Todos los almacenes tienen tope de tamaño y solo imágenes',
       case when (select count(*) from bk where file_size_limit between 1 and 5242880 and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']) = 4 then 'OK' else 'REVISAR: falta tope o hay tipos de archivo de más' end
union all
select 5, 'Políticas de almacenamiento completas',
       case when (select p from pol) = 'actas_read,actas_write,photos_read,photos_update,photos_write,pphotos_delete,pphotos_read,pphotos_update,pphotos_write,receipts_read,receipts_write' then 'OK' else 'REVISAR: ' || coalesce((select p from pol), '(ninguna)') end
union all
select 6, 'Las actas no se pueden borrar ni cambiar',
       case when (select n from peligrosas) = 0 then 'OK' else 'REVISAR: hay una política que permite cambiar o borrar actas' end
union all
select 7, 'Secreto interno generado (huellas de IP)',
       case when exists (select 1 from public.app_secret where id = 1 and length(salt) >= 64) then 'OK' else 'REVISAR: vuelve a correr schema.sql' end
union all
select 8, 'Planes cargados (sin precios definidos)',
       case when (select count(*) from public.plans where id in ('team-free', 'team-pro', 'league-base')) = 3 and not exists (select 1 from public.plans where price_monthly is not null or price_annual is not null) then 'OK'
            else 'REVISAR: faltan planes o ya tienen precio (la app no cobra)' end
union all
select 9, 'La tabla de equipos no se lee directo (finanzas privadas)',
       case when not has_table_privilege('anon', 'public.team_docs', 'select') and not has_table_privilege('authenticated', 'public.team_docs', 'select') then 'OK' else 'REVISAR: team_docs abierta' end
union all
select 10, 'Nadie escribe directo en la tabla de ligas',
       case when not has_table_privilege('authenticated', 'public.leagues', 'update') and not has_table_privilege('anon', 'public.leagues', 'update') then 'OK' else 'REVISAR: leagues permite UPDATE directo' end
order by 1;
