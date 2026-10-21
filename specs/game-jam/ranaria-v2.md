# SPEC JAM — Juego FROGGER (v2 extendido) jugable dentro de Arcade Vault con leaderboard

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-10-20
> **Variante:** v2 extendido — Frogger con los peligros y bonus del arcade (tortugas que se sumergen, cocodrilos, serpiente en la mediana, moscas y cocodrilos en las casillas), salto animado, vida extra y panel de opciones con skin y nivel inicial persistidos en `localStorage`.
> **Objetivo:** Crear Frogger con peligros por nivel y panel de opciones como motor de canvas desacoplado, registrarlo en `REGISTRY` reemplazando el placeholder `ranaria` y guardar sus marcas en el leaderboard de Supabase.

## Por qué existe este spec

Frogger es el clásico de Konami (1981): una rana cruza una carretera con tráfico y un río con troncos y tortugas hasta llegar a una de las cinco casillas de la orilla superior. Sería el quinto juego real del Vault, después de Asteroids (SPEC 05), Tetris (SPEC 07), Arkanoid (SPEC 08) y Snake (SPEC 09). El contrato `GameEngine`, el registro `lib/games/registry.ts` y el `GameCanvas` genérico ya existen, así que este spec solo añade un motor, un panel de opciones y su integración.

El juego reemplaza al placeholder `ranaria` (ARCADE, `cover-rana`, `green`, `position` 7): el nombre y la portada ya describen una rana y no hay otro juego de cruzar en el catálogo. Las marcas de `ranaria` son simuladas y no escriben en `scores`, así que no hay datos que migrar.

No hay código de referencia en `references/started-games/` ni assets en `references/source-assets/`: las mecánicas, constantes y la puntuación se definen aquí y todo se dibuja con formas en el canvas.

Esta es la variante **extendida**. Frente a la v1 (núcleo con salto instantáneo y solo velocidad como dificultad), añade la progresión de peligros del arcade: cada nivel introduce algo nuevo además de acelerar. Repite el patrón de opciones de Tetris (`prefs.ts` + panel en la segunda fila de `.player-hud`). La v3 cambia la estructura a un cruce infinito con desplazamiento vertical.

## Alcance

**Dentro:**

