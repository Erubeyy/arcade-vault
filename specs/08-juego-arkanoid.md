# SPEC 08 — Juego Arkanoid jugable dentro de Arcade Vault con leaderboard

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-10-19
> **Objetivo:** Portar `references/started-games/04-arkanoid/` a TypeScript como un motor de canvas desacoplado con sprites, niveles y sonido, registrarlo en `REGISTRY` reemplazando el placeholder `bloque-buster` y guardar sus marcas en el leaderboard de Supabase.

## Por qué existe este spec

Arkanoid es el tercer juego real del Vault, después de Asteroids (SPEC 05) y Tetris (SPEC 07). El contrato `GameEngine`, el registro `lib/games/registry.ts` y el `GameCanvas` genérico ya existen, así que este spec solo añade un motor y su integración.

El juego reemplaza al placeholder `bloque-buster` (ARCADE, `cover-bricks`, `cyan`, `position` 1) en lugar de crear una entrada nueva: conserva `id`, enlaces y posición, y evita dos juegos de bloques en la biblioteca. Las marcas de `bloque-buster` son simuladas y no escriben en `scores`, así que no hay datos que migrar.

Es el primer juego del Vault con assets: un spritesheet PNG y dos efectos de sonido. Es también el primero con sonido, así que añade un toggle de sonido a la barra `.player-hud`, igual que Tetris añadió su panel de opciones.

El código original (`game.js`, ~380 líneas) usa globals de módulo (`game`, `keys`), toca el DOM al cargar (`getElementById('game')`), arranca con `requestAnimationFrame` al importarse y depende de `assets/spritesheet.js`, que define globals y carga la imagen con rutas relativas a la página. Dibuja el HUD (puntuación, nivel, vidas) y los overlays de pausa, game over y victoria dentro del canvas. Usa `dt` en segundos limitado a `MAX_DT`, con la bola en sub-pasos. La fuente de verdad es `game.js`: el README menciona ESC, el menú de pausa y la selección de nivel, que el port sustituye por la barra de React.

## Alcance

**Dentro:**

- Motor `ArkanoidEngine` en `lib/games/arkanoid/` (`engine.ts`, `sprites.ts`, `levels.ts`, `prefs.ts`) que implementa `GameEngine` y se registra en `lib/games/registry.ts` con el id `bloque-buster`.
- Port fiel de la física: paleta, bola con velocidad constante, rebote en paleta con ángulo máximo de 60°, lanzamiento con dispersión de ±15°, sub-pasos de 8 px, colisión con bloques por eje de menor penetración (un bloque por sub-paso), bloques de 1 golpe (10 puntos) y grises de 2 golpes (50 puntos), 3 vidas, animación de explosión de 150 ms.
- Los 8 niveles de `levels.js` con sus figuras y velocidades (360 a 570 px/s). Al limpiar un nivel se carga el siguiente automáticamente, conservando puntos y vidas; la bola vuelve a la paleta en estado `ready` y espera `ESPACIO`.
- Fin de partida: sin vidas, o al limpiar el nivel 8 (victoria). Ambos llaman a `onGameOver(score)`.
- Assets copiados a `public/games/bloque-buster/`: `spritesheet-breakout.png`, `sounds/ball-bounce.mp3` y `sounds/break-sound.mp3`. El motor carga la imagen antes de empezar el loop.
- Sonido: rebote (paredes, paleta, golpe a bloque gris sin romper) y rotura de bloque, con la misma lógica del original. Toggle SONIDO / SILENCIO en la barra `.player-hud`.
- Panel `components/arkanoid-options.tsx` en la segunda fila de la barra `.player-hud`, solo para `bloque-buster`, con el mismo diseño y colores que `TetrisOptionsPanel` (etiqueta `.l`, botón `hud-toggle` achaflanado). El cambio se aplica en vivo, también en pausa.
- Preferencia en `localStorage` bajo la clave `av_arkanoid_prefs`; si falla, sonido activado.
- Barra de React con puntuación, nivel y vidas desde `onStats`.
- Texto en el canvas «ESPACIO PARA LANZAR» mientras el estado es `ready`, porque React no conoce ese estado. Textos en español.
- Migración `supabase/migrations/<timestamp>_game_arkanoid.sql`: UPDATE del placeholder `bloque-buster` conservando `id`, `position`, `cat`, `cover` y `color`.
- `GamePlayer` ramifica para `bloque-buster` solo en el panel de opciones, con el mismo patrón que Tetris; el resto del flujo (insert en `scores`, `av_scores`, `revalidateScores`, `—` si falta algún dato, `controls-hint` desde `REGISTRY`) ya es genérico.
- Guardado en `scores` (`game_id = 'bloque-buster'`) + copia local `av_scores` + `revalidateScores`, con los estados guardando, guardado y error con reintento (patrón del SPEC 06).
- Línea de controles bajo la CRT: `← →` o `A D` mover, `ESPACIO` lanzar.

