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