- Motor `FroggerEngine` en `lib/games/frogger/` (`engine.ts`, `lanes.ts`, `skins.ts`, `prefs.ts`) que implementa `GameEngine` y se registra en `lib/games/registry.ts` con el id `ranaria`.
- Tablero de 20×15 filas de 40 px sobre un canvas lógico de 800×600, de arriba abajo: fila 0 seto decorativo, fila 1 orilla con 5 casillas, filas 2–6 río, fila 7 mediana, filas 8–12 carretera, fila 13 salida y fila 14 barra de tiempo.
- La rana aparece en la fila 13, centrada (`x = 400`), mirando hacia arriba.
- Salto animado de 90 ms: la rana viaja de la casilla de origen a la de destino con un leve aumento de escala; durante el salto no se comprueban colisiones ni ahogamiento; al aterrizar, sí. Se guarda en búfer como máximo 1 salto pulsado durante el salto en curso.
- Carretera: 5 carriles de coches y camiones; tocar un vehículo mata.
- Río: 5 carriles de troncos y grupos de tortugas; la rana es arrastrada por la plataforma; caer al agua o salir del canvas arrastrada mata.
- Tortugas que se sumergen: en las filas 3 y 6, uno de cada dos grupos se sumerge de forma cíclica (aviso de 600 ms, sumergido 1200 ms); sumergido no sostiene a la rana.
- Cocodrilo en el río desde el nivel 3: en la fila 4 uno de los troncos pasa a ser un cocodrilo de 4 celdas; el cuerpo sostiene a la rana y la cabeza (la celda delantera) mata.
- Serpiente en la mediana desde el nivel 2: 3 celdas de largo, patrulla la fila 7 de lado a lado y rebota en los bordes; tocarla mata.
- Moscas: cada 6 s aparece una mosca durante 4 s en una casilla libre al azar; entrar en esa casilla suma 200 además de lo normal.
- Cocodrilo en las casillas desde el nivel 2: cada 7 s una casilla libre al azar muestra una cabeza de cocodrilo durante 3 s; entrar en ella mata.
- Temporizador de 30 s por rana, dibujado como barra en la fila 14; agotarlo mata.
- 3 vidas, una vida extra al llegar a 10 000 puntos (una sola vez), con un máximo de 5.
- Muerte: resta una vida, muestra la rana aplastada (carretera) o salpicadura (río) 800 ms y saca una rana nueva; con 0 vidas la partida termina.
- Nivel: al ocupar las 5 casillas se vacían, sube el nivel y los carriles se aceleran un 15 % sobre la base, hasta ×2,2.
- Puntuación: 10 por fila nueva alcanzada en la vida de la rana, 50 por casilla, 200 por mosca, 10 por segundo restante al llegar y 1000 al completar las 5 casillas.
- 2 skins dibujados con formas: `neon` (contornos con brillo sobre fondo negro, paleta del sitio) y `arcade` (rellenos planos con los colores del Frogger original: asfalto negro, río azul marino, troncos marrones, tortugas rojas, rana verde). Se cambian en vivo, también en pausa.
- Nivel inicial de 1 a 5: se aplica al iniciar o en el siguiente JUGAR DE NUEVO; los peligros de ese nivel están activos desde el principio.
- Panel `components/ranaria-options.tsx` en la segunda fila de la barra `.player-hud`, solo para `ranaria`, con el mismo diseño que `TetrisOptionsPanel` (etiqueta `.l`, fuente pixel, controles achaflanados): toggle SKIN (NEÓN / ARCADE) y select NIVEL INICIAL.
- Preferencias en `localStorage` bajo la clave `av_ranaria_prefs`; si falla, valores por defecto (`neon`, nivel 1).
- Migración `supabase/migrations/<timestamp>_game_frogger.sql`: UPDATE del placeholder `ranaria` conservando `id`, `position`, `cat`, `cover` y `color`.
- `GamePlayer` ramifica para `ranaria` solo en el panel de opciones, con el mismo patrón que Tetris y Arkanoid; el resto del flujo (insert en `scores`, `av_scores`, `revalidateScores`, `controls-hint` desde `REGISTRY`) ya es genérico.
- Guardado en `scores` (`game_id = 'ranaria'`) + copia local `av_scores` + `revalidateScores`, con los estados guardando, guardado y error con reintento (patrón del SPEC 06).
- Línea de controles bajo la CRT: `← ↑ → ↓` o `W A S D` saltar.

**Fuera de alcance (para specs futuros):**

- Cambios en los otros juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Sonido y música.
- Nutrias, rana hembra y boca del cocodrilo que se abre y cierra: la cabeza mata siempre.
- Sprites o assets propios: los dos skins se dibujan con formas.
- Distinguir o limitar las marcas según el nivel inicial.
- Pantalla de título, «GAME OVER» o banners de nivel dibujados en el canvas.
- Antifraude, Supabase Auth, paginación del leaderboard.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```ts
// lib/games/frogger/engine.ts
export type FroggerSkin = "neon" | "arcade";
export interface FroggerOptions {
  skin: FroggerSkin;
  startLevel: number; // 1–5
}

export class FroggerEngine implements GameEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    options?: Partial<FroggerOptions>,
  );
  setSkin(skin: FroggerSkin): void; // repinta aunque esté en pausa
  setStartLevel(level: number): void; // aplica en el próximo start/restart
  // start, pause, resume, restart, end, destroy (idempotente)
}
```

```ts
// lib/games/frogger/lanes.ts — tabla de carriles del nivel 1
export type LaneKind = "car" | "truck" | "log" | "turtles";
export interface LaneDef {
  row: number; // 2–6 río, 8–12 carretera
  kind: LaneKind;
  length: number; // celdas de 40 px por objeto
  count: number; // objetos repartidos a distancia igual
  speed: number; // px/s en el nivel 1; negativo = izquierda
  diving?: boolean; // tortugas: los grupos de índice impar se sumergen
}
export const LANES: LaneDef[];
```

