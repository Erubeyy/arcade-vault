## Checklist de seguridad básico

Estado según SPEC 13; última verificación por `security-auditor`: base de datos 2026-10-27, aplicación 2026-10-27 (ver `audit-log.md`).

- [x] RLS: Row Level Security habilitado en `games`, `scores` y `profiles` (únicas tablas de `public`). Solo hay `select` público e `insert` acotado (`scores_insert_own`, `profiles_insert_own`); sin políticas de `update` ni `delete`.
- [x] Minimum password length — mínimo 8 caracteres (validado en `lib/auth.ts` y rechazado por el servidor con `weak_password`, visto en los logs de Auth).
- [ ] Leaked password protection — **pendiente**: requiere plan Pro de Supabase. El warning `auth_leaked_password_protection` del advisor seguirá apareciendo en el plan Free.
- [x] Max signup rate — límite de registros e inicios de sesión por IP configurado en el panel de Supabase (Auth → Rate Limits). Los logs muestran limitadores bajados de 30 a 10; confirmar el resto en el panel.
- [x] Headers de seguridad en Next.js (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security` y `Permissions-Policy`. Sin CSP (pendiente para otro spec). Verificado con `curl -I` en `/`, `/biblioteca` y `/auth/callback` (2026-10-27).

## Por el lado de la aplicación:

- [x] Secretos fuera del repo: `.env*` ignorado, sin claves en el código y solo `NEXT_PUBLIC_*` en el cliente.
- [x] `/auth/callback` solo acepta `next` interno.
- [ ] `/auth/callback` no confía en `X-Forwarded-Host` sin lista blanca (SEC-009).
- [ ] Server actions verifican sesión: `revalidateScores` no lo hace (SEC-010).
- [x] Formulario de contacto: validación de tipos y longitudes, honeypot y asunto sin saltos de línea.
- [x] Sin sinks XSS (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`).
- [x] `use cache` solo con `createPublicClient`.
- [ ] Dependencias sin vulnerabilidades conocidas: `next@16.4.0` crítica, subir a 16.4.3 (SEC-008).
- [ ] `X-Powered-By` desactivado (SEC-011).

## Por el lado de Supabase:

- [x] Panel de warnings y errores revisado: se corrigieron los avisos de `rls_auto_enable()` (`SECURITY DEFINER` ejecutable por RPC) con la migración `20261027140000_revoke_rls_auto_enable_rpc.sql`.
- [x] Queda solo el warning de leaked password protection (ver arriba); confirmado en el advisor el 2026-10-27.
- [x] Funciones `SECURITY DEFINER` de `public` (`rls_auto_enable`, `handle_new_user`) con `search_path` fijado y sin `EXECUTE` para `anon` / `authenticated`.
- [x] Event trigger `ensure_rls` y trigger `on_auth_user_created` activos.
- [x] Vista `games_with_stats` con `security_invoker = true`.
- [ ] Grants mínimos: quitar DML de `anon`/`authenticated` sobre `games_with_stats` (SEC-002), `insert` de `anon` en `scores` (SEC-003) y limitar el insert por columnas sin `created_at` (SEC-004).
- [ ] Historial de migraciones remoto alineado con `supabase/migrations/` (SEC-001).
