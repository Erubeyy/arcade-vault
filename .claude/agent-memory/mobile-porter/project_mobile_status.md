---
name: project-mobile-status
description: Estado móvil por objetivo y problemas compartidos abiertos (apaisado, textos pequeños) que requieren aprobación del usuario
metadata:
  type: project
---

Estado a 2026-10-25 (detalle en `references/mobile-ready.md`):

- `ranaria` (Frogger, SPEC 11): listo en vertical y escritorio; apaisado parcial. Se corrigió el modal «FIN DEL JUEGO» (botón GUARDAR se salía a 375 px) con `@media (max-width: 520px)` en `.modal .input-row`; afecta al modal de todos los juegos, escritorio idéntico.

Problemas compartidos abiertos, no corregidos por ser globales (preguntar antes):

- Apaisado 844×390: HUD + panel de opciones empujan el canvas fuera de pantalla en todos los juegos reales.
- Textos de 9-11 px en HUD, etiquetas de detalle y nav.

**Why:** cambiarlos toca el layout de todos los juegos/rutas; la regla del agente pide preguntar.
**How to apply:** al auditar otro juego, no recontar estos fallos como nuevos; reportarlos como compartidos y proponer un spec/cambio global.

Nota de entorno: el overlay "Insight" de `next dev` tapa la página en Playwright; ocultar `nextjs-portal` con un estilo inyectado. El watcher de Turbopack puede quedarse con un CSS intermedio tras ediciones seguidas: comprobar el CSS servido con curl.
