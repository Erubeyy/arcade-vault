# Pasar Arcade Vault a producción (Supabase)

Claude solo tiene acceso al proyecto de **desarrollo** (`.mcp.json`). Producción lo aplicas tú, desde el panel de Supabase. Aquí está todo lo necesario.

**Qué se migra:** esquema, RLS, grants, triggers y el catálogo `games` (9 juegos, que llega con las migraciones). **Qué no:** scores, perfiles y usuarios de prueba; producción empieza limpia.

| Archivo         | Para qué                                                                |
| --------------- | ----------------------------------------------------------------------- |
| `01_schema.sql` | Las 10 migraciones en una transacción + registro en `schema_migrations` |
| `02_verify.sql` | Comprobaciones de solo lectura (todas deben dar `ok = true`)            |
| `build.sh`      | Regenera `01_schema.sql` desde `supabase/migrations/`                   |

## 1. Crear el proyecto de producción

- Misma región y misma versión de Postgres que dev.
- Si el asistente ofrece **"Enable automatic RLS"**, actívalo. La migración `20261028035000_rls_auto_enable.sql` lo reproduce igual, así que no pasa nada si no lo marcas.
- Guarda la contraseña de la base de datos en tu gestor de contraseñas. No la pegues en el repo ni en la sesión de Claude.

## 2. Esquema y catálogo

1. Abre **SQL Editor → New query** en el proyecto de **producción**.
2. Pega todo `supabase/prod/01_schema.sql` y ejecútalo. Si algo falla, no se aplica nada (una sola transacción); corrige y repite.
3. Abre otra query, pega `02_verify.sql` y ejecútalo. Todas las filas deben tener `ok = true`.
4. Ejecuta aparte la prueba del RLS automático que está comentada al final de `02_verify.sql` (deja `true` y hace rollback).

## 3. Configuración de Auth (no está versionada)

Abre el panel de dev al lado y copia los valores.

- **Authentication → URL Configuration:** Site URL = dominio de producción. Redirect URLs = `https://<dominio>/auth/callback` (y los previews si los usas).
- **Sign In / Providers → Email:** "Confirm email" activado. Longitud mínima de contraseña: 8.
- **Email templates:** copia las plantillas si personalizaste alguna en dev.
- **SMTP propio:** recomendado. El SMTP por defecto de Supabase tiene un límite muy bajo de correos por hora. Puedes usar Resend, que ya usa el proyecto.
- **Rate Limits:** mismos valores que en dev (registros e inicios de sesión por IP).
- **Google y GitHub:** crea apps OAuth nuevas para producción, o añade la callback de producción a las de dev. La callback es `https://<ref-prod>.supabase.co/auth/v1/callback`. Pega Client ID y Secret en el panel de producción.
- **Leaked password protection:** requiere plan Pro (igual que en dev, sigue pendiente).

## 4. Variables de entorno del hosting

Valores de **producción** (Settings → API en el panel):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `RESEND_API_KEY` y `CONTACT_TO_EMAIL`

`SUPABASE_DB_PASSWORD` no hace falta en el hosting. `.env.local` sigue apuntando a dev.

## 5. Aislamiento de producción

- `.mcp.json` mantiene solo el `project_ref` de dev. No añadas nunca el ref, las claves ni la contraseña de producción al repo ni a una sesión de Claude.
- El MCP de Supabase usa tu cuenta: la URL con `project_ref` limita las herramientas a ese proyecto, pero el token de la cuenta podría ver ambos. Si quieres aislamiento real, pon producción en otra organización o usa un token de acceso con alcance solo a dev.

## 6. Cambios futuros

1. Claude crea la migración en `supabase/migrations/` y la aplica en dev.
2. Tú ejecutas `bash supabase/prod/build.sh`.
3. En el SQL Editor de producción pegas solo la migración nueva y, después, su fila en el historial:
   `insert into supabase_migrations.schema_migrations (version, name) values ('<version>', '<nombre>');`

## 7. Prueba de humo en producción

- `/biblioteca` muestra el catálogo.
- El registro por correo llega y se confirma.
- Login con Google y con GitHub.
- Una partida guarda el score y aparece en `/salon`.
- El formulario de `/about` envía el correo.
