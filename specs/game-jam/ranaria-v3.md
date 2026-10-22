# SPEC JAM — Juego FROGGER (v3 infinito) jugable dentro de Arcade Vault con leaderboard

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-10-20
> **Variante:** v3 infinito — giro de mecánica: sin casillas ni temporizador; el mundo se genera al azar hacia arriba, la cámara sube sola y la puntuación es la distancia recorrida, con una sola vida.
> **Objetivo:** Crear un Frogger de cruce infinito con desplazamiento vertical como motor de canvas desacoplado, registrarlo en `REGISTRY` reemplazando el placeholder `ranaria` y guardar sus marcas en el leaderboard de Supabase.

## Por qué existe este spec

Frogger es el clásico de Konami (1981): una rana cruza una carretera y un río saltando de fila en fila. Sería el quinto juego real del Vault, después de Asteroids (SPEC 05), Tetris (SPEC 07), Arkanoid (SPEC 08) y Snake (SPEC 09). El contrato `GameEngine`, el registro `lib/games/registry.ts` y el `GameCanvas` genérico ya existen, así que este spec solo añade un motor y su integración.

El juego reemplaza al placeholder `ranaria` (ARCADE, `cover-rana`, `green`, `position` 7): el nombre y la portada ya describen una rana y no hay otro juego de cruzar en el catálogo. Las marcas de `ranaria` son simuladas y no escriben en `scores`, así que no hay datos que migrar.

No hay código de referencia en `references/started-games/` ni assets en `references/source-assets/`: las mecánicas, constantes y la puntuación se definen aquí y todo se dibuja con formas en el canvas.

Esta es la variante **infinita**. Conserva el salto por casillas, los coches y los troncos de Frogger, pero cambia la estructura: no hay pantalla fija ni casillas de meta. Las v1 y v2 recrean el tablero clásico de una pantalla; esta variante da partidas de una sola vida, más cortas y con una puntuación que crece sin techo, lo que encaja con un leaderboard de récords.

## Alcance

**Dentro:**

- Motor `FroggerEngine` en `lib/games/frogger/` (`engine.ts`, `generator.ts`) que implementa `GameEngine` y se registra en `lib/games/registry.ts` con el id `ranaria`.
- Canvas lógico de 800×600 que muestra 15 filas de 40 px y 20 columnas de un mundo vertical infinito; la fila 0 del mundo es la salida y las filas crecen hacia arriba.
- La rana aparece en la fila 0 del mundo, centrada (`x = 400`), mirando hacia arriba, y salta una fila o 40 px por pulsación.
- Tres tipos de fila: césped (seguro), carretera (un carril de coches o camiones) y río (un carril de troncos). Se generan por bandas al azar delante de la cámara y se descartan al quedar por debajo.
- Las filas 0–3 son siempre césped. Después de una banda de río siempre viene césped.
- Carretera: tocar un vehículo mata. Río: la rana es arrastrada por el tronco; caer al agua o salir del canvas arrastrada mata.
- Moscas: algunas filas de césped tienen una mosca en una columna al azar; saltar sobre ella la come y suma 50.
- Cámara: está quieta hasta el primer salto hacia arriba; luego sube sola a una velocidad que crece con el nivel y acelera para no dejar a la rana a más de 9 filas del borde inferior.
- Si la cámara deja a la rana fuera por el borde inferior, la rana muere.
- Una sola vida. Morir muestra la rana aplastada o la salpicadura 800 ms y llama a `onGameOver(score)`.
- Puntuación: 10 por cada fila nueva alcanzada (distancia máxima) y 50 por mosca.
- Nivel: `1 + floor(filaMáxima / 25)`. Cada fila nace con la dificultad del nivel que le corresponde por su posición, así que la dificultad depende de la distancia y no del tiempo.
- Texto «SALTA PARA EMPEZAR» en el canvas mientras la cámara está quieta, porque React no conoce ese estado.
- Migración `supabase/migrations/<timestamp>_game_frogger.sql`: UPDATE del placeholder `ranaria` conservando `id`, `position`, `cat`, `cover` y `color`.
- Integración con `GamePlayer`: puntuación y nivel vienen de `onStats` (sin vidas: se muestra `—`); PAUSA, FIN y JUGAR DE NUEVO controlan el motor; el modal de guardar se abre en `onGameOver`. El resto del flujo (insert en `scores`, `av_scores`, `revalidateScores`, `controls-hint` desde `REGISTRY`) ya es genérico.
- Guardado en `scores` (`game_id = 'ranaria'`) + copia local `av_scores` + `revalidateScores`, con los estados guardando, guardado y error con reintento (patrón del SPEC 06).
- Línea de controles bajo la CRT: `← ↑ → ↓` o `W A S D` saltar.
- Estética neón con formas: césped verde oscuro con cuadrícula, asfalto con líneas discontinuas, río azul profundo, vehículos magenta y cian, troncos ámbar y una línea roja pulsante en el borde inferior que marca el límite de la cámara.