**Fuera de alcance (para specs futuros):**

- Cambios en los otros 7 juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Menú de pausa del original (Resume / Restart level / Change level / Finish game), la tecla `ESC` y `Enter`: la pausa, FIN y JUGAR DE NUEVO son de React. La selección manual de nivel desaparece; los niveles solo avanzan al completarse.
- Pantallas «PAUSED», «GAME OVER» y «YOU WIN!» y el HUD dibujados en el canvas.
- Sonidos de pausa y de menú (el original tampoco los tiene), música, control de volumen y toggle de sonido en otros juegos.
- Power-ups, multibola, cambio de tamaño de la paleta, niveles aleatorios y editor de niveles: el README los lista como no implementados.
- Pantalla de título, nombres de nivel y banners de introducción.
- Guardar progreso o desbloquear niveles.
- Recoloreo con la paleta neón del sitio: se mantienen los sprites originales.
- Antifraude, Supabase Auth, paginación del leaderboard.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```ts
// lib/games/arkanoid/engine.ts
export interface ArkanoidOptions {
  muted: boolean;
}

export class ArkanoidEngine implements GameEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    options?: Partial<ArkanoidOptions>,
  );
  setMuted(muted: boolean): void; // aplica en vivo, también en pausa
  // start, pause, resume, restart, end, destroy (idempotente)
}
```

```ts
// lib/games/arkanoid/levels.ts — portado de levels.js
export const LEVEL_CHARS: Record<string, BlockColor>; // g gray, r red, y yellow, c cyan, m magenta, h hotpink, e green
export const LEVELS: { speed: number; rows: string[] }[]; // 8 niveles, filas de 10 caracteres
```

```ts
// lib/games/arkanoid/sprites.ts — portado de assets/spritesheet.js, sin globals
// SPRITES, EXPLOSION_FRAMES, EXPLOSION_DURATION = 150
// loadSpritesheet(src): Promise<HTMLImageElement>
// drawSprite(ctx, img, name, x, y, w, h), drawFrame(ctx, img, frame, x, y, w, h)
```

```ts
// lib/games/registry.ts — entrada nueva (el id es el del catálogo, no "arkanoid")
"bloque-buster": {
  create: (canvas, cb, options) =>
    new ArkanoidEngine(canvas, cb, options as Partial<ArkanoidOptions> | undefined),
  width: 800,
  height: 600,
  controls: [
    { keys: ["←", "→"], label: "mover" },
    { keys: ["A", "D"], label: "mover" },
    { keys: ["ESPACIO"], label: "lanzar" },
  ],
},
```

```ts
// localStorage — clave "av_arkanoid_prefs"
{
  muted: false;
} // ArkanoidOptions; un valor inválido se descarta y se usa el defecto
```

```sql
-- supabase/migrations/<timestamp>_game_arkanoid.sql
update public.games
set title = 'ARKANOID',
    short = 'Rompe todos los bloques y no dejes caer la bola.',
    long  = '<texto en español: 8 niveles, rebote según el punto de la paleta, bloques grises de dos golpes, 3 vidas, velocidad creciente>'
where id = 'bloque-buster';
```

