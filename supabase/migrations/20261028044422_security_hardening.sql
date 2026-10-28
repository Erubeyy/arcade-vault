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