**Fuera de alcance (para specs futuros):**

- Cambios en los otros juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Sonido y música.
- Casillas de meta, temporizador y vidas: son de las v1 y v2.
- Tortugas, cocodrilos, serpientes, trenes, árboles o rocas que bloquean el paso.
- Semilla fija, mundo diario o repetición de partidas.
- Panel de opciones y `localStorage` propio.
- Sprites o assets propios: todo se dibuja con formas.
- Pantalla de título o «GAME OVER» dibujados en el canvas.
- Antifraude, Supabase Auth, paginación del leaderboard.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```ts
// lib/games/frogger/engine.ts
export class FroggerEngine implements GameEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks);
  // start, pause, resume, restart, end, destroy (idempotente)
}
```

```ts
// lib/games/frogger/generator.ts — sin document ni window
export type RowKind = "grass" | "road" | "river";
export interface WorldRow {
  index: number; // fila del mundo; 0 = salida
  kind: RowKind;
  speed: number; // px/s; negativo = izquierda; 0 en césped
  objects: { x: number; w: number; kind: "car" | "truck" | "log" }[];
  fly: number | null; // x del centro de la mosca o null
}
export function createGenerator(rng: () => number): {
  next(): WorldRow; // genera la siguiente fila hacia arriba
};
```

```ts
// lib/games/registry.ts — entrada nueva (el id es el del catálogo, no "frogger")
ranaria: {
  create: (canvas, cb) => new FroggerEngine(canvas, cb),
  width: 800,
  height: 600,
  controls: [
    { keys: ["←", "↑", "→", "↓"], label: "saltar" },
    { keys: ["W", "A", "S", "D"], label: "saltar" },
  ],
},
```

```sql
-- supabase/migrations/<timestamp>_game_frogger.sql
update public.games
set title = 'FROGGER',
    short = 'Cruza sin fin carreteras y ríos antes de que te alcance la cámara.',
    long  = '<texto en español: mundo infinito generado al azar, coches y troncos, moscas de bonus, la cámara sube sola, una vida, la dificultad crece con la distancia>'
where id = 'ranaria';
```

Estado interno del motor (encapsulado en la clase, no en globals):

- `state`: `'waiting' | 'playing' | 'dying' | 'gameover'`. `waiting` es antes del primer salto hacia arriba. La pausa es un indicador aparte (`paused`), porque la gestiona React.
- `frog: { x, row, facing }`: `x` en px (centro) y `row` fila del mundo; `bestRow`.
- `rows: WorldRow[]` con las filas vivas, de `firstRow` hacia arriba; `generator`.
- `cameraY` (px del mundo en el borde inferior de la vista), `cameraSpeed`.
- `score`, `level`, `stateTimer` (ms de `dying`), `deathKind` (`'squash' | 'splash' | 'camera'`).

Constantes del motor:

- `W = 800`, `H = 600`, `CELL = 40`, `VISIBLE_ROWS = 15`, `START_X = 400`, `MIN_X = 40`, `MAX_X = 760`.
- `FROG_SIZE = 32`, `FROG_HIT_INSET = 6`, `DEATH_MS = 800`, `MAX_DT = 0.05`.
- `SAFE_START_ROWS = 4`, `GEN_AHEAD_ROWS = 5`, `DISCARD_BELOW_ROWS = 2`.
- `ROW_POINTS = 10`, `FLY_POINTS = 50`, `FLY_CHANCE = 0.25`, `ROWS_PER_LEVEL = 25`.
- `CAMERA_BASE_SPEED = 10`, `CAMERA_SPEED_STEP = 2`, `CAMERA_MAX_SPEED = 30` (px/s), `FOLLOW_ROWS = 9`, `CATCHUP_SPEED = 240` (px/s).
- `WRAP_MARGIN = 160` (`LANE_SPAN = W + 2 × WRAP_MARGIN = 1120`).
- Bandas: césped 1–2 filas (peso 2), carretera 1–4 filas (peso 4), río 1–3 filas (peso 3).
- Carretera: coche de 1 celda (70 %) en grupos de 4 o camión de 2 celdas (30 %) en grupos de 2; velocidad base al azar entre `ROAD_MIN_SPEED = 60` y `ROAD_MAX_SPEED = 130`.
- Río: troncos de 3 o 4 celdas en grupos de 3; velocidad base al azar entre `RIVER_MIN_SPEED = 40` y `RIVER_MAX_SPEED = 80`; dentro de una banda de río las filas alternan dirección.
- Dificultad de una fila: `min(MAX_DIFFICULTY = 2.0, 1 + DIFFICULTY_STEP × (nivelDeLaFila − 1))` con `DIFFICULTY_STEP = 0.1` y `nivelDeLaFila = 1 + floor(index / ROWS_PER_LEVEL)`; multiplica la velocidad base.

Convenciones:

- Coordenadas del mundo con `y` creciendo hacia arriba: la fila `r` ocupa de `r × 40` a `r × 40 + 40`. En pantalla, `yPantalla = H − (r × 40 + 40 − cameraY)`.
- Loop con `requestAnimationFrame` y `dt` en segundos limitado a `MAX_DT`; los objetos avanzan `speed × dt` y se envuelven en `LANE_SPAN` como en un carril clásico; el objeto `i` empieza en `−WRAP_MARGIN + i × LANE_SPAN / count` más un desfase al azar.
- Generación: al iniciar se crean las filas 0 a `VISIBLE_ROWS + GEN_AHEAD_ROWS`; cada frame se generan filas mientras la más alta esté a menos de `GEN_AHEAD_ROWS` del borde superior, y se descartan las que quedan más de `DISCARD_BELOW_ROWS` por debajo de `cameraY`.
- El generador recibe `rng` (por defecto `Math.random`) para poder reproducir un mundo en desarrollo.
- Salto: una pulsación es un salto; se ignora `e.repeat`. Saltos fuera de `MIN_X..MAX_X` o a una fila que quedaría entera por debajo de `cameraY` se ignoran.
- Al aterrizar en césped o carretera, `x` se ajusta al múltiplo de 40 más cercano dentro de `MIN_X..MAX_X`; en el río no se ajusta.
- Carretera: muere si el rectángulo de la rana reducido `FROG_HIT_INSET` por lado se solapa con un vehículo de su fila. Se comprueba cada frame.
- Río: a salvo si el centro de la rana cae dentro de un tronco de su fila; entonces `x += speed × dt`. Si no, muere ahogada; si el arrastre lleva su centro fuera de `0..W`, muere.
- Mosca: si la rana aterriza en la fila de la mosca y `|x − fly| ≤ 20`, suma `FLY_POINTS` y `fly = null`.
- Puntos por distancia: `ROW_POINTS` cada vez que `row > bestRow`; `level = 1 + floor(bestRow / ROWS_PER_LEVEL)`.
- Cámara: en `waiting` no se mueve; el primer salto hacia arriba pasa a `playing`. En `playing`, `cameraSpeed = min(CAMERA_MAX_SPEED, CAMERA_BASE_SPEED + CAMERA_SPEED_STEP × (level − 1))`; si la rana está más de `FOLLOW_ROWS` filas por encima de `cameraY`, la cámara sube a `CATCHUP_SPEED` hasta recuperar esa distancia.
- Muerte por cámara: cuando el borde superior de la fila de la rana queda por debajo de `cameraY`.
- `dying`: el mundo sigue moviéndose y la cámara se detiene; la entrada se ignora; al terminar `DEATH_MS` se llama a `onGameOver(score)` una sola vez.
- Teclas del juego: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `KeyW`, `KeyA`, `KeyS`, `KeyD`. El motor llama a `preventDefault` en ellas e ignora eventos con `target` `input`, `textarea` o `select`.
- `onStats` emite `{ score, level }` (sin `lives`) al iniciar, reiniciar y cuando cambia alguno.
- `resume()` reinicia `lastTime`; durante la pausa las teclas no actúan y la cámara no sube.
- El motor dibuja «SALTA PARA EMPEZAR» en `waiting` y la línea del borde inferior, pero no puntuación, nivel ni overlays de pausa o game over.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de Server y Client Components y de `cacheComponents`. Usar `/frontend-design` para la paleta de las filas, la línea del borde de la cámara, la rana y la línea de controles. La referencia de integración en `GamePlayer` es SPEC 09.

