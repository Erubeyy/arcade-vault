## Checklist de seguridad básico

Estado según SPEC 13 (2026-10-27).

- [x] RLS: Row Level Security habilitado en `games`, `scores` y `profiles`. Solo hay `select` público e `insert` acotado (`scores_insert_own`, `profiles_insert_own`); sin políticas de `update` ni `delete`.
- [x] Minimum password length — mínimo 8 caracteres (validado en `lib/auth.ts` y rechazado por el servidor con `weak_password`).
- [ ] Leaked password protection — **pendiente**: requiere plan Pro de Supabase. El warning `auth_leaked_password_protection` del advisor seguirá apareciendo en el plan Free.
- [x] Max signup rate — límite de registros e inicios de sesión por IP configurado en el panel de Supabase (Auth → Rate Limits). Valor propuesto: 10 por 5 minutos; anotar el valor real en el PR.
- [x] Headers de seguridad en Next.js (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security` y `Permissions-Policy`. Sin CSP (pendiente para otro spec).

## Por el lado de Supabase:

- [x] Panel de warnings y errores revisado: se corrigieron los avisos de `rls_auto_enable()` (`SECURITY DEFINER` ejecutable por RPC) con la migración `20261027140000_revoke_rls_auto_enable_rpc.sql`.
- [ ] Queda solo el warning de leaked password protection (ver arriba).
