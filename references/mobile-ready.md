# Rutas y juegos listos para móvil

Registro de rutas y juegos auditados y corregidos para el navegador móvil; lo mantiene el subagente `mobile-porter`.

Última actualización: 2026-10-25.

| Objetivo                                                        | Tipo  | Vertical                                                                                                 | Apaisado                                                                                                                          | Escritorio intacto                                               | Verificado                                      | Archivos                                        | Fecha      |
| --------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ---------- |
| `ranaria` (Frogger: `/juegos/ranaria`, `/juegos/ranaria/jugar`) | juego | Sí: gamepad bajo el canvas, canvas + gamepad visibles a la vez a 390×844, sin scroll horizontal a 375 px | Parcial: cruceta y A/B a los lados, sin scroll horizontal; el canvas requiere scroll vertical (layout compartido, ver pendientes) | Sí: sin gamepad, `.controls-hint` visible, modal igual que antes | lint OK, build OK, 4/4 viewports × claro/oscuro | `app/globals.css` (modal `.input-row` ≤ 520 px) | 2026-10-25 |

## Pendientes

- `ranaria`:
  - A 844×390 el HUD (estadísticas + panel de opciones, 152 px) y la nav empujan el canvas: termina en y≈516 con viewport de 390 y hay que hacer scroll vertical. Es el layout apaisado compartido de SPEC 10 (igual en Snake y Tetris); arreglarlo afecta a todos los juegos y requiere aprobación.
  - A 375×667 el gamepad no cabe entero junto al canvas sin scroll (termina en y≈782). SPEC 10 solo lo exige a 390×844.
  - Textos < 12 px compartidos del sitio: etiquetas del HUD (9 px), etiquetas de `/juegos/[id]` (9 px) y menú de la nav (11 px), en fuente pixel. Afectan a todas las rutas.
  - El texto largo del catálogo (Supabase) solo menciona «flechas o WASD»; no cita el gamepad táctil.
