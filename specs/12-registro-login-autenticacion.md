# SPEC 12 — Registro, login y autenticación con Supabase Auth

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 04, SPEC 06
> **Fecha:** 2026-10-27
> **Objetivo:** Sustituir el login simulado de `/login` por autenticación real con Supabase Auth (correo y contraseña, Google y GitHub), con username único público, recuperación de contraseña y guardado de marcas reservado a usuarios con sesión.

## Por qué existe este spec

Hoy `/login` es una maqueta: `AuthForm` guarda un nombre cualquiera en `localStorage` (`av_user`) sin validar nada, y los botones de Google y GitHub no hacen nada. Cualquiera puede escribir en `scores` con el nombre que quiera, porque la política `scores_insert_public` permite el insert a `anon`.

Decisiones ya cerradas con el usuario antes de redactar:

- Métodos: correo + contraseña **y** OAuth (Google y GitHub).
- El invitado se mantiene: puede navegar y jugar, pero **no guarda marcas**.
- Identidad pública: `username` único, guardado en una tabla `profiles`.
- Las marcas **no** se vinculan a la cuenta con `user_id` (otro spec). La identidad en `scores` sigue siendo `scores.name`, que ahora debe coincidir con el `username` del usuario.
- Se exige confirmar el correo; hay recuperación de contraseña.
- Ninguna ruta exige sesión; solo el guardado de marcas.
- `lib/session.tsx` se reescribe sobre Supabase Auth manteniendo la API `useSession()`.
- `proxy.ts` solo refresca cookies de sesión; no redirige ni bloquea.
- `av_user` y `av_scores` se eliminan de `localStorage`.

Es una spec grande (base de datos, 4 pantallas nuevas, proxy, sesión). El plan va en pasos que dejan la app funcionando para poder commitearlos por separado.

## Alcance

**Dentro:**

- Tabla `public.profiles` (`id` → `auth.users`, `username` único) con RLS, y un trigger `on_auth_user_created` que crea el perfil cuando el registro trae `username` en `raw_user_meta_data`. Migración `supabase/migrations/20261027120000_auth_profiles.sql`.
- Regla de username: 3 a 10 caracteres, `A-Z`, `0-9` y `_`, guardado en mayúsculas, único, y `INVITADO` reservado. La misma regla se valida en cliente (`lib/auth.ts`) y en la base (`check`).
- Contraseña de al menos 8 caracteres.
- `/login` con dos pestañas sobre el `AuthForm` actual:
  - **Iniciar sesión:** correo + contraseña, enlace «¿Olvidaste tu contraseña?» a `/recuperar`.
  - **Crear cuenta:** username + correo + contraseña. Comprueba antes que el username esté libre (consulta pública a `profiles`). Tras `signUp` muestra un panel «REVISA TU CORREO» con el correo usado y la opción de reenviar el enlace.
  - **OAuth:** botones GOOGLE y GITHUB con `signInWithOAuth`.
  - **Invitado:** «JUGAR COMO INVITADO» navega a `/biblioteca` sin sesión.
  - Errores de Supabase traducidos a español (credenciales incorrectas, correo sin confirmar, username ocupado, correo ya registrado, demasiados intentos, error de red), con estado de envío que deshabilita el botón.
