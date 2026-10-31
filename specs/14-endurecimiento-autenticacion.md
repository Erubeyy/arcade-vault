# SPEC 14 — Endurecimiento de la autenticación (recuperación, callback, scores con `user_id` y avatar)

> **Estado:** Borrador
> **Depende de:** SPEC 04, SPEC 06, SPEC 12, SPEC 13
> **Fecha:** 2026-10-30
> **Objetivo:** Cerrar los hallazgos de la revisión de seguridad de la capa de autenticación: proteger el cambio de contraseña, endurecer `/auth/callback`, neutralizar la enumeración de correos, vincular las marcas a la cuenta con `scores.user_id` y dejar de cargar avatares de dominios externos.

## Por qué existe este spec

Una revisión manual de la capa de auth (2026-10-30, tomando SPEC 12 y 13 como línea base) no encontró fallos críticos, pero sí varios puntos que el SPEC 13 no cubría porque se centró en RLS, headers y grants. Este spec recoge los hallazgos que se decidió corregir ahora.

Estado real revisado antes de redactar:

- `components/reset-form.tsx:29` llama a `supabase.auth.updateUser({ password })` con cualquier sesión activa (`ready` o `needs-profile`), no solo con una sesión de recuperación. Una sesión robada o un equipo desbloqueado permiten cambiar la contraseña sin reautenticar.
- `app/auth/callback/route.ts:20` hace `new URL(process.env.SITE_URL)`: si la variable está mal escrita lanza una excepción y la ruta responde 500. Además, cuando llega `next` el callback redirige sin comprobar si el usuario tiene perfil.
- `components/auth-form.tsx:73` muestra «Ese correo ya está registrado» cuando `data.user.identities` viene vacío, lo que permite saber si un correo tiene cuenta. El flujo de recuperación (`components/recover-form.tsx`) ya es neutro.
- `scores` guarda solo `name` (texto). `profiles` tiene `on delete cascade` desde `auth.users`, así que al borrar una cuenta se libera su username y quien lo registre después aparece como autor de las marcas antiguas.
- `lib/session.tsx:30` (`avatarFrom`) acepta cualquier URL `https://` de `user_metadata`, que el usuario controla, y `components/user-badge.tsx` la carga en un `<img>`.
- Las migraciones actuales conceden `insert (game_id, name, score)` en `scores` a `authenticated` y la política es `scores_insert_own` (`name = username` del perfil).

Decisiones ya cerradas con el usuario antes de redactar:

- **Entra:** cuenta y recuperación (#2, #6, #8), enumeración de correo (#4), identidad en `scores` (#5), avatar (#9) y la lista de configuración del panel de Supabase.
- **No entra:** CAPTCHA («no integres captcha por ahora»), antifraude de puntajes (#1) y CSP (#3).
- **Cambio de contraseña:** activar «Secure password change» en Supabase y mostrar el formulario de `/restablecer` solo para sesiones de recuperación.
- **Enumeración:** mensaje neutro en el registro.
- **Avatar:** no mostrar avatares externos; el insignia usa siempre la inicial del username.
- **`scores.user_id`:** modelo recomendado por el asistente (ver Decisiones).

## Alcance

**Dentro:**

- **Cambio de contraseña (#2):**
  - Activar en el panel de Supabase la opción «Secure password change» (Auth → Sign In / Providers → Email) para que `updateUser({ password })` exija una sesión reciente.
  - Hacer que `/restablecer` solo muestre el formulario cuando la sesión viene de un enlace de recuperación; con cualquier otra sesión (o sin sesión) muestra el aviso de «enlace no válido o caducado» con el botón `SOLICITAR ENLACE NUEVO`.
- **`/auth/callback` (#6 y #8):**
  - Leer `SITE_URL` con un `try/catch`; si no es una URL válida se ignora y se usa `origin`, sin lanzar excepción.
  - Comprobar el perfil antes de aplicar `next`: si el usuario no tiene perfil, ir siempre a `/perfil/completar`.
- **Registro (#4):** cuando Supabase devuelve un usuario sin identidades (correo ya registrado), mostrar el mismo panel `REVISA TU CORREO` que en un registro nuevo, con texto que no confirma si la cuenta existía.
- **`scores.user_id` (#5):**
  - Migración que añade `user_id`, la rellena para las marcas existentes que se puedan atribuir con seguridad y endurece la política de insert.
  - Regenerar `lib/supabase/database.types.ts`.
  - Sin cambios en `components/game-player.tsx`: el valor lo fija la base de datos.
- **Avatar (#9):** eliminar `avatarUrl` de `User` y de `lib/session.tsx`, y simplificar `components/user-badge.tsx` y `components/nav.tsx` para mostrar siempre la inicial del username.
- **Configuración manual en Supabase** (panel, no versionable), anotada en la descripción del PR y en el checklist:
  - Auth → URL Configuration: Redirect URLs sin comodines (`*`), solo las URLs de producción y `http://localhost:3000/auth/callback`.
  - Definir `SITE_URL` en el entorno de producción.
  - «Secure password change» activado.
- Actualizar `references/security/security-checklist.md`, `references/security/audit-log.md` y `CLAUDE.md`.

**Fuera de alcance (para specs futuros):**

- **CAPTCHA** (Turnstile/hCaptcha) en login y registro. Decisión del usuario: no integrarlo por ahora.
- **Antifraude de puntajes** (#1): hoy cualquier usuario con sesión puede insertar por la API REST una marca de hasta 10.000.000. Este spec solo vincula la marca a la cuenta; no valida su valor.
- **CSP con nonce** (#3).
- Pedir la contraseña actual en el formulario de cambio de contraseña.
- Pantalla de «cambiar contraseña» o «borrar cuenta» dentro de la app.
- Leaked password protection (requiere plan Pro, ya documentado en SPEC 13).
- Rate limiting propio en la app.
- Tests automatizados.

## Modelo de datos

Una columna nueva en `scores` y una política de insert más estricta:

```sql
-- supabase/migrations/<timestamp>_scores_user_id.sql
alter table public.scores
  add column user_id uuid default auth.uid()
  references auth.users (id) on delete cascade;

-- Marcas existentes: solo se atribuyen las creadas después del perfil de ese username.
update public.scores s
set user_id = p.id
from public.profiles p
where p.username = s.name
  and s.created_at >= p.created_at;

create index scores_user_id_idx on public.scores (user_id);

drop policy "scores_insert_own" on public.scores;
create policy "scores_insert_own" on public.scores
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and name = (select username from public.profiles where id = (select auth.uid()))
  );
```

Convenciones:

- `user_id` es `null` para las marcas que no se pueden atribuir (por ejemplo, las de `INVITADO` o las anteriores al perfil del username); se siguen mostrando por `name`.
- El cliente sigue insertando solo `(game_id, name, score)`: la migración de SPEC 13 limita el `grant insert` a esas columnas, así que `user_id` siempre sale del `default auth.uid()` y no puede falsearse.
- `user_id` queda legible por `select` público, igual que `profiles.id`, que ya es público.

```ts
// lib/session.tsx — el tipo User pierde avatarUrl
export interface User {
  id: string;
  email: string | null;
  username: string | null; // null = autenticado sin perfil
}
```

## Plan de implementación

1. **Línea base.** Ejecutar el advisor de seguridad, listar `pg_policies` de `scores`, la lista de migraciones remotas y `select count(*) from scores where name in (select username from profiles)`. Anotarlo en la descripción del PR.
2. **Avatar.** Eliminar `avatarFrom` y `avatarUrl` de `lib/session.tsx`; quitar el `<img>` y el `eslint-disable` de `components/user-badge.tsx` y la prop `avatarUrl` de las dos llamadas en `components/nav.tsx`. Revisar los estilos de `.user-badge .avatar` en `app/globals.css`. Manual: el nav muestra la inicial con sesión Google o GitHub. `npm run lint` pasa.
3. **Callback.** En `app/auth/callback/route.ts`, extraer la lectura de `SITE_URL` a una función con `try/catch` que devuelve `null` si no es válida, y mover la comprobación de perfil antes de aplicar `next`. Manual con `curl`: `SITE_URL=mal-escrita` no produce 500, y un usuario OAuth sin perfil con `next=/biblioteca` termina en `/perfil/completar`.
4. **Registro neutro.** En `components/auth-form.tsx`, cuando `data.user.identities?.length === 0` llamar a `setSentTo(email.trim())` en lugar de `setError`. Ajustar el texto del panel `REVISA TU CORREO` a «Si el correo es nuevo, enviamos un enlace de confirmación». Manual: registrar un correo ya existente muestra el mismo panel que uno nuevo.
5. **Migración de `scores.user_id`.** Crear `supabase/migrations/<timestamp>_scores_user_id.sql` con el SQL del modelo de datos, aplicarla con el MCP de Supabase y regenerar `lib/supabase/database.types.ts`. Verificar con SQL que `user_id` quedó rellenado solo para marcas posteriores al perfil. Manual: guardar una marca con sesión sigue funcionando y la fila queda con `user_id = auth.uid()`.
6. **Recuperación.** Determinar con un flujo real de recuperación qué distingue la sesión de recuperación. Opción preferida: el claim `amr` de `getClaims()` contiene `recovery`. Si no aparece, el callback fija una cookie `httpOnly` de 10 minutos solo cuando `next` es `/restablecer`. Convertir `app/restablecer/page.tsx` para que valide esa señal en el servidor, pasar el resultado a `components/reset-form.tsx` y mostrar el aviso de enlace no válido en los demás casos. Manual: abrir `/restablecer` con una sesión normal muestra el aviso; con el enlace del correo muestra el formulario.
7. **Panel de Supabase.** Activar «Secure password change», revisar que las Redirect URLs no tengan comodines y definir `SITE_URL` en producción. Anotar los valores en la descripción del PR. Comprobar que `updateUser({ password })` con una sesión antigua es rechazado.
8. **Cierre.** Actualizar `references/security/security-checklist.md` y `audit-log.md`, añadir a `CLAUDE.md` una nota breve (`scores.user_id`, sin avatares externos, `/restablecer` solo en recuperación, pendientes), pasar este spec a `Implementado` y correr `npm run lint` y `npm run build`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `select column_name from information_schema.columns where table_name = 'scores' and column_name = 'user_id'` devuelve una fila.
- [ ] `pg_policies` de `scores` contiene `scores_insert_own` con `user_id = (select auth.uid())` y la comparación de `name` con el username del perfil.
- [ ] Guardar una marca con sesión crea una fila con `user_id` igual al `id` del usuario y sin que `components/game-player.tsx` envíe `user_id`.
- [ ] Un `insert` en `scores` por la API REST que incluya `user_id` de otro usuario es rechazado (por el `grant` por columnas o por RLS).
- [ ] Las marcas anteriores al `created_at` del perfil con el mismo username tienen `user_id` nulo; las posteriores, el `id` del perfil.
- [ ] Borrar un usuario de prueba elimina sus marcas y libera su username sin que otro usuario aparezca como autor de ellas.
- [ ] `grep -rn "avatarUrl\|avatar_url\|picture" app components lib` no devuelve resultados fuera de `database.types.ts`.
- [ ] El nav muestra la inicial del username con sesión de Google y de GitHub, y no hace peticiones a dominios de avatares.
- [ ] `curl -I "/auth/callback?code=x"` con `SITE_URL=no-es-una-url` responde con redirección a `/login?error=enlace` y no con 500.
- [ ] Un usuario autenticado sin perfil que entra por `/auth/callback?code=...&next=/biblioteca` termina en `/perfil/completar`.
- [ ] Registrar un correo ya existente muestra el mismo panel `REVISA TU CORREO` que uno nuevo, sin el texto «ya está registrado».
- [ ] Abrir `/restablecer` con una sesión normal o sin sesión muestra el aviso de enlace no válido y no el formulario.
- [ ] Abrir `/restablecer` desde el enlace de un correo de recuperación muestra el formulario y permite guardar la nueva contraseña.
- [ ] Con «Secure password change» activo, `updateUser({ password })` con una sesión antigua es rechazado por el servidor.
- [ ] El panel de Supabase muestra Redirect URLs sin `*` y `SITE_URL` definida en producción, anotado en el PR.
- [ ] `references/security/security-checklist.md` y `audit-log.md` reflejan el estado real tras el cambio.

## Decisiones tomadas y descartadas

- **Sí:** «Secure password change» más acceso a `/restablecer` solo en recuperación. El servidor impone el límite y la comprobación en la página evita mostrar un formulario que fallaría. Elegido por el asistente por indicación del usuario («la que recomiendes»).
- **No:** pedir la contraseña actual. No sirve para cuentas solo OAuth y añade un formulario que hoy no existe; la reautenticación de Supabase cubre el mismo riesgo.
- **No:** distinguir la sesión de recuperación con el evento `PASSWORD_RECOVERY` en el cliente. El callback intercambia el `code` en el servidor (PKCE), así que ese evento no llega con fiabilidad al navegador. La señal se valida en el servidor.
- **Sí:** `user_id uuid default auth.uid()` en `scores` con `on delete cascade`. Borrar una cuenta elimina sus marcas, de modo que el username liberado no hereda nada. Es una mejora sobre la propuesta inicial de `on delete set null`, que habría dejado marcas huérfanas visibles bajo un nombre reutilizable.
- **Sí:** columna nullable. Las marcas anteriores a SPEC 12 se crearon sin sesión y con cualquier nombre; atribuirlas a quien registró ese username después sería repetir el problema.
- **Sí:** el backfill solo asigna marcas con `created_at >= profiles.created_at`.
- **No:** `user_id not null` borrando las huérfanas. Destruye datos del leaderboard sin necesidad.
- **No:** tabla `reserved_usernames`. Resuelve la herencia pero no vincula marcas a cuentas, que es lo que prepara el antifraude futuro.
- **Sí:** el cliente no envía `user_id`. El `grant insert (game_id, name, score)` de SPEC 13 ya impide fijarlo, así que se evita un cambio en `components/game-player.tsx` y un valor falsificable.
- **Sí:** mensaje neutro en el registro. Cierra la enumeración de correos y es coherente con `/recuperar`. El coste es que el usuario con cuenta no sabe que ya la tenía; puede recuperar su acceso con «¿Olvidaste tu contraseña?».
- **No:** CAPTCHA. Decisión del usuario; los rate limits por IP de Supabase (SPEC 13) siguen siendo la única barrera anti-bot.
- **Sí:** quitar los avatares externos. Elimina un `<img>` con URL controlada por el usuario y la excepción de lint; el insignia con inicial ya existía como alternativa.
- **No:** lista blanca de hosts de avatar. Más código para conservar un adorno.
- **Sí:** el username sigue siendo comprobable por consulta pública en el registro. Es público por diseño (SPEC 12) y no se trata aquí.
- **No:** mover la cuenta de usuario a su propio flujo de «cambiar contraseña» dentro de la app. Se dejaría para otro spec si hace falta.

## Riesgos identificados

| Riesgo                                                                                           | Mitigación                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| El claim `amr` no distingue la sesión de recuperación                                            | El paso 6 lo comprueba con un flujo real y, si falla, usa la cookie `httpOnly` de 10 minutos fijada por el callback.                      |
| La política nueva rechaza inserts legítimos si `default auth.uid()` no se aplica                 | El paso 5 guarda una marca real antes de cerrar; si falla, revertir con la política anterior de la migración `20261028044422`.            |
| Cambiar la política y la columna en una migración deja un hueco de inserts mientras se despliega | Se aplica en una sola migración (transacción); el código de cliente no cambia, así que no hay versión intermedia.                         |
| `on delete cascade` borra marcas al eliminar una cuenta y baja `plays` de `games_with_stats`     | Es el comportamiento buscado; la app no tiene hoy flujo de borrar cuenta, solo se hace desde el panel.                                    |
| La caché de leaderboard no se invalida al borrar una cuenta desde el panel                       | Las páginas se refrescan solas al caducar la caché; no se añade invalidación manual.                                                      |
| El backfill atribuye una marca a un usuario equivocado                                           | Solo se atribuyen marcas posteriores al perfil; las demás quedan en `null`. Se revisa el conteo en el paso 1 y se compara tras el paso 5. |
| «Secure password change» bloquea el cambio de contraseña a usuarios con sesión vieja             | Es el comportamiento buscado; el usuario usa «¿Olvidaste tu contraseña?» y entra por el enlace del correo.                                |
| El mensaje neutro de registro confunde a quien ya tiene cuenta                                   | El texto del panel menciona «Si el correo es nuevo» y el botón `VOLVER A INICIAR SESIÓN` sigue visible.                                   |
| Quitar el avatar cambia el aspecto del nav y deja CSS sin usar                                   | Revisar `.user-badge .avatar` en `app/globals.css` en el paso 2 y comprobar el nav en escritorio y móvil.                                 |

## Qué **no** entra en este spec

- CAPTCHA en login y registro.
- Antifraude de puntajes y validación del valor de la marca.
- CSP con nonce.
- Pedir la contraseña actual o crear una pantalla de ajustes de cuenta.
- Flujo de borrar cuenta dentro de la app.
- Leaked password protection (plan Pro).
- Rate limiting propio y tests automatizados.

Cada uno de ellos, si llega, va en su propio spec.
