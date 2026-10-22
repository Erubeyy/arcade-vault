---
name: project-skin-compliance
description: Estado de cumplimiento de skins classic/neon/retro + claro/oscuro por juego real y decisiones de paleta tomadas
metadata:
  type: project
---

Estado por juego (verificar contra el código y references/game-with-themes.md antes de fiarse):

- asteroids: CUMPLE desde 2026-10-21. classic/neon/retro × dark/light, default classic+dark, `av_asteroids_prefs`. Retro = paleta PICO-8 (oscuro fondo #1d2b53, claro fondo #fff1e8; verde del escudo en claro oscurecido a #006b40 para texto ≥ 4.5:1). Retro rasteriza líneas con Bresenham sobre rejilla de 3 px (`pen.ts`) porque `imageSmoothingEnabled` no quita el antialias de los trazos.
- caida (Tetris): sin `classic`, default `retro` (que en realidad es el aspecto plano). Pendiente de migración en su propia invocación.
- serpentina (Snake): CUMPLE desde 2026-10-21. Default classic+dark, `av_snake_prefs`. Retro = PICO-8 sin rejilla, segmentos con «escama» central y frutas en pixel art 8×8 (no usa el atlas); en claro las frutas llevan contorno #1d2b53. Los sprites del atlas (blancos como el nabo) desaparecen en fondo claro: classic/neon claros dibujan contorno plano (sombra sin blur en 8 direcciones). Ojo: las claves de `FRUITS` no coinciden con el dibujo del recorte; `FRUIT_TINT` sigue al dibujo.
- bloque-buster (Arkanoid): CUMPLE desde 2026-10-21. classic/neon/retro + extra `arcade` (el spritesheet original, conservado para no perder el arte; en claro lleva contorno #10121c). Default classic+dark; `av_arkanoid_prefs` ampliado (las prefs antiguas solo con `muted` siguen valiendo). Retro = PICO-8, fondo negro en oscuro (el lavanda no llega a 3:1 sobre navy), crema en claro con amarillo/cian/rosa sustituidos por marrón/azul/rojo; rejilla de 4 px. Dibujo en `render.ts` (clase `Renderer` por skin).
- El navegador Playwright y el dev server (puerto 3000) pueden estar compartidos con otra sesión: verificar en un solo `evaluate` (mosaico en canvas) para evitar que naveguen a mitad.

**Why:** el agente trabaja un juego por invocación; este registro evita repetir auditorías.
**How to apply:** al empezar, leer esto y references/game-with-themes.md; para un juego nuevo, reutilizar la idea de `Pen` de Asteroids si el juego es vectorial.

La app es solo oscura (globals.css no tiene modo claro): el "tema" es del tablero del canvas, conmutado desde el panel de opciones como en Tetris ("Tema del tablero").