- Ruta `app/auth/callback/route.ts`: canjea el `code` (PKCE) por sesión y redirige a `next` (solo rutas internas), a `/perfil/completar` si el usuario no tiene perfil, o a `/biblioteca` por defecto. Si el canje falla redirige a `/login?error=enlace`.
- Pantalla `/perfil/completar`: formulario de username para quien entró por OAuth sin perfil. Inserta su fila en `profiles`. Sin perfil completo puede navegar pero no guardar marcas.
- Pantallas `/recuperar` (pide el correo y llama a `resetPasswordForEmail` con `redirectTo` a `/auth/callback?next=/restablecer`) y `/restablecer` (nueva contraseña + confirmación, requiere la sesión de recuperación; sin sesión muestra un aviso con enlace a `/recuperar`). Al terminar redirige a `/biblioteca`.
- `proxy.ts` en la raíz (convención de Next 16, ver `node_modules/next/dist/docs/01-app/` sección proxy) con el helper `lib/supabase/proxy.ts` (`updateSession`) que refresca la sesión y reescribe las cookies. Matcher que excluye estáticos e imágenes. No redirige nada.
- Reescritura de `lib/session.tsx`: `SessionProvider` escucha `supabase.auth.onAuthStateChange`, carga el perfil y expone `useSession()` con `{ user, status, signOut }`, donde `status` es `"loading" | "guest" | "needs-profile" | "ready"`. Se eliminan `login`, `saveScore`, `av_user` y `av_scores`.
- `components/nav.tsx`: con sesión muestra `username · SALIR` (de escritorio y menú móvil); con `needs-profile` muestra un enlace «COMPLETAR PERFIL»; sin sesión mantiene el acceso a `/login`.
- Migración `supabase/migrations/20261027130000_scores_insert_authenticated.sql`: elimina `scores_insert_public` y crea `scores_insert_own` para `authenticated`, con `check` que exige que `name` coincida con el `username` del perfil del usuario (`auth.uid()`).
- `components/game-player.tsx`: el nombre guardado sale siempre de `user.username` (el campo de iniciales desaparece para usuarios con sesión). Sin sesión, el modal de fin de partida no ofrece guardar y muestra «INICIA SESIÓN PARA GUARDAR TU MARCA» con enlace a `/login`; con `needs-profile`, el enlace va a `/perfil/completar`. Se elimina la copia local `av_scores`.
- `components/hall-of-fame.tsx`: «TU MEJOR MARCA» se calcula con una consulta a Supabase (mejor `score` de `scores` con `game_id` y `name = username`) en lugar de `av_scores`.
- Regenerar `lib/supabase/database.types.ts` con la tabla `profiles`.
- Configuración manual del proyecto Supabase (no se puede versionar): Site URL, Redirect URLs, «Confirm email» activo, longitud mínima de contraseña 8 y proveedores Google y GitHub con sus credenciales.

**Fuera de alcance (para specs futuros):**

- Vincular marcas a la cuenta con `scores.user_id` y migrar marcas antiguas.
- Cambiar username, correo o contraseña desde una pantalla de perfil; avatar; borrar cuenta.
- Rutas protegidas, roles y redirecciones forzadas a `/login`.
- Magic link, autenticación en dos pasos y otros proveedores OAuth.
- Plantillas de correo personalizadas y SMTP propio (se usa el de Supabase).
- Antifraude de puntuaciones: el cliente sigue enviando el `score` sin validación servidor.
- Fusionar cuentas con el mismo correo entre proveedores.
- Pestaña «mis marcas» o historial del usuario.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```sql
-- supabase/migrations/20261027120000_auth_profiles.sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique
             check (username ~ '^[A-Z0-9_]{3,10}$' and username <> 'INVITADO'),
  created_at timestamptz not null default now()
);

-- RLS
-- select: anon, authenticated (el username es público, igual que scores.name)
-- insert: authenticated con id = auth.uid() (flujo OAuth en /perfil/completar)
-- update/delete: ninguno desde cliente

-- Trigger security definer sobre auth.users:
-- si raw_user_meta_data->>'username' existe, inserta el perfil con upper(username)
```

```sql
-- supabase/migrations/20261027130000_scores_insert_authenticated.sql
drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_own" on public.scores
  for insert to authenticated
  with check (name = (select username from public.profiles where id = auth.uid()));
```

```ts
// lib/auth.ts
export const USERNAME_RE = /^[A-Z0-9_]{3,10}$/;
export const PASSWORD_MIN = 8;
export function normalizeUsername(raw: string): string; // trim + toUpperCase
export function validateUsername(u: string): string | null; // mensaje de error o null
export function validatePassword(p: string): string | null;
export function authErrorMessage(error: {
  code?: string;
  message: string;
}): string;
```

```ts
// lib/session.tsx
export interface User {
  id: string;
  email: string | null;
  username: string | null; // null = autenticado sin perfil
}
export type SessionStatus = "loading" | "guest" | "needs-profile" | "ready";
interface SessionValue {
  user: User | null;
  status: SessionStatus;
  signOut: () => Promise<void>;
}
```

Convenciones:

- `username` se guarda siempre en mayúsculas; el formulario lo normaliza al escribir.
- El `username` del perfil es el valor que se escribe en `scores.name`.
- Las marcas de invitado ya existentes en `scores` se quedan como están.

## Plan de implementación

