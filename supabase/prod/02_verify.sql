-- Verificación de solo lectura para PRODUCCIÓN tras ejecutar 01_schema.sql.
-- Cada fila trae `esperado` y `real`; la columna `ok` debe ser true en todas.
-- Pegar en el SQL Editor y ejecutar.

with checks as (
  select 'RLS activo en games, scores y profiles' as chequeo,
         '3' as esperado,
         (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname in ('games','scores','profiles')
             and c.relrowsecurity)::text as real
  union all
  select 'Políticas en public (5, ninguna update/delete)', '5',
         (select count(*) from pg_policies where schemaname = 'public'
            and policyname in ('games_select_public','scores_select_public','scores_insert_own',
                               'profiles_select_public','profiles_insert_own')
            and cmd in ('SELECT','INSERT'))::text
  union all
  select 'Total de políticas en public', '5',
         (select count(*) from pg_policies where schemaname = 'public')::text
  union all
  select 'games_with_stats sin DML para anon/authenticated', '0',
         (select count(*) from information_schema.role_table_grants
           where table_schema = 'public' and table_name = 'games_with_stats'
             and grantee in ('anon','authenticated')
             and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE'))::text
  union all
  select 'anon sin INSERT en scores', '0',
         (select count(*) from information_schema.role_table_grants
           where table_schema = 'public' and table_name = 'scores'
             and grantee = 'anon' and privilege_type = 'INSERT')::text
  union all
  select 'authenticated: INSERT en scores solo por columnas (game_id, name, score)', 'game_id,name,score',
         (select coalesce(string_agg(column_name, ',' order by column_name), '')
            from information_schema.column_privileges
           where table_schema = 'public' and table_name = 'scores'
             and grantee = 'authenticated' and privilege_type = 'INSERT')
  union all
  select 'authenticated: INSERT en profiles solo por columnas (id, username)', 'id,username',
         (select coalesce(string_agg(column_name, ',' order by column_name), '')
            from information_schema.column_privileges
           where table_schema = 'public' and table_name = 'profiles'
             and grantee = 'authenticated' and privilege_type = 'INSERT')
  union all
  select 'EXECUTE de rls_auto_enable / handle_new_user para anon, authenticated', 'false',
         (has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')
          or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute')
          or has_function_privilege('anon', 'public.handle_new_user()', 'execute')
          or has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'))::text
  union all
  select 'Event trigger ensure_rls', '1',
         (select count(*) from pg_event_trigger where evtname = 'ensure_rls' and evtenabled = 'O')::text
  union all
  select 'Trigger on_auth_user_created en auth.users', '1',
         (select count(*) from pg_trigger
           where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass and not tgisinternal)::text
  union all
  select 'games_with_stats con security_invoker', 'true',
         (select coalesce(bool_or(coalesce(reloptions, '{}') @> array['security_invoker=true']), false)::text
            from pg_class where oid = 'public.games_with_stats'::regclass)
  union all
  select 'Juegos en el catálogo', '9',
         (select count(*) from public.games)::text
  union all
  select 'Scores / perfiles / usuarios (prod empieza limpia)', '0/0/0',
         (select count(*) from public.scores)::text || '/' ||
         (select count(*) from public.profiles)::text || '/' ||
         (select count(*) from auth.users)::text
  union all
  select 'Migraciones registradas', '10',
         (select count(*) from supabase_migrations.schema_migrations)::text
)
select chequeo, esperado, real, (esperado = real) as ok
from checks;

-- Prueba del RLS automático (ejecutar aparte; no deja nada creado gracias al rollback):
--
--   begin;
--   create table public._rls_probe (id int);
--   select relrowsecurity as rls_automatico_activo
--     from pg_class where oid = 'public._rls_probe'::regclass;   -- debe dar true
--   rollback;