| Fila | Tipo      | Largo | Cantidad | Velocidad nivel 1 | Especial                               |
| ---- | --------- | ----- | -------- | ----------------- | -------------------------------------- |
| 2    | `log`     | 4     | 3        | +70               |                                        |
| 3    | `turtles` | 2     | 4        | −65               | `diving`                               |
| 4    | `log`     | 6     | 2        | +85               | el objeto 0 es cocodrilo desde nivel 3 |
| 5    | `log`     | 3     | 3        | +55               |                                        |
| 6    | `turtles` | 3     | 4        | −45               | `diving`                               |
| 8    | `truck`   | 2     | 2        | −60               |                                        |
| 9    | `car`     | 1     | 2        | +140              |                                        |
| 10   | `car`     | 1     | 3        | −90               |                                        |
| 11   | `car`     | 1     | 3        | +70               |                                        |
| 12   | `car`     | 1     | 3        | −50               |                                        |

```ts
// lib/games/frogger/skins.ts — colores por skin, sin leer CSS del DOM
export const SKINS: Record<
  FroggerSkin,
  {
    bg: string;
    road: string;
    river: string;
    median: string;
    hedge: string;
    car: string[];
    truck: string;
    log: string;
    turtle: string;
    croc: string;
    snake: string;
    frog: string;
    fly: string;
    timer: string;
    glow: number; // blur del brillo; 0 en arcade
  }
>;
```

```ts
// lib/games/registry.ts — entrada nueva (el id es el del catálogo, no "frogger")
ranaria: {
  create: (canvas, cb, options) =>
    new FroggerEngine(canvas, cb, options as Partial<FroggerOptions> | undefined),
  width: 800,
  height: 600,
  controls: [
    { keys: ["←", "↑", "→", "↓"], label: "saltar" },
    { keys: ["W", "A", "S", "D"], label: "saltar" },
  ],
},
```

```ts
// localStorage — clave "av_ranaria_prefs" (lib/games/frogger/prefs.ts: PREFS_KEY, DEFAULT_PREFS, loadPrefs, savePrefs)
{ skin: "neon", startLevel: 1 } // FroggerOptions; un valor inválido se descarta y se usa el defecto
```

```sql
-- supabase/migrations/<timestamp>_game_frogger.sql
update public.games
set title = 'FROGGER',
    short = 'Cruza la carretera y el río y llena las cinco casillas.',
    long  = '<texto en español: tráfico, troncos y tortugas que se hunden, cocodrilos y serpiente según el nivel, moscas de bonus, 30 segundos por rana, 3 vidas>'
where id = 'ranaria';
```

Estado interno del motor (encapsulado en la clase, no en globals):

- `state`: `'playing' | 'dying' | 'clearing' | 'gameover'`. La pausa es un indicador aparte (`paused`), porque la gestiona React.
- `frog: { x, row, facing }`, `hop: { fromX, fromRow, toX, toRow, t } | null`, `bufferedHop` (dirección o `null`), `bestRow`.
- `lanes: { def, objects: { x, kind, phase }[], speed }[]`; `phase` es el desfase en ms del ciclo de inmersión.
- `snake: { x, dir } | null`; `homes: ('empty' | 'frog' | 'fly' | 'croc')[5]`, `homeTimer` (ms hasta el próximo evento de mosca o cocodrilo) y `homeEventLeft`.
- `timeLeft` (s), `stateTimer` (ms), `elapsed` (ms de juego, para los ciclos), `deathKind` (`'squash' | 'splash'`).
- `score`, `level`, `lives`, `extraLifeGiven`, `skin`, `startLevel`.

Constantes del motor:

- `W = 800`, `H = 600`, `CELL = 40`, `ROWS = 15`.
- `HOME_ROW = 1`, `RIVER_ROWS = 2..6`, `MEDIAN_ROW = 7`, `ROAD_ROWS = 8..12`, `START_ROW = 13`, `TIMER_ROW = 14`.
- `START_X = 400`, `MIN_X = 40`, `MAX_X = 760`.
- `HOME_X = [80, 240, 400, 560, 720]`, `HOME_W = 48`, `HOME_TOLERANCE = 20`.
- `FROG_SIZE = 32`, `FROG_HIT_INSET = 6`, `HOP_MS = 90`, `HOP_SCALE = 1.25`, `MAX_BUFFERED_HOPS = 1`.
- `START_LIVES = 3`, `MAX_LIVES = 5`, `EXTRA_LIFE_SCORE = 10000`.
- `TIME_LIMIT_S = 30`, `DEATH_MS = 800`, `CLEAR_MS = 1000`.
- `HOP_POINTS = 10`, `HOME_POINTS = 50`, `FLY_POINTS = 200`, `TIME_BONUS_PER_S = 10`, `LEVEL_BONUS = 1000`.
- `LEVEL_SPEED_STEP = 0.15`, `MAX_SPEED_MULT = 2.2`, `WRAP_MARGIN = 240`, `MAX_DT = 0.05`.
- `DIVE_SURFACE_MS = 3200`, `DIVE_WARN_MS = 600`, `DIVE_UNDER_MS = 1200` (ciclo de 5000 ms).
- `CROC_LEVEL = 3`, `CROC_LENGTH = 4`.
- `SNAKE_LEVEL = 2`, `SNAKE_LENGTH = 3`, `SNAKE_SPEED = 60`.
- `FLY_INTERVAL_MS = 6000`, `FLY_MS = 4000`, `HOME_CROC_LEVEL = 2`, `HOME_CROC_INTERVAL_MS = 7000`, `HOME_CROC_MS = 3000`.
- `MIN_START_LEVEL = 1`, `MAX_START_LEVEL = 5`.

Convenciones:

- Coordenadas con origen arriba a la izquierda; la fila `r` ocupa `y` de `r × 40` a `r × 40 + 40`.
- Loop con `requestAnimationFrame` y `dt` en segundos limitado a `MAX_DT`; los objetos avanzan `speed × dt`.
- Multiplicador de nivel: `min(MAX_SPEED_MULT, 1 + LEVEL_SPEED_STEP × (level − 1))`; afecta a carriles y serpiente.
- Reparto y envoltura de carriles: `LANE_SPAN = W + 2 × WRAP_MARGIN`; el objeto `i` empieza en `−WRAP_MARGIN + i × LANE_SPAN / count`; al salir por un lado se desplaza `LANE_SPAN`.
- Salto: una pulsación es un salto; se ignora `e.repeat`. Si hay un salto en curso, la dirección se guarda en `bufferedHop` (la última pulsada sustituye a la anterior) y se ejecuta al aterrizar. Saltos fuera de `MIN_X..MAX_X` o por debajo de `START_ROW` se ignoran.
- Durante el salto en el río, el destino se desplaza con la plataforma de la fila de origen; al aterrizar se evalúa la fila de destino.
- Al aterrizar en mediana, carretera o salida, `x` se ajusta al múltiplo de 40 más cercano dentro de `MIN_X..MAX_X`.
- Carretera y serpiente: muere si el rectángulo de la rana reducido `FROG_HIT_INSET` por lado se solapa con el obstáculo. Se comprueba cada frame mientras no hay salto en curso.
- Río: a salvo si el centro de la rana cae dentro de un objeto que sostiene (tronco, cuerpo de cocodrilo o tortuga no sumergida); entonces `x += speed × dt`. Sobre la cabeza del cocodrilo (los 40 px delanteros según la dirección) muere. Si no hay soporte, muere ahogada; si el arrastre lleva su centro fuera de `0..W`, muere.
- Inmersión: un grupo `diving` de índice impar sigue el ciclo `(elapsed + phase) mod 5000`: superficie hasta 3200, aviso hasta 3800 (se dibuja medio hundido y aún sostiene), sumergido hasta 5000. `phase` = `i × 1250`.
- Serpiente: aparece en `x = 0` al empezar un nivel ≥ `SNAKE_LEVEL`, avanza `SNAKE_SPEED × mult` y cambia de sentido al tocar `0` o `W`.
- Casillas: al aterrizar en la fila 1, si `|x − HOME_X[i]| ≤ HOME_TOLERANCE`: `empty` o `fly` la ocupan (`frog`); `croc` o `frog` matan; sin casilla, muere en el seto.
- Eventos de casilla: cada `FLY_INTERVAL_MS` se pone `fly` en una casilla `empty` al azar durante `FLY_MS`; desde `HOME_CROC_LEVEL`, cada `HOME_CROC_INTERVAL_MS` se pone `croc` en una `empty` al azar durante `HOME_CROC_MS`. Si no hay casilla libre, el evento se salta.
- Puntos por avance: `HOP_POINTS` cuando `row < bestRow`; `bestRow` vuelve a `START_ROW` con cada rana nueva.
- Al llegar a casilla: `HOME_POINTS + TIME_BONUS_PER_S × floor(timeLeft)`, más `FLY_POINTS` si había mosca. Con las 5 ocupadas: `LEVEL_BONUS`, estado `clearing` durante `CLEAR_MS`, casillas vacías, `level + 1`, carriles con la velocidad nueva y peligros del nivel nuevo.
- Vida extra: al cruzar `EXTRA_LIFE_SCORE` por primera vez, `lives = min(MAX_LIVES, lives + 1)`.
- `dying`: el mundo sigue moviéndose, la entrada y el búfer se ignoran; al terminar `DEATH_MS` sale una rana nueva o, con `lives = 0`, se llama a `onGameOver(score)` una sola vez.
- Teclas del juego: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `KeyW`, `KeyA`, `KeyS`, `KeyD`. El motor llama a `preventDefault` en ellas e ignora eventos con `target` `input`, `textarea` o `select`.
- `onStats` emite `{ score, level, lives }` al iniciar, reiniciar y cuando cambia alguno.
- Al pausar se vacía `bufferedHop`; un salto en curso se completa al reanudar. `resume()` reinicia `lastTime`; `elapsed` no avanza en pausa.
- El motor dibuja la barra «TIEMPO» y la mosca o el cocodrilo de las casillas (React no los conoce), pero no puntuación, nivel, vidas ni overlays de pausa o game over.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de Server y Client Components y de `cacheComponents`. Usar `/frontend-design` para los dos skins, el panel de opciones y la línea de controles. La referencia de integración en `GamePlayer` es SPEC 07 (panel de opciones) y SPEC 09.