1. Migración del catálogo y `apply_migration`. Verificación: `select id, title, cover, color, position from games where id = 'ranaria'` devuelve FROGGER, `cover-rana`, `green` y `position = 7`; `get_advisors` sin avisos nuevos.
2. Generador `lib/games/frogger/generator.ts` con bandas, reglas de seguridad (4 filas de césped iniciales, césped tras río), objetos, moscas y dificultad por fila. Verificación: compila; con un `rng` fijo, 200 filas generadas no tienen dos bandas de río seguidas.
3. Motor, mundo y dibujo: `lib/games/frogger/engine.ts` con estado encapsulado, filas vivas, envoltura de objetos, cámara y `draw` (filas, objetos, mosca, rana, línea del borde y «SALTA PARA EMPEZAR»), sin HUD ni overlays. Verificación: compila.
4. Rana y reglas: saltos, ajuste a la cuadrícula, arrastre, colisiones, moscas, muerte por cámara, puntuación y nivel. Verificación: compila.
5. Entrada, callbacks y ciclo de vida: teclado, `onStats`, `onGameOver` (una sola vez), `start`, `pause`, `resume`, `restart`, `end`, `destroy`. Verificación: compila; `destroy()` dos veces no lanza error.
6. Registro: añadir `ranaria` a `REGISTRY`. Verificación: `/juegos/ranaria/jugar` arranca sola en `waiting`, con la barra mostrando puntuación y nivel reales y `—` en vidas.
7. Revisión de jugabilidad: llegar a la fila 75 (nivel 4). Verificación: ninguna banda obliga a morir; la memoria de `rows` no crece con la distancia (se mantiene por debajo de 30 filas); si algo es injusto se ajustan las constantes de `generator.ts` y se anota el cambio.
8. Limpieza: quitar importaciones muertas y ejecutar `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] `/juegos/ranaria` y `/juegos/ranaria/jugar` responden 200 y no hay errores en la consola del navegador.
- [ ] `ranaria` aparece en `/biblioteca` con el título FROGGER en el filtro ARCADE y como pestaña en `/salon`; ya no usa partida simulada.
- [ ] `games` sigue teniendo 9 filas y `ranaria` conserva `position = 7`, `cover-rana` y `green`.
- [ ] La partida empieza sola al entrar en `/jugar`: rana en la fila de salida centrada, 4 filas de césped, carriles en movimiento y el texto «SALTA PARA EMPEZAR».
- [ ] La cámara no se mueve hasta el primer salto hacia arriba; después sube sola.
- [ ] `↑` `↓` `←` `→` y `W` `S` `A` `D` hacen saltar la rana una fila o 40 px; mantener la tecla pulsada produce un solo salto.
- [ ] La rana no sale por los laterales al saltar ni puede saltar a una fila que ya está fuera por abajo.
- [ ] Pulsar flechas en la pantalla de juego no hace scroll en la página.
- [ ] Las filas nuevas aparecen por arriba sin huecos y las que salen por abajo dejan de existir.
- [ ] Nunca hay dos bandas de río seguidas sin césped entre ellas.
- [ ] Tocar un coche o camión termina la partida.
- [ ] Sobre un tronco la rana se desplaza con él; saltar al agua o ser arrastrada fuera del canvas termina la partida.
- [ ] Si la cámara deja a la rana por debajo del borde inferior, la partida termina.
- [ ] Si la rana avanza deprisa, la cámara acelera y la rana nunca queda a más de 9 filas del borde inferior.
- [ ] Cada fila nueva alcanzada suma 10; retroceder y volver a avanzar no suma.
- [ ] Comer una mosca suma 50 y la mosca desaparece.
- [ ] El nivel de la barra sube a 2 en la fila 25, a 3 en la fila 50, y así cada 25 filas; las filas de niveles altos tienen objetos más rápidos y la cámara sube más deprisa, hasta 30 px/s.
- [ ] La barra superior muestra puntuación y nivel que coinciden con el motor y `—` en vidas.
- [ ] El canvas no dibuja puntuación, nivel ni textos de pausa o game over.
- [ ] Tras morir, la rana aplastada o la salpicadura se ve 800 ms y luego se abre el modal «FIN DEL JUEGO» con la puntuación final correcta, una sola vez.
- [ ] PAUSA congela filas, rana y cámara; REANUDAR continúa sin saltos; durante la pausa las teclas no actúan.
- [ ] FIN abre el modal con la puntuación actual sin esperar a perder.
- [ ] En el modal se pueden escribir iniciales con flechas y `W` `A` `S` `D` sin que la rana se mueva.
- [ ] GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'ranaria'`, el nombre en mayúsculas y la puntuación final, y una copia en `av_scores`.
- [ ] La marca aparece en `/salon` (pestaña FROGGER) y en `/juegos/ranaria` sin reiniciar el servidor; `best` y `plays` de la tarjeta se actualizan.
- [ ] Si la inserción falla, el modal muestra el error, conserva `av_scores`, no marca como guardada la partida y permite reintentar.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos, nivel 1, estado `waiting` y un mundo nuevo, y no duplica listeners ni bucles (una pulsación produce un solo salto).
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
- **Sí:** mundo infinito generado al azar en lugar del tablero clásico. Es el giro de esta variante: la puntuación no tiene techo y cada partida es distinta.
- **Sí:** una sola vida y sin temporizador. La cámara es la presión de tiempo; vidas y temporizador duplicarían esa presión.
- **Sí:** la cámara no arranca hasta el primer salto. La partida empieza sola (criterio común) sin castigar al jugador que aún no ha puesto las manos en el teclado.
- **Sí:** dificultad ligada a la posición de la fila, no al tiempo. Es determinista para cada fila y no cambia la velocidad de un carril mientras el jugador lo cruza.
- **Sí:** reglas de seguridad del generador (4 filas iniciales de césped, césped tras cada río, filas de río con direcciones alternas). Evitan situaciones sin salida sin tener que validar caminos.
- **Sí:** solo coches, camiones y troncos. Son lo esencial de Frogger; tortugas y cocodrilos van en otro spec si esta variante se elige.
- **Sí:** moscas en el césped. Dan una decisión de riesgo (desviarse por 50 puntos) sin añadir enemigos.
- **Sí:** canvas lógico 800×600 con filas de 40 px. 4:3 como Asteroids, Arkanoid y Snake; las 15 filas visibles dan margen para ver lo que viene.
- **Sí:** un salto por pulsación, sin repetición, y salto instantáneo. Cada salto es una decisión y no hace falta ventana de invulnerabilidad.
- **Sí:** flechas y `WASD`. Estándar del Vault.
- **Sí:** `short` del catálogo distinto al de las v1 y v2. Describe el modo infinito.
- **Sí:** `onStats` solo cuando cambian los valores; sin `lives`, la barra muestra `—` como Tetris y Snake.
- **Sí:** guardar en Supabase y `localStorage` a la vez (SPEC 06).
- **No:** referencia en `references/started-games/`. No existe; las mecánicas se definen en este spec.
- **No:** casillas de meta. No tienen sentido en un mundo sin final.
- **No:** obstáculos que bloquean el paso en el césped. Exigirían validar que siempre hay camino.
- **No:** semilla fija ni mundo diario. Van en otro spec; el `rng` inyectable deja la puerta abierta.
- **No:** panel de opciones, sonido, táctil, ratón ni gamepad.