Estado interno del motor (encapsulado en la clase, no en globals):

- `state`: `'ready' | 'playing' | 'gameover'`. La pausa es un indicador aparte (`paused`) y no un estado, porque la gestiona React.
- `level`, `score`, `lives`, `paddle { x, y, w, h }`, `ball { x, y, vx, vy, r }`, `blocks { x, y, color, hits, points, alive }[]`, `explosions { x, y, color, start }[]`.

Conservados de `game.js` sin cambios:

- `WIDTH = 800`, `HEIGHT = 600`, `PADDLE_SPEED = 600`, `MAX_BOUNCE_ANGLE = 60`, `START_LIVES = 3`, `BLOCK_W = 64`, `BLOCK_H = 32`, `GRID_COLS = 10`, `GRID_X = 80`, `GRID_Y = 60`, `MAX_DT = 0.05`, `MAX_STEP_PX = 8`, `LAUNCH_SPREAD = 15`.
- Paleta 162×14 en `(WIDTH − 162) / 2, HEIGHT − 40`; bola de radio 8 sobre la paleta.
- Puntos: 10 por bloque de color, 50 por bloque gris (`hits = 2`).
- Velocidad de bola de cada nivel: la de `LEVELS[level − 1].speed`; la magnitud es constante tras cada rebote en paleta y tras el lanzamiento.
- Un carácter desconocido en un nivel se omite con `console.warn`.

Convenciones:

- Canvas lógico 800×600, escalado por CSS dentro de `.crt-screen`; la física no depende del tamaño en pantalla.
- Velocidades en px/s multiplicadas por `dt` (segundos, limitado a 0.05); la bola avanza en sub-pasos de `dt / steps`.
- `onStats` emite `{ score, level, lives }` al iniciar, reiniciar y cuando cambia alguno.
- Teclas del juego: `ArrowLeft`, `ArrowRight`, `KeyA`, `KeyD`, `Space`. El motor llama a `preventDefault` en las cuatro flechas y `Space` (como el original, sin `Escape`), e ignora eventos con `target` `input`, `textarea` o `select`. `Space` solo lanza si `state === 'ready'` y se ignora con `e.repeat`.
- Al pausar se limpia el mapa de teclas para que ninguna quede pulsada. `pause()` guarda la hora y `resume()` desplaza `start` de las explosiones y reinicia `lastTime`.
- El motor no pinta puntuación, nivel, vidas ni overlays de pausa, game over o victoria.
- Los sonidos usan dos `Audio` creados en el constructor; `play()` captura el rechazo con `.catch(() => {})`. `destroy()` los detiene.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de Server y Client Components, de `public` (assets estáticos) y de `cacheComponents`. Usar `/frontend-design` para la línea de controles y el toggle de sonido. La referencia visual de `GamePlayer` es SPEC 05 y SPEC 07.