1. Migración del catálogo y `apply_migration`. Verificación: `select id, title, cover, color, position from games where id = 'ranaria'` devuelve FROGGER, `cover-rana`, `green` y `position = 7`; `get_advisors` sin avisos nuevos.
2. Datos: `lib/games/frogger/lanes.ts` (`LaneDef`, `LANES`) y `skins.ts` (`SKINS`), sin `document` ni `window`. Verificación: compila sin errores de tipos.
3. Motor base: `engine.ts` con estado encapsulado, carriles con envoltura, salto animado con búfer, ajuste a la cuadrícula, carretera, río, casillas, temporizador, vidas, niveles y puntuación, y `draw` con el skin activo. Verificación: compila.
4. Peligros y bonus: tortugas que se sumergen, cocodrilo del río, serpiente, moscas, cocodrilo en las casillas y vida extra, activados según el nivel. Verificación: compila; con `startLevel = 3` aparecen serpiente, cocodrilo del río y cocodrilo en las casillas.
5. Entrada, callbacks y ciclo de vida: teclado, `onStats`, `onGameOver` (una sola vez), `start`, `pause`, `resume`, `restart`, `end`, `destroy`, `setSkin`, `setStartLevel`. Verificación: compila; `destroy()` dos veces no lanza error.
6. Registro: añadir `ranaria` a `REGISTRY`. Verificación: `/juegos/ranaria/jugar` arranca la partida sola, con la barra mostrando puntuación, nivel y vidas reales.
7. Panel de opciones: `lib/games/frogger/prefs.ts` y `components/ranaria-options.tsx` montado en la segunda fila de `.player-hud` solo para `ranaria` (leído en `useEffect`, como Tetris); `GamePlayer` aplica `setSkin` en vivo y `setStartLevel` para el próximo reinicio. Verificación: cambiar el skin repinta al instante, también en pausa; recargar conserva las preferencias.
8. Revisión de jugabilidad: jugar del nivel 1 al 4 con ambos skins. Verificación: cada carril del río se puede cruzar con las tortugas sumergidas; el aviso de inmersión se distingue en los dos skins; si algo es imposible se ajusta en `lanes.ts` y se anota el cambio.
9. Limpieza: quitar importaciones muertas y ejecutar `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] `/juegos/ranaria` y `/juegos/ranaria/jugar` responden 200 y no hay errores en la consola del navegador.
- [ ] `ranaria` aparece en `/biblioteca` con el título FROGGER en el filtro ARCADE y como pestaña en `/salon`; ya no usa partida simulada.
- [ ] `games` sigue teniendo 9 filas y `ranaria` conserva `position = 7`, `cover-rana` y `green`.
- [ ] La partida empieza sola al entrar en `/jugar`: rana en la fila 13 centrada, carriles en movimiento y barra de tiempo llena.
- [ ] `↑` `↓` `←` `→` y `W` `S` `A` `D` hacen saltar la rana con una animación de 90 ms; mantener la tecla pulsada produce un solo salto.
- [ ] Una tecla pulsada durante un salto se ejecuta al aterrizar; dos pulsadas durante el mismo salto producen un solo salto extra (la última).
- [ ] Pulsar flechas en la pantalla de juego no hace scroll en la página.
- [ ] Tocar un coche o camión resta una vida; un coche que cruza la casilla durante el salto no mata si al aterrizar ya no hay solapamiento.
- [ ] Sobre un tronco o tortuga la rana se desplaza con él; saltar al agua o ser arrastrada fuera del canvas resta una vida.
- [ ] En las filas 3 y 6, los grupos de tortugas de índice impar se hunden cada 5 s: se ven medio hundidos 600 ms antes y, sumergidos, ahogan a la rana que esté encima.
- [ ] Desde el nivel 3 la fila 4 tiene un cocodrilo: su cuerpo sostiene a la rana y su cabeza la mata.
- [ ] Desde el nivel 2 una serpiente de 3 celdas patrulla la mediana y tocarla resta una vida; en el nivel 1 no hay serpiente.
- [ ] Cada 6 s aparece una mosca 4 s en una casilla libre; entrar con mosca suma 200 extra.
- [ ] Desde el nivel 2 aparece cada 7 s una cabeza de cocodrilo 3 s en una casilla libre; entrar en ella resta una vida.
- [ ] Entrar en una casilla libre la ocupa, suma 50 + 10 por segundo restante y saca una rana nueva con el tiempo lleno; el seto y las casillas ocupadas matan.
- [ ] Cada fila nueva alcanzada por la rana actual suma 10; retroceder y volver a avanzar no suma.
- [ ] Agotar los 30 s resta una vida.
- [ ] Ocupar las 5 casillas suma 1000, las vacía tras 1 s, sube el nivel y acelera los carriles un 15 % sobre la base, sin pasar de ×2,2.
- [ ] Al llegar a 10 000 puntos se gana una vida, una sola vez, sin pasar de 5.
- [ ] La barra superior (puntuación, nivel, vidas) coincide con los valores internos del motor.
- [ ] El canvas dibuja la barra «TIEMPO», moscas y cocodrilos de casilla, y no dibuja puntuación, nivel, vidas ni textos de pausa o game over.
- [ ] Perder la última vida abre el modal «FIN DEL JUEGO» con la puntuación final correcta, una sola vez.
- [ ] PAUSA congela carriles, rana, serpiente, ciclos de inmersión, eventos de casilla y temporizador; REANUDAR continúa sin saltos; durante la pausa las teclas no actúan.
- [ ] FIN abre el modal con la puntuación actual sin esperar a perder.
- [ ] En el modal se pueden escribir iniciales con flechas y `W` `A` `S` `D` sin que la rana se mueva.
- [ ] El panel de la segunda fila de `.player-hud` tiene el mismo estilo que el de Tetris y solo aparece en `ranaria`.
- [ ] Cambiar SKIN entre NEÓN y ARCADE repinta tablero, objetos y rana al instante, también en pausa.
- [ ] Elegir NIVEL INICIAL N y pulsar JUGAR DE NUEVO empieza en el nivel N con su velocidad y sus peligros.
- [ ] Usar el select del panel con flechas no mueve la rana.
- [ ] Recargar `/juegos/ranaria/jugar` conserva skin y nivel inicial desde `av_ranaria_prefs`; con `localStorage` bloqueado o un valor inválido se usan `neon` y nivel 1 sin errores.
- [ ] GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'ranaria'`, el nombre en mayúsculas y la puntuación final, y una copia en `av_scores`.
- [ ] La marca aparece en `/salon` (pestaña FROGGER) y en `/juegos/ranaria` sin reiniciar el servidor; `best` y `plays` de la tarjeta se actualizan.
- [ ] Si la inserción falla, el modal muestra el error, conserva `av_scores`, no marca como guardada la partida y permite reintentar.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos, el nivel inicial elegido, 3 vidas y casillas vacías, y no duplica listeners ni bucles (una pulsación produce un solo salto).
- [ ] SALIR, VOLVER AL VAULT o cambiar de ruta detiene el loop y quita los listeners.
- [ ] Sin errores de hidratación al recargar `/jugar`.
- [ ] A 375 px, 768 px y 1280 px no hay scroll horizontal y el canvas 800×600 se escala sin deformarse (4:3).
- [ ] Asteroids, Tetris, Arkanoid y Snake se juegan y guardan igual que antes.
- [ ] Los otros 4 juegos no registrados siguen simulados y no crean filas en `scores`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** definición rápida del game-jam, sin aclaración detallada del usuario.
- **Sí:** reemplazar `ranaria` en lugar de crear `frogger`. Es el placeholder de la rana, comparte categoría ARCADE y evita dos juegos de rana en la biblioteca.
- **Sí:** el id registrado en `REGISTRY` y en `scores.game_id` es `ranaria`, no `frogger`, aunque el título sea FROGGER. Cambiar el id rompería enlaces y la clave de las marcas.
- **Sí:** conservar `cat` (ARCADE), `cover` (`cover-rana`) y `color` (`green`) del placeholder. Ya existen en `app/globals.css` y describen una rana.
- **Sí:** progresión por peligros además de velocidad: nivel 2 serpiente y cocodrilo en casillas, nivel 3 cocodrilo en el río. Cada nivel cambia cómo se juega, no solo lo rápido.
- **Sí:** aceleración del 15 % por nivel con tope ×2,2, más suave que la v1. Los peligros ya suben la dificultad.
- **Sí:** tortugas que se sumergen con aviso visible de 600 ms. Sin aviso la muerte parece injusta.
- **Sí:** cabeza del cocodrilo siempre letal. La boca que se abre y cierra añade un ciclo más sin cambiar la decisión del jugador.
- **Sí:** salto animado de 90 ms sin colisiones en el aire y con búfer de 1 salto. Se siente como el arcade y no castiga pulsar rápido.
- **Sí:** vida extra única a 10 000 puntos, máximo 5. Como el original; repetirla inflaría las partidas largas.
- **Sí:** skins `neon` y `arcade` dibujados con formas. No hay assets en `references/source-assets/` y así el panel tiene algo visible que cambiar.
- **Sí:** nivel inicial 1–5 con el patrón de Tetris; el nivel inicial no distingue marcas. Se acepta hasta que haya antifraude.
- **Sí:** panel de opciones en la segunda fila de `.player-hud` y preferencias en `av_ranaria_prefs`. Mismo patrón que `TetrisOptionsPanel` y `ArkanoidOptionsPanel`.
- **Sí:** canvas lógico 800×600 con filas de 40 px y casillas en 80, 240, 400, 560 y 720. 4:3 como el resto y casillas simétricas alcanzables desde la cuadrícula.
- **Sí:** flechas y `WASD`. Estándar del Vault.
- **Sí:** la barra de tiempo, la mosca y el cocodrilo de casilla se dibujan en el canvas. React no los conoce.
- **Sí:** `onStats` solo cuando cambian los valores.
- **Sí:** guardar en Supabase y `localStorage` a la vez (SPEC 06).
- **No:** referencia en `references/started-games/`. No existe; las mecánicas se definen en este spec.
- **No:** nutrias ni rana hembra. Son variantes menores que no cambian la decisión del jugador.
- **No:** sonido. El Vault solo tiene sonido en Arkanoid y no hay assets de audio para Frogger.
- **No:** táctil, ratón ni gamepad.