1. **Configuración manual en Supabase** (panel): Site URL `http://localhost:3000`, Redirect URLs con `http://localhost:3000/**`, «Confirm email» activo, contraseña mínima 8, y proveedores Google y GitHub con sus client id y secret (callback `https://<proyecto>.supabase.co/auth/v1/callback`). Anotarlo en la descripción del PR.
2. **Migración de perfiles.** Crear `20261027120000_auth_profiles.sql`, aplicarla y regenerar `lib/supabase/database.types.ts`. Verificar con el advisor de seguridad de Supabase que `profiles` tiene RLS.
3. **Proxy.** Crear `lib/supabase/proxy.ts` (`updateSession`) y `proxy.ts` con el matcher. Quitar el comentario obsoleto sobre el proxy en `lib/supabase/server.ts`. La app sigue igual; las cookies de sesión ya se refrescan.
4. **Helpers de validación.** Crear `lib/auth.ts` con las reglas y los mensajes de error en español.
5. **Sesión real.** Reescribir `lib/session.tsx` sobre Supabase Auth y actualizar `components/nav.tsx`. Para no romper el guardado todavía, `game-player` y `hall-of-fame` usan `user?.username` donde antes usaban `user?.name` y conservan por ahora `av_scores`.
6. **Login y registro por correo.** Reescribir `components/auth-form.tsx`: pestañas, validación, comprobación de username libre, panel «REVISA TU CORREO», reenvío, mensajes de error e invitado. Los botones OAuth se quedan desactivados con la etiqueta «PRÓXIMAMENTE» hasta el paso 7.
7. **Callback, OAuth y perfil.** Crear `app/auth/callback/route.ts`, activar los botones GOOGLE y GITHUB, y crear `app/perfil/completar/page.tsx` con su formulario.
8. **Recuperación.** Crear `app/recuperar/page.tsx` y `app/restablecer/page.tsx`, y el enlace «¿Olvidaste tu contraseña?» en `/login`.
9. **Marcas solo con sesión.** Aplicar `20261027130000_scores_insert_authenticated.sql`, cambiar `game-player` (nombre desde `username`, modal para invitado, sin `saveScore`) y `hall-of-fame` (mejor marca desde Supabase). Borrar `saveScore`, `SavedScore` y las claves `av_user` y `av_scores`.
10. **Cierre.** Actualizar `CLAUDE.md` (tabla de specs, sección Supabase y rutas) y pasar el estado de este spec a `Implementado`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] En `/login`, crear una cuenta con username, correo y contraseña de 8 o más caracteres muestra el panel «REVISA TU CORREO» y no inicia sesión hasta confirmar.
- [ ] Tras abrir el enlace del correo se llega a `/biblioteca` con sesión y la nav muestra `USERNAME · SALIR`.
- [ ] Se rechaza, con mensaje en español, un username de 2 caracteres, de 11 caracteres, con espacios o símbolos, `INVITADO`, o uno ya existente (sin importar mayúsculas).
- [ ] Se rechaza una contraseña de menos de 8 caracteres antes de llamar a Supabase.
- [ ] Iniciar sesión con credenciales incorrectas muestra «correo o contraseña incorrectos» y no navega.
- [ ] Iniciar sesión con un correo sin confirmar muestra un mensaje que lo indica.
- [ ] Recargar la página en cualquier ruta conserva la sesión, y «SALIR» la cierra y la nav vuelve a mostrar el acceso.
- [ ] El botón GOOGLE y el botón GITHUB inician el flujo OAuth y vuelven a la app con sesión.
- [ ] Un usuario OAuth sin perfil es redirigido a `/perfil/completar`, y tras elegir un username válido y libre puede guardar marcas.
- [ ] Un usuario autenticado sin perfil puede navegar y jugar, y el modal de fin de partida le ofrece completar el perfil en lugar de guardar.
- [ ] «JUGAR COMO INVITADO» lleva a `/biblioteca` sin sesión; el invitado juega y al terminar la partida el modal no tiene botón de guardar y enlaza a `/login`.
- [ ] Un usuario con perfil que termina una partida guarda su marca con `scores.name` igual a su `username` y aparece en el leaderboard de `/juegos/[id]` y en `/salon`.
- [ ] Un `insert` en `scores` con la clave pública y sin sesión es rechazado por RLS, y uno con sesión pero con un `name` distinto al `username` también.
- [ ] `/recuperar` envía un correo y el enlace lleva a `/restablecer`, donde la nueva contraseña (mínimo 8, con confirmación coincidente) permite iniciar sesión con ella.
- [ ] Abrir `/restablecer` sin sesión de recuperación muestra el aviso con enlace a `/recuperar` y no el formulario.
- [ ] `/auth/callback` con un `code` inválido redirige a `/login?error=enlace` y muestra el mensaje de enlace caducado.
- [ ] `/auth/callback?next=https://otro-sitio.com` ignora `next` y redirige a `/biblioteca`.
- [ ] En el hall of fame, «TU MEJOR MARCA» sale de Supabase y se muestra solo con sesión y perfil.
- [ ] `grep -rn "av_user\|av_scores" app components lib` no devuelve resultados.
- [ ] El formulario de `/login` es usable a 375 px de ancho y en tema claro y oscuro.

