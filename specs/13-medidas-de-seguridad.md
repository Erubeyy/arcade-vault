# SPEC 13 — Medidas de seguridad básicas (RLS, contraseñas, rate limit y headers)

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 06, SPEC 12
> **Fecha:** 2026-10-27
> **Objetivo:** Cerrar el checklist de `references/security/security-checklist.md`: verificar RLS en todas las tablas, exigir contraseñas de 8+ caracteres, limitar registros por IP, añadir headers de seguridad en Next.js y resolver los warnings del advisor de seguridad de Supabase que se puedan corregir.

## Por qué existe este spec

El checklist de seguridad básico tiene cinco puntos y un TODO («vayan al panel de warnings y errores de Supabase»). Parte del trabajo ya está hecho por el SPEC 12, y parte vive en el panel de Supabase (no se versiona). Este spec fija qué se verifica, qué se cambia en el repo y qué queda como configuración manual documentada.

Estado real revisado antes de redactar (2026-10-27, Supabase MCP):

- RLS está **activo** en `games`, `scores` y `profiles`.
- Políticas actuales: `games_select_public` (select), `profiles_select_public` (select), `profiles_insert_own` (insert, `id = auth.uid()`), `scores_select_public` (select) y `scores_insert_own` (insert, `name = username` del perfil). No existe ninguna política de `update` ni `delete`, así que quedan denegados por defecto.
- Contraseña mínima: `lib/auth.ts` ya valida 8 caracteres en cliente (SPEC 12); el ajuste del panel de Auth era un paso manual y no se puede leer por MCP.
- `next.config.ts` no define headers.
- El advisor de seguridad devuelve 3 warnings:
  - `auth_leaked_password_protection`: protección contra contraseñas filtradas desactivada.
  - `anon_security_definer_function_executable` y `authenticated_security_definer_function_executable`: `public.rls_auto_enable()` es `SECURITY DEFINER` y se puede invocar por RPC (`/rest/v1/rpc/rls_auto_enable`). Es la función del event trigger `ensure_rls`, que activa RLS en las tablas nuevas de `public`; no tiene sentido exponerla como RPC.

Decisiones ya cerradas con el usuario antes de redactar:

- Headers: los tres del checklist más `Strict-Transport-Security` y `Permissions-Policy`. **Sin CSP** en este spec.
- Límite de registros: solo los rate limits de Supabase Auth (configuración manual del panel); sin CAPTCHA.
- `rls_auto_enable()`: se corrige con una migración que revoca `EXECUTE`.
- Contraseñas filtradas: el plan es Free, por lo que se deja **documentado como pendiente**; el warning seguirá apareciendo.

## Alcance

**Dentro:**

- **RLS (verificación):** comprobar con SQL que `games`, `scores` y `profiles` tienen RLS activo y que no existen políticas de `insert`, `update` ni `delete` para `anon` sobre `games`, ni de `update`/`delete` sobre ninguna tabla. No se cambia ninguna política.
- **Contraseña mínima de 8 caracteres:** verificar que el panel de Auth lo aplica en el servidor (no solo en `lib/auth.ts`) y corregirlo si no.
- **Headers de seguridad** en `next.config.ts` mediante `headers()` para `source: "/(.*)"`:

  ```ts
  const securityHeaders = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];
  ```

- **Migración** `supabase/migrations/20261027140000_revoke_rls_auto_enable_rpc.sql`: revoca `EXECUTE` de `public.rls_auto_enable()` a `public`, `anon` y `authenticated`. El event trigger `ensure_rls` debe seguir activando RLS en tablas nuevas.
- **Configuración manual en Supabase** (panel, no versionable), anotada en la descripción del PR:
  - Auth → Rate Limits: bajar el límite de registros e inicios de sesión por IP (valor propuesto: 10 por 5 minutos).
  - Auth → Password: longitud mínima 8.
- **Documentar el pendiente** de leaked password protection (requiere plan Pro) en `references/security/security-checklist.md`, y marcar ahí los puntos cumplidos.
- Actualizar `CLAUDE.md` con una nota breve de seguridad (headers, política de RLS y pendientes).

**Fuera de alcance (para specs futuros):**

- Content-Security-Policy (ni siquiera en Report-Only): con `cacheComponents` y los scripts inline de Next exige nonce vía `proxy.ts`.
- CAPTCHA (Turnstile/hCaptcha) en el registro.
- Activar leaked password protection (plan Pro) o simularla con la API de HaveIBeenPwned.
- Rate limiting propio en la app (rutas, server action de contacto, inserts de `scores`).
- Antifraude de puntuaciones y `scores.user_id`.
- Revisión de las demás advertencias del advisor de rendimiento y de Storage.
- `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy` y HSTS con `preload`.
- Tests automatizados.

## Modelo de datos

Este spec no introduce tablas ni columnas nuevas. El único cambio en base de datos son los privilegios de una función:

