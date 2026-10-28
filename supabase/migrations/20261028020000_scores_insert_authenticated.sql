-- SPEC 12: solo los usuarios con sesión y perfil pueden guardar marcas, con su propio username.

drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_own" on public.scores
  for insert to authenticated
  with check (name = (select username from public.profiles where id = auth.uid()));