1. Migración del catálogo y `apply_migration`. Verificación: `select id, title, cover, color, position from games where id = 'bloque-buster'` devuelve ARKANOID, `cover-bricks`, `cyan` y `position = 1`; `get_advisors` sin avisos nuevos.
2. Assets y datos: copiar `spritesheet-breakout.png` y los dos mp3 a `public/games/bloque-buster/`; crear `lib/games/arkanoid/levels.ts` y `sprites.ts` portados de `levels.js` y `assets/spritesheet.js`, sin `document` ni `window` fuera de las funciones. Verificación: compila sin errores de tipos; `GET /games/bloque-buster/spritesheet-breakout.png` responde 200.
3. Motor, física y dibujo: `lib/games/arkanoid/engine.ts` con estado encapsulado, `loadLevel`, `createBlocks`, `update`, `stepBall`, colisiones y `draw` (bloques, explosiones, paleta, bola y texto «ESPACIO PARA LANZAR»), sin HUD ni overlays. Verificación: compila.
4. Entrada, callbacks y ciclo de vida: teclado, `onStats`, `onGameOver` (sin vidas o al limpiar el nivel 8, una sola vez), `start` (carga la imagen y arranca el loop; si `destroy()` llega antes de que cargue, no arranca), `pause`, `resume`, `restart`, `end`, `destroy`. Verificación: compila; `destroy()` dos veces, y antes de que cargue la imagen, no lanza error.
5. Sonido: `Audio` de rebote y rotura, `setMuted` y opción inicial `muted`. Verificación: compila; con `muted` activo no se llama a `play()`.
6. Registro: añadir `bloque-buster` a `REGISTRY`. Verificación: `/juegos/bloque-buster/jugar` arranca la partida sola, con la barra mostrando puntuación, nivel y vidas reales.
7. Panel de sonido: `lib/games/arkanoid/prefs.ts` y `components/arkanoid-options.tsx` montado en la segunda fila de `.player-hud` solo para `bloque-buster` (leído en `useEffect`, como Tetris); `GamePlayer` aplica `setMuted` en vivo. Verificación: el toggle silencia y activa el sonido al instante, también en pausa; recargar conserva la preferencia.
8. Comparación lado a lado con `references/started-games/04-arkanoid/index.html`. Verificación: mismos 8 niveles y velocidades, mismos puntos, mismo rebote en paleta y mismo fin de partida.
9. Limpieza: quitar importaciones muertas y ejecutar `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] `/juegos/bloque-buster` y `/juegos/bloque-buster/jugar` responden 200 y no hay errores en la consola del navegador.
- [ ] `bloque-buster` aparece en `/biblioteca` con el título ARKANOID en el filtro ARCADE y como pestaña en `/salon`; ya no usa partida simulada.
- [ ] `games` sigue teniendo 9 filas y `bloque-buster` conserva `position = 1`, `cover-bricks` y `cyan`.
- [ ] La partida empieza sola al entrar en `/jugar` en el nivel 1, con los bloques dibujados con los sprites, la bola sobre la paleta y el texto «ESPACIO PARA LANZAR».
- [ ] `←` `→` y `A` `D` mueven la paleta a 600 px/s sin salirse del canvas; `ESPACIO` lanza la bola solo en estado `ready`, y mantenerlo pulsado no encadena lanzamientos.
- [ ] Pulsar flechas o `ESPACIO` en la pantalla de juego no hace scroll en la página.
- [ ] La bola rebota en las paredes laterales y el techo, y en la paleta con un ángulo proporcional al punto de impacto (hasta 60° desde la vertical) y velocidad constante.
- [ ] Romper un bloque de color suma 10 puntos; un bloque gris necesita 2 golpes y suma 50 al romperse.
- [ ] Al romper un bloque se muestra la animación de 4 fotogramas durante 150 ms.
- [ ] Perder la bola por debajo de la paleta resta una vida y la bola vuelve a la paleta en estado `ready`.
- [ ] Limpiar el nivel N (N < 8) carga el nivel N + 1 sin intervención, conserva puntos y vidas, y la bola espera en la paleta; la velocidad es la de `LEVELS[N].speed`.
- [ ] La barra superior (puntuación, nivel, vidas) coincide con los valores internos del motor.
- [ ] El canvas no dibuja puntuación, nivel, vidas, menú de pausa, «GAME OVER» ni «YOU WIN!».
- [ ] Con 0 vidas se abre el modal «FIN DEL JUEGO» con la puntuación final correcta, una sola vez.
- [ ] Limpiar el nivel 8 abre el modal con la puntuación final, una sola vez.
- [ ] PAUSA congela bola, paleta y explosiones, y las teclas no mueven la paleta; REANUDAR continúa sin saltos y sin que la animación de una explosión se corte.
- [ ] FIN abre el modal con la puntuación actual sin esperar a perder.
- [ ] En el modal se pueden escribir iniciales con espacio y flechas sin que el juego reaccione.
- [ ] GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'bloque-buster'`, el nombre en mayúsculas y la puntuación final, y una copia en `av_scores`.
- [ ] La marca aparece en `/salon` (pestaña ARKANOID) y en `/juegos/bloque-buster` sin reiniciar el servidor; `best` y `plays` de la tarjeta se actualizan.
- [ ] Si la inserción falla, el modal muestra el error, conserva `av_scores`, no marca como guardada la partida y permite reintentar.
- [ ] JUGAR DE NUEVO reinicia en nivel 1, 0 puntos y 3 vidas, y no duplica listeners ni bucles (una pulsación de `ESPACIO` lanza una sola vez).
- [ ] SALIR, VOLVER AL VAULT o cambiar de ruta detiene el loop y quita los listeners.
- [ ] Con el sonido activado suena el rebote al chocar con paredes, paleta o bloque gris sin romper, y el sonido de rotura al romper un bloque.
- [ ] El toggle de la segunda fila de `.player-hud` tiene el mismo estilo que el de Tetris, silencia y reactiva el sonido al instante (también en pausa) y no hace que `ESPACIO` lo vuelva a pulsar.
- [ ] Recargar `/juegos/bloque-buster/jugar` conserva la preferencia desde `av_arkanoid_prefs`; con `localStorage` bloqueado o un valor inválido el sonido queda activado sin errores.
- [ ] El panel de sonido no aparece en ningún otro juego.
- [ ] Sin errores de hidratación al recargar `/jugar`.
- [ ] A 375 px, 768 px y 1280 px no hay scroll horizontal y el canvas 800×600 se escala sin deformarse (4:3).
- [ ] Asteroids y Tetris se juegan y guardan igual que antes.
- [ ] Los otros 6 juegos no registrados siguen simulados y no crean filas en `scores`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** reemplazar `bloque-buster` en lugar de crear `arkanoid`. Decisión explícita del usuario; conserva el `id`, los enlaces y la posición, y evita dos juegos de bloques en la biblioteca.
- **Sí:** el id registrado en `REGISTRY` y en `scores.game_id` es `bloque-buster`, no `arkanoid`, aunque el título sea ARKANOID. Cambiar el id rompería enlaces y la clave de las marcas.
- **Sí:** conservar `cat`, `cover` (`cover-bricks`) y `color` (`cyan`) del placeholder. Ya describen un juego de bloques y no hace falta portada nueva.
- **Sí:** motor desacoplado en `lib/games/arkanoid/` que implementa `GameEngine`; el HUD vive solo en la barra de React.
- **Sí:** conservar los 8 niveles con avance automático al completar cada uno. Decisión explícita del usuario.
- **No:** selección manual de nivel ni menú de pausa del original. Decisión explícita del usuario; los sustituyen PAUSA, FIN y JUGAR DE NUEVO de React.
- **No:** `ESC` ni `Enter` en el motor. La pausa es solo el botón PAUSA; evita ampliar el contrato `GameEngine` con eventos de pausa (misma decisión que Tetris).
- **Sí:** victoria al limpiar el nivel 8 termina la partida con `onGameOver`. Decisión explícita del usuario; no hay bucle infinito ni mecánica nueva.
- **Sí:** sonido incluido, con toggle SONIDO / SILENCIO en la barra `.player-hud`. Decisión explícita del usuario, aunque la recomendación era dejarlo fuera.
- **Sí:** sonido activado por defecto. El original suena siempre; los navegadores solo permiten reproducir tras un gesto y `ESPACIO` (el lanzamiento) lo es.
- **Sí:** el toggle vive en React (segunda fila de `.player-hud`) y el motor expone `setMuted`. Mantiene el motor sin DOM y repite el patrón de `TetrisOptionsPanel`.
- **Sí:** preferencia de sonido en `localStorage` (`av_arkanoid_prefs`), con sonido activado si falla.
- **Sí:** assets en `public/games/bloque-buster/`, cargados por ruta absoluta (`/games/bloque-buster/...`). Las rutas relativas del original dependen de la página.
- **Sí:** el spritesheet se dibuja directamente desde un `HTMLImageElement`, sin el canvas auxiliar del original. Ese canvas existía para leer píxeles sin servidor HTTP y aquí no aporta.
- **Sí:** el texto «ESPACIO PARA LANZAR» se dibuja en el canvas. React no conoce el estado `ready` y sin esa pista el jugador no sabe cómo empezar.
- **Sí:** sprites originales sin recolorear. Son el aspecto del juego y encajan en el marco CRT.
- **Sí:** `onStats` solo cuando cambian los valores.
- **Sí:** guardar en Supabase y `localStorage` a la vez (SPEC 06).
- **No:** iframe ni `<Script>` con el JS original.
- **No:** táctil, ratón, gamepad, power-ups ni multibola.

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                                                                           |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta el efecto dos veces y duplica loops o listeners       | `destroy()` idempotente y llamado siempre en el cleanup; criterio de JUGAR DE NUEVO.                                                                 |
| `onStats` por frame satura a React                                            | Emitir solo cuando cambian `score`, `level` o `lives`.                                                                                               |
| `cacheComponents` afecta a `/jugar`                                           | El motor solo se instancia en el cliente dentro de `useEffect`.                                                                                      |
| El port cambia la jugabilidad respecto al original                            | Conservar constantes y comparar en paralelo con la referencia (paso 8).                                                                              |
| La imagen tarda en cargar o `destroy()` llega antes que ella                  | El loop arranca al resolverse la carga; una bandera `destroyed` impide arrancar tras `destroy()`. Un error de carga se registra con `console.error`. |
| Los navegadores bloquean `Audio.play()` sin gesto previo                      | Los sonidos solo se disparan durante la partida, después de `ESPACIO`; `play()` captura el rechazo.                                                  |
| Sonidos solapados o cortados al repetirse en pocos milisegundos               | Se conserva el comportamiento del original (`currentTime = 0` y `play()`); si resulta molesto en el paso 8, se decide en un spec aparte.             |
| El toggle de sonido roba el foco y `ESPACIO` lo vuelve a pulsar               | Tras pulsarlo se llama a `blur()`, como hace Tetris; el motor además ignora eventos con `target` `select`, `input` o `textarea`.                     |
| La bola atraviesa bloques o paleta a velocidades altas                        | Se conservan los sub-pasos de `MAX_STEP_PX = 8` y `MAX_DT = 0.05`.                                                                                   |
| Pausar en medio de una explosión la deja a medias o la acorta                 | `pause()` guarda la hora y `resume()` desplaza `start`; el dibujo usa la hora de pausa mientras está pausado.                                        |
| Una tecla queda «pulsada» tras pausar o perder el foco                        | Al pausar se limpia el mapa de teclas, como en el original.                                                                                          |
| El canvas 800×600 se pixela al escalarlo por CSS                              | El spritesheet es pixel art; se acepta el suavizado por defecto del navegador, igual que el original, y se revisa en 375/768/1280 px.                |
| Hidratación: leer `localStorage` durante el render difiere servidor y cliente | La preferencia se lee en `useEffect` y el motor se crea tras leerla; hasta entonces se usan los valores por defecto.                                 |
| Al limpiar el nivel 8 `onGameOver` se dispara dos veces (victoria y fin)      | El motor marca `gameover` al primer disparo y el criterio de aceptación exige una sola apertura del modal.                                           |
| El README del original difiere de `game.js`                                   | La fuente de verdad es `game.js`: los niveles y el menú de pausa están en el código, pero el menú no se porta.                                       |
| Cualquiera puede insertar puntuaciones falsas con la clave pública            | Riesgo aceptado en SPEC 06; el antifraude va con Auth en otro spec.                                                                                  |

## Qué **no** está en este spec

- Cambios en los otros 7 juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Menú de pausa del original, selección manual de nivel, `ESC` y `Enter`.
- Pantallas «PAUSED», «GAME OVER» y «YOU WIN!» en el canvas.
- Música, control de volumen y toggle de sonido en otros juegos.
- Power-ups, multibola, paleta variable, niveles aleatorios y editor de niveles.
- Pantalla de título, nombres de nivel, progreso guardado y desbloqueo de niveles.
- Recoloreo neón o portada nueva.
- Supabase Auth, antifraude y paginación del leaderboard.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
