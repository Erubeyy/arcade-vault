-- GENERADO por supabase/prod/build.sh. No editar a mano: edita supabase/migrations/ y regenera.
-- Pegar completo en el SQL Editor del proyecto de PRODUCCIÓN. Corre en una sola transacción.

begin;

-- ===== 20261017011826_games_and_scores.sql =====
-- SPEC 06: tablas games y scores, vista games_with_stats, RLS y siembra del catálogo.

create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  position   int  not null unique,
  created_at timestamptz not null default now()
);

create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 10),
  score      int  not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);

create index scores_game_rank_idx on public.scores (game_id, score desc, created_at asc);

create view public.games_with_stats with (security_invoker = true) as
  select g.*, coalesce(max(s.score), 0) as best, count(s.id) as plays
  from public.games g left join public.scores s on s.game_id = g.id
  group by g.id;

-- RLS
alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);

create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

create policy "scores_insert_public" on public.scores
  for insert to anon, authenticated with check (true);

-- Sin update/delete/insert desde cliente salvo lo anterior: quitamos privilegios por defecto.
revoke insert, update, delete, truncate on public.games  from anon, authenticated;
revoke update, delete, truncate           on public.scores from anon, authenticated;

-- Siembra (copiada de lib/games.ts, position según el orden original)
insert into public.games (id, title, short, long, cat, cover, color, position) values
  ('bloque-buster', 'BLOQUE BUSTER', 'Rebota la pelota y destruye muros de neón.',
   'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
   'ARCADE', 'cover-bricks', 'cyan', 1),
  ('caida', 'CAÍDA', 'Encaja las piezas antes de que el techo te aplaste.',
   'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
   'PUZZLE', 'cover-tetro', 'magenta', 2),
  ('serpentina', 'SERPENTINA', 'Crece sin morder tu propia cola.',
   'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
   'ARCADE', 'cover-snake', 'green', 3),
  ('gloton', 'GLOTÓN', 'Devora puntos y escapa de los fantasmas.',
   'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.',
   'ARCADE', 'cover-glot', 'yellow', 4),
  ('invasores', 'INVASORES', 'Defiende el planeta de filas alienígenas.',
   'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.',
   'SHOOTER', 'cover-invaders', 'green', 5),
  ('rocas', 'ROCAS', 'Pulveriza asteroides en gravedad cero.',
   'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.',
   'SHOOTER', 'cover-rocas', 'yellow', 6),
  ('ranaria', 'RANARIA', 'Cruza la autopista de pixeles.',
   'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.',
   'ARCADE', 'cover-rana', 'green', 7),
  ('duelo-pixel', 'DUELO PIXEL', 'Dos paletas. Una pelota. Reflejos máximos.',
   'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.',
   'VERSUS', 'cover-duelo', 'cyan', 8),
  ('asteroids', 'ASTEROIDS', 'Pulveriza asteroides y sobrevive al campo de rocas.',
   'Rota tu nave con las flechas, propúlsala con inercia y dispara con ESPACIO para partir asteroides en fragmentos cada vez más pequeños. Recoge power-ups de disparo triple y escudo, y sobrevive nivel tras nivel en un mundo sin bordes.',
   'SHOOTER', 'cover-rocas', 'cyan', 9);

-- ===== 20261020031703_game_tetris.sql =====
-- SPEC 07: Tetris reemplaza el placeholder `caida` (conserva id y position).
update public.games
set title = 'TETRIS',
    short = 'Encaja las piezas, completa líneas y aguanta el ritmo.',
    long  = 'Siete piezas descienden por un tablero de 10×20. Muévelas, rótalas con ayuda de los wall kicks y déjalas caer al instante con ESPACIO; la pieza fantasma te muestra dónde aterrizará. Completa líneas para puntuar y sube de nivel cada 10: la caída se acelera sin piedad.',
    cover = 'cover-tetro',
    color = 'magenta'
where id = 'caida';

-- ===== 20261020040349_game_arkanoid.sql =====
-- SPEC 08: Arkanoid reemplaza el placeholder `bloque-buster` (conserva id, position, cat, cover y color).
update public.games
set title = 'ARKANOID',
    short = 'Rompe todos los bloques y no dejes caer la bola.',
    long  = 'Mueve la paleta y haz rebotar la bola para derribar los bloques de cada nivel. El ángulo del rebote depende del punto de la paleta donde golpea; los bloques grises aguantan dos golpes. Tienes 3 vidas y 8 niveles de figuras distintas, cada uno con una bola más rápida que el anterior. Lanza la bola con ESPACIO.'
where id = 'bloque-buster';