## Decisiones tomadas y descartadas

- **Sí:** Supabase Auth con correo y contraseña más Google y GitHub. Ya existe el cliente `@supabase/ssr` (SPEC 04) y los botones sociales ya están en la maqueta.
- **No:** magic link. Cambia el diseño del formulario y no se pidió.
- **Sí:** tabla `profiles` con `username` único. Evita exponer el correo y da un nombre público estable para el leaderboard.
- **Sí:** crear el perfil con un trigger en `auth.users` cuando el registro trae `username`. Con confirmación de correo, el cliente no tiene sesión justo después del `signUp` y no podría insertar su perfil.
- **Sí:** `/perfil/completar` obligatorio para OAuth, y no autogenerar el username. Evita nombres feos o colisiones en el ranking.
- **Sí:** invitado que juega pero no guarda. Obliga a tener cuenta para aparecer en el leaderboard sin cerrar el juego.
- **Sí:** reforzar eso con RLS (`scores_insert_own`), no solo en la UI. Es la única forma de que el bloqueo sea real.
- **No:** `scores.user_id`. El usuario lo dejó para otro spec; mientras tanto la política vincula la marca a la cuenta por `name = username`.
- **Sí:** eliminar `av_scores`, aunque el usuario aceptaba mantenerla. Obliga a que «mi mejor marca» salga de Supabase y no de un dato local que diverge entre dispositivos.
- **Sí:** reescribir `lib/session.tsx` conservando `useSession()`. Nav, player y hall of fame casi no cambian.
- **No:** leer la sesión en servidor desde el layout. Choca con `cacheComponents` y obliga a reorganizar el layout.
- **Sí:** `proxy.ts` que solo refresca cookies. Es el patrón oficial de `@supabase/ssr` y respeta que ninguna ruta exige sesión.
- **Sí:** confirmación de correo obligatoria con panel «REVISA TU CORREO» inline, sin ruta propia.
- **Sí:** recuperación de contraseña incluida, con `/recuperar` y `/restablecer`, aunque hace el spec más grande.
- **Sí:** dos migraciones separadas. La del paso 9 solo se aplica cuando la UI ya envía el `username`, para que la app no deje de guardar marcas entre commits.
- **Sí:** `username` en mayúsculas y con la regla `^[A-Z0-9_]{3,10}$`, para coincidir con cómo `game-player` ya normaliza `scores.name` (mayúsculas, máximo 10).

## Riesgos identificados

| Riesgo                                                                                      | Mitigación                                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| El SMTP por defecto de Supabase limita el envío de correos a muy pocos por hora             | Documentarlo en el PR; usar una cuenta ya confirmada para probar; el SMTP propio queda fuera de alcance.                                       |
| Dos personas eligen el mismo username a la vez y el trigger falla en el registro            | La restricción `unique` es la garantía. `authErrorMessage` traduce el error genérico de «database error saving new user» a «username ocupado». |
| Las marcas antiguas de invitado tienen el mismo `name` que un username nuevo                | «Tu mejor marca» podría mostrar una marca ajena anterior. Aceptado hasta que exista `scores.user_id` en otro spec.                             |
| Los proveedores OAuth no están configurados en el entorno del que implementa                | El paso 1 es manual y previo; los botones se activan en el paso 7 y fallan con mensaje claro si el proveedor no está habilitado.               |
| `proxy.ts` y `cacheComponents` pueden interactuar de forma inesperada en Next 16.4          | Leer `node_modules/next/dist/docs/` (proxy y autenticación con Cache Components) antes del paso 3; verificar con `npm run build`.              |
| `redirectTo` y `next` abiertos permiten redirecciones a sitios externos                     | El callback solo acepta `next` que empiece por `/` y no por `//`; cualquier otro valor cae en `/biblioteca`.                                   |
| Cambiar la RLS de `scores` rompe el guardado en el despliegue si la UI antigua sigue activa | La migración del paso 9 se aplica en el mismo despliegue que el cambio de `game-player`.                                                       |

## Qué **no** entra en este spec

- `scores.user_id` ni migración de marcas antiguas a cuentas.
- Pantalla de perfil: cambiar username, correo o contraseña, avatar y borrado de cuenta.
- Rutas protegidas, roles o redirecciones forzadas a `/login`.
- Magic link, 2FA y otros proveedores OAuth.
- SMTP propio y plantillas de correo.
- Antifraude de puntuaciones.
- Historial «mis marcas».

Cada uno de ellos, si llega, va en su propio spec.