## Riesgos

| Riesgo                                                                         | Mitigación                                                                                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| React Strict Mode monta el efecto dos veces y duplica loops o listeners        | `destroy()` idempotente y llamado siempre en el cleanup; criterio de JUGAR DE NUEVO.                                     |
| `onStats` por frame satura a React                                             | Emitir solo cuando cambian `score`, `level` o `lives`; el temporizador no pasa por `onStats`.                            |
| `cacheComponents` afecta a `/jugar`                                            | El motor solo se instancia en el cliente dentro de `useEffect`.                                                          |
| Hidratación: leer `localStorage` durante el render difiere servidor y cliente  | Las preferencias se leen en `useEffect` y el motor se crea tras leerlas; hasta entonces se usan los valores por defecto. |
| Un carril del río queda imposible con tortugas sumergidas o el cocodrilo       | Solo se hunden los grupos impares y sus fases están escalonadas `i × 1250`; el paso 8 cruza los niveles 1 a 4.           |
| El salto sin colisiones en el aire se aprovecha para atravesar coches          | Al aterrizar se comprueba el solapamiento; `HOP_MS = 90` es menor que el tiempo que un coche tarda en cruzar la rana.    |
| El búfer de salto encadena movimientos que el jugador no quería                | Máximo 1 salto en búfer, se vacía al morir y al pausar.                                                                  |
| La mosca y el cocodrilo coinciden en la misma casilla                          | Ambos eventos eligen solo entre casillas `empty`.                                                                        |
| El skin `arcade` hace ilegible el aviso de inmersión o la cabeza del cocodrilo | `skins.ts` define colores propios para tortuga, cocodrilo y aviso; el paso 8 revisa ambos skins.                         |
| El select del panel roba el foco y captura flechas                             | El motor ignora eventos con `target` `select`; tras cambiar una opción se llama a `blur()`, como en Tetris.              |
| El nivel inicial alto permite marcas infladas                                  | Riesgo aceptado y documentado; el antifraude real va en un spec con Auth.                                                |
| `onGameOver` se dispara dos veces (muerte y FIN a la vez)                      | El motor pasa a `gameover` al primer disparo e ignora los siguientes.                                                    |
| Cualquiera puede insertar puntuaciones falsas con la clave pública             | Riesgo aceptado en SPEC 06; el antifraude va con Auth en otro spec.                                                      |

## Qué **no** está en este spec

- Cambios en los otros juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Sonido y música.
- Nutrias, rana hembra y boca animada del cocodrilo.
- Sprites, portada nueva y pantallas de título o «GAME OVER» en el canvas.
- Distinguir o limitar las marcas según el nivel inicial.
- Supabase Auth, antifraude y paginación del leaderboard.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