## Riesgos

| Riesgo                                                                  | Mitigación                                                                                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta el efecto dos veces y duplica loops o listeners | `destroy()` idempotente y llamado siempre en el cleanup; criterio de JUGAR DE NUEVO.                                              |
| `onStats` por frame satura a React                                      | Emitir solo cuando cambian `score` o `level`.                                                                                     |
| `cacheComponents` afecta a `/jugar`                                     | El motor solo se instancia en el cliente dentro de `useEffect`.                                                                   |
| El generador crea un río imposible de cruzar                            | Troncos de 3–4 celdas en grupos de 3, direcciones alternas y césped tras cada banda de río; el paso 7 juega hasta la fila 75.     |
| La cámara mata al jugador que espera un tronco                          | `CAMERA_BASE_SPEED = 10` px/s tarda 4 s en recorrer una fila; el tope de 30 px/s deja más de 1 s por fila.                        |
| Las filas se acumulan en memoria en partidas largas                     | Se descartan las filas por debajo de `cameraY − DISCARD_BELOW_ROWS`; el paso 7 comprueba que `rows` se mantiene por debajo de 30. |
| Errores de redondeo al convertir coordenadas del mundo a pantalla       | `cameraY` en px reales y conversión en un único método; las colisiones se calculan en coordenadas del mundo, no de pantalla.      |
| A velocidad alta un coche atraviesa a la rana entre dos frames          | `MAX_DT = 0.05`: a dificultad ×2,0 el coche más rápido avanza 13 px por frame, menos que el ancho efectivo de la rana (20 px).    |
| Sin vidas la partida parece demasiado corta                             | Riesgo propio de la variante; si al jugar se percibe así, se valora un spec aparte con vidas o checkpoints.                       |
| `onGameOver` se dispara dos veces (muerte y FIN a la vez)               | El motor pasa a `gameover` al primer disparo e ignora los siguientes.                                                             |
| Las flechas hacen scroll o interfieren con el input del modal           | `preventDefault` solo en las teclas del juego e ignorar eventos cuyo `target` es `input`, `textarea` o `select`.                  |
| Cualquiera puede insertar puntuaciones falsas con la clave pública      | Riesgo aceptado en SPEC 06; el antifraude va con Auth en otro spec.                                                               |

## Qué **no** está en este spec

- Cambios en los otros juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Sonido y música.
- Casillas de meta, temporizador y vidas.
- Tortugas, cocodrilos, serpientes, trenes y obstáculos que bloquean el paso.
- Semilla fija, mundo diario y repeticiones.
- Panel de opciones, sprites, portada nueva y pantallas de título o «GAME OVER» en el canvas.
- Supabase Auth, antifraude y paginación del leaderboard.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