```sql
-- supabase/migrations/20261027140000_revoke_rls_auto_enable_rpc.sql
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

```ts
// next.config.ts
const nextConfig: NextConfig = {
  // ...config existente
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
};
```

## Plan de implementación

1. **Auditoría inicial.** Ejecutar el advisor de seguridad y las consultas de `pg_policies` y `rls_enabled` de `public`, y anotar el resultado en la descripción del PR como línea base.
2. **Headers.** Leer en `node_modules/next/dist/docs/01-app/` la referencia de `headers` en `next.config.ts` (Next 16.4), añadir `securityHeaders` y `headers()` a `next.config.ts`. Verificar con `npm run dev` y `curl -I` que una página y una ruta de API/estático los devuelven.
3. **Migración de `rls_auto_enable`.** Crear `20261027140000_revoke_rls_auto_enable_rpc.sql`, aplicarla y volver a correr el advisor para confirmar que desaparecen los dos warnings de `SECURITY DEFINER`.
4. **Comprobar que `ensure_rls` sigue funcionando.** Dentro de una transacción con rollback, crear una tabla temporal de prueba en `public` y verificar que queda con RLS activo; no dejar rastro.
5. **Configuración manual en Supabase.** Aplicar en el panel el rate limit de registros/sesiones por IP y la contraseña mínima de 8; anotar los valores en el PR.
6. **Verificar contraseña mínima en servidor.** Llamar al endpoint de signup de Supabase Auth con una contraseña de 7 caracteres y comprobar que la rechaza (`weak_password`) sin pasar por la UI.
7. **Cierre.** Actualizar `references/security/security-checklist.md` (marcar lo hecho; dejar leaked password protection como pendiente por plan Free), añadir la nota de seguridad a `CLAUDE.md`, pasar este spec a `Implementado` y correr `npm run lint` y `npm run build`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `select tablename, rowsecurity from pg_tables where schemaname = 'public'` devuelve `rowsecurity = true` para `games`, `scores` y `profiles`.
- [ ] `pg_policies` de `public` no contiene políticas de `update` ni `delete`, ni de `insert` sobre `games`.
- [ ] Un `insert` en `games` con la clave pública y sin sesión es rechazado por RLS.
- [ ] `curl -I` a `/` y a `/biblioteca` devuelve `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` y `Permissions-Policy`.
- [ ] Las páginas, el login y los juegos funcionan igual con los headers activos (sin errores nuevos en consola del navegador).
- [ ] Llamar a `/rest/v1/rpc/rls_auto_enable` con la clave pública devuelve error de permisos.
- [ ] El advisor de seguridad ya no reporta `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`.
- [ ] Crear una tabla nueva en `public` (con rollback) sigue dejando RLS activo.
- [ ] El signup de Supabase Auth con una contraseña de 7 caracteres es rechazado por el servidor.
- [ ] El panel de Auth muestra los rate limits por IP configurados y quedan anotados en la descripción del PR.
- [ ] `references/security/security-checklist.md` refleja el estado real: puntos cumplidos marcados y leaked password protection como pendiente por plan.

## Decisiones tomadas y descartadas

- **Sí:** no tocar políticas RLS. El estado actual cumple el checklist (RLS activo, solo `select` público y dos `insert` acotados); solo se verifica y se deja como criterio de aceptación.
- **Sí:** `Strict-Transport-Security` sin `preload`. `preload` es difícil de revertir y el dominio de producción aún no está fijado; los navegadores ignoran HSTS sobre `http://localhost`.
- **Sí:** `Permissions-Policy` desactivando cámara, micrófono y geolocalización, que Arcade Vault no usa. No se restringe `gamepad` ni `fullscreen`.
- **No:** CSP. El riesgo de romper la app con `cacheComponents` y scripts inline es mayor que el beneficio inicial; merece su propio spec con nonce en `proxy.ts`.
- **No:** `frame-ancestors` como alternativa a `X-Frame-Options`. Es parte de CSP; `DENY` basta y es lo que pide el checklist.
- **Sí:** limitar registros con los rate limits de Supabase Auth, sin CAPTCHA. Es suficiente como primera barrera anti-bot y no añade dependencias ni claves externas.
- **Sí:** `revoke execute` en vez de pasar `rls_auto_enable()` a `SECURITY INVOKER`. Un event trigger necesita poder alterar tablas sin depender de quién lo dispare, y revocar la ejecución por RPC no afecta al trigger.
- **No:** mover `rls_auto_enable()` a otro esquema. Es una función creada por el entorno de Supabase; moverla es más invasivo que revocar el permiso.
- **Sí:** dejar leaked password protection como pendiente documentado. Requiere plan Pro; simularla con HaveIBeenPwned añade código y una dependencia externa que no se pidió.
- **Sí:** verificar la contraseña mínima contra el servidor, no solo contra la validación del cliente. La validación en `lib/auth.ts` es UX; el límite real vive en Supabase Auth.

## Riesgos identificados

| Riesgo                                                                        | Mitigación                                                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `X-Frame-Options: DENY` rompe algún embed del propio sitio                    | La app no usa iframes propios; verificar a mano login, juegos y `/about` tras el cambio.                               |
| `Permissions-Policy` bloquea una API usada por un juego                       | Solo se desactivan cámara, micrófono y geolocalización; ningún juego los usa.                                          |
| Revocar `EXECUTE` impide que `ensure_rls` active RLS en tablas nuevas         | El paso 4 lo comprueba con una tabla de prueba dentro de una transacción con rollback; si falla, revertir con `grant`. |
| Un rate limit demasiado bajo bloquea a varios usuarios tras la misma IP (NAT) | Valor inicial moderado (10 por 5 min); ajustable en el panel sin desplegar.                                            |
| HSTS mal configurado deja el sitio solo por HTTPS durante `max-age`           | Sin `preload`; el despliegue ya sirve por HTTPS. En local el navegador lo ignora.                                      |
| El warning de leaked password protection seguirá visible y puede confundirse  | Queda documentado en el checklist y en el PR como pendiente por plan Free.                                             |

## Qué **no** entra en este spec

- CSP, COOP/COEP y HSTS con `preload`.
- CAPTCHA y rate limiting propio en la app.
- Leaked password protection (plan Pro).
- Antifraude de puntuaciones y `scores.user_id`.
- Advisors de rendimiento y revisión de Storage.

Cada uno de ellos, si llega, va en su propio spec.
