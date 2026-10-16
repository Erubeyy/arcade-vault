# SPEC 04 — Conexión de Supabase con Next.js

> **Estado:** Aprobado
> **Depende de:** SPEC 03
> **Fecha:** 2026-10-16
> **Objetivo:** Establecer la conexión entre el proyecto de Supabase y la app de Next.js (SDK, variables de entorno y clientes de navegador y servidor) sin tocar la base de datos, la autenticación ni ninguna pantalla.

## Por qué existe este spec

El proyecto ya tiene un proyecto de Supabase enlazado por MCP (`.mcp.json`), pero el código de la app no sabe nada de él. Este spec deja lista únicamente la conexión, para que los specs futuros (autenticación, tablas, realtime, Edge Functions) partan de una base común. No cambia ningún comportamiento visible de la app.

## Alcance

**Dentro:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` (valores obtenidos con el MCP de Supabase: `get_project_url` y `get_publishable_keys`).
- `lib/supabase/client.ts`: cliente para el navegador (`createBrowserClient`).
- `lib/supabase/server.ts`: cliente para el servidor (`createServerClient` con `cookies()` de `next/headers`).
- Una comprobación de conexión puntual y desechable (script o comando, sin ruta nueva en la app) que confirme que la URL y la clave responden.

**Fuera de alcance (para specs futuros):**

- Cualquier cosa de base de datos: tablas, columnas, RLS, migraciones, `supabase/migrations/`, tipos generados.
- Autenticación (login, registro, sesión) y `proxy.ts` para refrescar la sesión; `lib/session.tsx`, `components/auth-form.tsx` y `localStorage` (`av_user`, `av_scores`) no se tocan.
- Realtime de Supabase.
- Edge Functions.
- Storage.
- Cualquier cambio en pantallas, rutas o estilos.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

Este spec no introduce datos ni estructuras de base de datos. Solo añade configuración y dos módulos de cliente.

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient; // createBrowserClient(URL, PUBLISHABLE_KEY)

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>; // createServerClient(URL, PUBLISHABLE_KEY, { cookies: { getAll, setAll } })
```

Convenciones:

- Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Son públicas por diseño; nunca se usa la clave `service_role` ni la `secret` en código de cliente.
- `SUPABASE_DB_PASSWORD` ya presente en `.env.local` no se usa en este spec.
- `.gitignore` ya ignora `.env*`; las claves no se versionan.
- Los dos módulos solo exportan el cliente; no se importan desde ninguna pantalla en este spec.
- En `server.ts`, `setAll` se envuelve en `try/catch` porque `cookies().set` falla fuera de Server Actions y Route Handlers; no hay `proxy.ts` que refresque sesión todavía.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de variables de entorno y de `cookies`, y la de `cacheComponents`; y la guía de Supabase SSR para Next.js con `mcp__supabase__search_docs`.

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` con `npm install`. Verificación: `npm run build` compila.
2. Obtener la URL y la publishable key con `get_project_url` y `get_publishable_keys` y añadirlas a `.env.local`. Verificación: `.env.local` define las dos variables y `git status` no lo muestra.
3. Crear `lib/supabase/client.ts` con `createBrowserClient`. Verificación: compila sin errores de tipos.
4. Crear `lib/supabase/server.ts` con `createServerClient` y el manejo de cookies descrito. Verificación: compila sin errores de tipos.
5. Comprobar la conexión con un script desechable en el directorio temporal (fuera del repo) que cree un cliente con las dos variables y haga una petición a `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` con la cabecera `apikey`. Verificación: responde 200. El script no se versiona.
6. Limpieza: `npm run lint` y `npm run build`. Verificación: sin errores y sin cambios en ninguna ruta existente.

## Criterios de aceptación

- [ ] `@supabase/supabase-js` y `@supabase/ssr` figuran en `dependencies` de `package.json`.
- [ ] `.env.local` define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y no aparece en `git status`.
- [ ] Existen `lib/supabase/client.ts` y `lib/supabase/server.ts`, y cada uno exporta una función `createClient`.
- [ ] Ninguna clave `service_role`, `secret` ni `SUPABASE_DB_PASSWORD` aparece en el código del repo ni en `.next/static`.
- [ ] La petición de comprobación a `/auth/v1/health` del proyecto responde 200 con la URL y la clave de `.env.local`.
- [ ] `list_tables` del esquema `public` sigue devolviendo vacío y no existe carpeta `supabase/`.
- [ ] No existe `proxy.ts` ni `middleware.ts`.
- [ ] `lib/session.tsx`, `components/auth-form.tsx` y `components/nav.tsx` no tienen cambios en el diff.
- [ ] Las rutas `/`, `/biblioteca`, `/salon`, `/about`, `/login` y `/juegos/<id>` se ven y responden igual que antes de este spec.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** limitar el spec a la conexión. Decisión explícita del usuario: no tocar base de datos, tablas ni campos todavía.
- **No:** autenticación en este spec. Se había definido una versión previa con Supabase Auth; se retira y pasa a un spec propio.
- **Sí:** `@supabase/ssr` con clientes separados de navegador y servidor. Es el patrón de App Router y evita rehacer los clientes cuando llegue la autenticación.
- **No:** `proxy.ts` ahora. Solo sirve para refrescar sesión de Auth, que no existe todavía.
- **Sí:** clave publishable (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) en lugar de la `anon` legacy. Es el formato actual de claves de Supabase.
- **No:** `service_role` o `secret`. No hay necesidad y exponerlas sería un riesgo de seguridad.
- **Sí:** comprobar la conexión con un script desechable fuera del repo. Verifica URL y clave sin crear rutas, tablas ni código de producción.
- **No:** ruta de diagnóstico (`/api/health`) ni pantalla de estado. Añadiría superficie pública sin valor.
- **No:** `supabase init` ni carpeta `supabase/`. Se crea cuando exista la primera migración.
- **Sí:** `localStorage` (`av_user`, `av_scores`) y datos seeded se quedan como están. Decisión explícita del usuario.
- **Sí:** realtime, Edge Functions y autenticación quedan como specs futuros; este deja listos los clientes.

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                    |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Pegar una clave equivocada (`secret` en vez de publishable) en una variable `NEXT_PUBLIC_*` | Se usa `get_publishable_keys` y el criterio de aceptación revisa que no haya claves privadas en el repo ni en `.next/static`. |
| `cacheComponents` en Next 16 afecta a `cookies()` en Server Components                      | Los clientes no se importan desde ninguna pantalla en este spec; leer la guía antes del paso 4 para el spec que los use.      |
| Variables de entorno ausentes rompen el build al importar los módulos                       | Los módulos no se importan aún; el spec futuro decide si valida las variables al arrancar.                                    |
| El proyecto de Supabase está pausado o inaccesible durante la comprobación                  | Revisar el estado del proyecto con el MCP antes de reportar fallo en el paso 5.                                               |
| Los módulos quedan sin uso y parecen código muerto                                          | Es intencional: son la base de los specs de autenticación y base de datos.                                                    |

## Qué **no** está en este spec

- Tablas, columnas, RLS, migraciones y tipos generados.
- Autenticación, sesión y `proxy.ts`.
- Cambios en `localStorage`, Salón de la Fama o puntuaciones.
- Realtime, Edge Functions y Storage.
- Cualquier cambio visible en pantallas o rutas.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
