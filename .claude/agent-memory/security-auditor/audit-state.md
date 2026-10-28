---
name: audit-state
description: Último ID de hallazgo usado, riesgos aceptados y falsos positivos descartados en las auditorías de seguridad de Arcade Vault
metadata:
  type: project
---

Último ID usado: SEC-011 (aceptados: SEC-A01 leaked password protection / plan Free, SEC-A02 sin scores.user_id ni antifraude, SEC-A03 sin CSP / HSTS sin preload / sin COOP-COEP, SEC-A04 sin rate limit propio ni CAPTCHA). Auditorías: 2026-10-27 `db` y 2026-10-27 `app`.

Riesgos aceptados por specs (no reportar como nuevos): sin CSP, HSTS sin preload, sin antifraude de puntuaciones, sin scores.user_id, leaked password protection (plan Free), sin rate limit propio en la app, sin CAPTCHA.

Falsos positivos descartados:

- Versiones de `list_migrations` distintas a los nombres de archivo: es por `apply_migration` del MCP (asigna timestamp propio); sí cuenta la migración ausente (SEC-001).
- Logs con 401 en `/rest/v1/rpc/rls_auto_enable`, `/rest/v1/games` y `weak_password` del 2026-10-28 ~04:00 UTC: pruebas del SPEC 13, no ataques.
- Usuario `spec13-probe@example.com` en logs de Auth: signup de prueba rechazado, no creó usuario.
- `.mcp.json` versionado: solo URL del MCP con `project_ref`, no es secreto.
- `RESEND_API_KEY` en `app/about/actions.ts`: solo lectura de `process.env` en server action, no valor.

**Why:** mantener IDs estables y no repetir ruido entre auditorías.
**How to apply:** continuar numeración en SEC-012; contrastar con `references/security/audit-log.md`.