-- ===== 20261020044923_game_snake.sql =====
-- SPEC 09: Snake reemplaza el placeholder `serpentina` (conserva id, position, cat, cover y color).
update public.games
set title = 'SNAKE',
    short = 'Come frutas, crece y no te muerdas la cola.',
    long  = 'Guía a la serpiente con las flechas o WASD y come las frutas que aparecen al azar: cada una suma 10 puntos y te hace crecer un segmento. Los bordes del tablero son un portal, así que sales por un lado y apareces por el opuesto; lo único que mata es morderte el cuerpo. Con cada fruta la serpiente va más rápido y cada 5 frutas subes de nivel.'
where id = 'serpentina';

-- ===== 20261026035057_game_frogger.sql =====
-- SPEC 11: Frogger reemplaza el placeholder `ranaria` (conserva id, position, cat, cover y color).
update public.games
set title = 'FROGGER',
    short = 'Cruza la carretera y el río sin convertirte en papilla.',
    long  = 'Guía a tu rana con las flechas o WASD a través de una carretera repleta de coches y camiones y de un río de troncos y tortugas que se sumergen. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.'
where id = 'ranaria';

-- ===== 20261028013553_auth_profiles.sql =====
-- SPEC 12: perfiles públicos (username único) ligados a auth.users, con RLS y trigger de alta.

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique
             check (username ~ '^[A-Z0-9_]{3,10}$' and username <> 'INVITADO'),
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;

-- El username es público, igual que scores.name.
create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);

-- Flujo OAuth (/perfil/completar): cada usuario inserta solo su propia fila.
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- Sin update/delete/truncate desde cliente.
revoke insert, update, delete, truncate on public.profiles from anon;
revoke update, delete, truncate         on public.profiles from authenticated;

-- Alta por correo: con confirmación de email el cliente no tiene sesión tras signUp,
-- así que el perfil se crea aquí a partir de raw_user_meta_data.username.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'username' is not null then
    insert into public.profiles (id, username)
    values (new.id, upper(trim(new.raw_user_meta_data ->> 'username')));
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 20261028020000_scores_insert_authenticated.sql =====
-- SPEC 12: solo los usuarios con sesión y perfil pueden guardar marcas, con su propio username.

drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_own" on public.scores
  for insert to authenticated
  with check (name = (select username from public.profiles where id = auth.uid()));

-- ===== 20261028035000_rls_auto_enable.sql =====
-- Reproduce en cualquier proyecto nuevo el RLS automático que Supabase crea al aprovisionar dev.
-- Idempotente: en dev (donde ya existe) no cambia nada. Va antes de 20261028040222, que revoca su EXECUTE.

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
  tbl name;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog', 'information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        select c.relname into tbl from pg_catalog.pg_class c where c.oid = cmd.objid;
        execute format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end;
$$;

-- ===== 20261028040222_revoke_rls_auto_enable_rpc.sql =====
-- SPEC 13: rls_auto_enable() es la función del event trigger ensure_rls; no debe poder invocarse por RPC.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ===== 20261028044422_security_hardening.sql =====
-- Endurecimiento tras la auditoría de seguridad (SEC-002 a SEC-006).

-- SEC-002: la vista games_with_stats es de solo lectura.
revoke insert, update, delete, truncate on public.games_with_stats from anon, authenticated;

-- SEC-003: anon no inserta marcas; RLS ya lo bloqueaba, ahora también el privilegio.
revoke insert on public.scores from anon;

-- SEC-004: insert por columnas; el cliente no puede fijar created_at (ni id en scores).
revoke insert on public.scores from authenticated;
grant insert (game_id, name, score) on public.scores to authenticated;

revoke insert on public.profiles from authenticated;
grant insert (id, username) on public.profiles to authenticated;

-- SEC-005: las funciones nuevas de public no quedan ejecutables por RPC por defecto.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- SEC-006: auth.uid() envuelto en select para evaluarlo una sola vez por consulta.
drop policy "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy "scores_insert_own" on public.scores;
create policy "scores_insert_own" on public.scores
  for insert to authenticated
  with check (name = (select username from public.profiles where id = (select auth.uid())));

-- ===== Historial de migraciones (alineado con el CLI de Supabase) =====
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text not null primary key,
  statements text[],
  name       text
);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261017011826', 'games_and_scores'),
  ('20261020031703', 'game_tetris'),
  ('20261020040349', 'game_arkanoid'),
  ('20261020044923', 'game_snake'),
  ('20261026035057', 'game_frogger'),
  ('20261028013553', 'auth_profiles'),
  ('20261028020000', 'scores_insert_authenticated'),
  ('20261028035000', 'rls_auto_enable'),
  ('20261028040222', 'revoke_rls_auto_enable_rpc'),
  ('20261028044422', 'security_hardening')
on conflict (version) do nothing;

commit;
