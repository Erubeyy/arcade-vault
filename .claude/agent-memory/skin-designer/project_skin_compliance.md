---
name: project-skin-compliance
description: Estado de cumplimiento de skins classic/neon/retro + claro/oscuro por juego real y decisiones de paleta tomadas
metadata:
  type: project
---

Estado por juego (verificar contra el código y references/game-with-themes.md antes de fiarse):

- asteroids: CUMPLE desde 2026-10-21. classic/neon/retro × dark/light, default classic+dark, `av_asteroids_prefs`. Retro = paleta PICO-8 (oscuro fondo #1d2b53, claro fondo #fff1e8; verde del escudo en claro oscurecido a #006b40 para texto ≥ 4.5:1). Retro rasteriza líneas con Bresenham sobre rejilla de 3 px (`pen.ts`) porque `imageSmoothingEnabled` no quita el antialias de los trazos.
- caida (Tetris): sin `classic`, default `retro` (que en realidad es el aspecto plano). Pendiente de migración en su propia invocación.
- bloque-buster (Arkanoid) y serpentina (Snake): sin auditar a 2026-10-21.

**Why:** el agente trabaja un juego por invocación; este registro evita repetir auditorías.
**How to apply:** al empezar, leer esto y references/game-with-themes.md; para un juego nuevo, reutilizar la idea de `Pen` de Asteroids si el juego es vectorial.

La app es solo oscura (globals.css no tiene modo claro): el "tema" es del tablero del canvas, conmutado desde el panel de opciones como en Tetris ("Tema del tablero").
