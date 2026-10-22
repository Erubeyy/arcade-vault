# Juegos con skins y temas

Registro de los juegos reales que ya ofrecen los skins obligatorios (`classic`, `neon`, `retro`) en modo oscuro y claro, con selector en la UI y persistencia. Lo mantiene el subagente `skin-designer`.

Última actualización: 2026-10-21.

| id (catálogo) | Juego     | Skins                      | Defecto            | Claro/Oscuro | Persistencia         | Verificado                                                                | Archivos                                                             | Fecha      |
| ------------- | --------- | -------------------------- | ------------------ | ------------ | -------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- |
| asteroids     | Asteroids | `classic`, `neon`, `retro` | `classic` + `dark` | ambos        | `av_asteroids_prefs` | lint, build, 6/6 en navegador; recarga, JSON corrupto y storage bloqueado | `skins.ts`, `pen.ts`, `prefs.ts`, `components/asteroids-options.tsx` | 2026-10-21 |

## Pendientes

- asteroids: el filtro CRT de la app (scanlines y viñeta en `.crt-screen`) oscurece ligeramente los fondos claros; el contraste se calculó contra el color de fondo del canvas, sin el filtro. Los contadores TRIPLE/ESCUDO del canvas usan `monospace` del sistema (también en retro, con antialias de texto).
