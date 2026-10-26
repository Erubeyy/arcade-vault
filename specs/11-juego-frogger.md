# SPEC 11 — Juego Frogger jugable dentro de Arcade Vault con leaderboard

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 09, SPEC 10
> **Fecha:** 2026-10-25
> **Objetivo:** Crear Frogger como motor de canvas desacoplado (carretera, río con troncos y tortugas, cinco bocas destino, vidas, niveles y temporizador de ronda), registrarlo en `REGISTRY` reemplazando el placeholder `ranaria` y guardar sus marcas en el leaderboard de Supabase.

## Por qué existe este spec

Frogger es el quinto juego real del Vault, después de Asteroids (SPEC 05), Tetris (SPEC 07), Arkanoid (SPEC 08) y Snake (SPEC 09). El contrato `GameEngine`, el registro `lib/games/registry.ts`, el `GameCanvas` y el `GamePlayer` genéricos ya existen, así que este spec solo añade un motor y su integración. Parte de la variante de game-jam `01-frogger-core`, adaptada a la arquitectura real del proyecto: el spec original hablaba de un componente React `FroggerGame`, de una play-page propia y de un modal propio, cosas que `GamePlayer` ya resuelve de forma genérica.

Frogger **no tiene código de referencia** en `references/started-games/` ni assets: mecánicas, constantes y puntuación se definen aquí y todo se dibuja con primitivas de canvas.

El juego reemplaza al placeholder `ranaria` (ARCADE, `cover-rana`, `green`, `position` 7) en lugar de crear una entrada nueva: conserva `id`, enlaces y posición, y evita dos juegos de rana en la biblioteca. Las marcas de `ranaria` son simuladas y no escriben en `scores`, así que no hay datos que migrar. El id de catálogo y de `scores.game_id` es `ranaria`, aunque el título pase a ser FROGGER.

## Alcance

**Dentro:**

- Motor `FroggerEngine` en `lib/games/frogger/engine.ts` que implementa `GameEngine` y se registra en `lib/games/registry.ts` con el id `ranaria`.
- Tablero de 16×14 celdas de 40 px sobre un canvas lógico de 640×560. Filas (0 = arriba): 0 bocas destino, 1–6 río (6 carriles), 7 franja segura intermedia, 8–12 carretera (5 carriles), 13 franja de inicio.
- Carretera: coches (1–2 celdas) y camiones (3 celdas) por carril, con velocidad y sentido propios, en bucle continuo. Tocarlos mata.
- Río: troncos (2–4 celdas) y grupos de tortugas (2–3 celdas) por carril, en bucle. La rana solo sobrevive sobre un tronco o una tortuga visible. Las tortugas ciclan: 3 s visibles, 1,5 s bajo el agua (fase independiente por grupo); sumergidas no sirven de apoyo.
- Movimiento de la rana: saltos discretos de 1 celda en 4 direcciones con animación de 120 ms. No puede salir por los bordes laterales con un salto. Una pulsación durante un salto se guarda como un único salto pendiente.
- Montada sobre un tronco o tortuga, la rana es arrastrada con la entidad (su columna deja de ser entera). Si el arrastre la saca del tablero (centro fuera de `0..COLS`), muere.
- Bocas destino: 5 bocas de 2 columnas cada una (columnas `[1,3)`, `[4,6)`, `[7,9)`, `[10,12)`, `[13,15)`); el resto de la fila 0 es muro y matar al tocarlo. Una boca ocupada que se vuelve a pisar mata. Al llenar las 5 se completa la ronda y empieza la siguiente.
- Muertes: vehículo, caer al agua, tortuga que se sumerge bajo la rana, salir por los lados arrastrada, muro o boca ocupada en la fila 0, y agotar el temporizador de ronda.
- Vidas: 3. Cada muerte resta una y la rana reaparece en la fila 13, columna 8. Al llegar a 0, se emite `onStats` con `lives: 0` y luego `onGameOver(score)` una sola vez.
- Puntuación: +10 por cada fila avanzada hacia arriba por primera vez en la ronda; +50 al ocupar una boca más el bonus de tiempo (`segundos restantes × 10`, entero hacia abajo); +200 al completar la ronda.
- Temporizador de ronda: 15 s en el nivel 1, 1 s menos por nivel con mínimo de 8 s. Se reinicia con cada reaparición y cada ronda.
- Dificultad: cada nivel multiplica todas las velocidades por 1,15 (tope ×2,5 respecto al nivel 1).
- Integración con `GamePlayer`: puntuación, nivel y vidas vienen de `onStats`; PAUSA, FIN y JUGAR DE NUEVO controlan el motor; el modal de guardar se abre en `onGameOver`. El resto del flujo (insert en `scores`, `av_scores`, `revalidateScores`, `controls-hint` desde `REGISTRY`) ya es genérico.
- Entrada virtual (SPEC 10): `pad` en `REGISTRY` con la cruceta completa y `setInput`/`releaseInput` en el motor.
- Guardado en `scores` (`game_id = 'ranaria'`) + copia local `av_scores` + `revalidateScores`, con los estados guardando, guardado y error con reintento (patrón del SPEC 06).
- Línea de controles bajo la CRT: `← ↑ → ↓` o `W A S D` saltar.
- Migración `supabase/migrations/20261025120000_game_frogger.sql`: UPDATE del placeholder `ranaria` conservando `id`, `position`, `cat`, `cover` y `color`.
- Todo dibujado con primitivas de canvas (sin imágenes): fondo por zonas (carretera oscura, río azul oscuro, franjas seguras verde oscuro, bocas verde claro con borde dorado), coches con ruedas, camiones con cabina, troncos con vetas, tortugas con caparazón (sumergidas: contorno semitransparente) y la rana con ojos; las bocas ocupadas muestran una silueta de rana.

**Fuera de alcance (para specs futuros):**

- Sprites bitmap externos.
- Animaciones de muerte elaboradas (explosiones, partículas) y sonido.
- Power-ups: mosca en las bocas y cocodrilo disfrazado de tronco.
- HUD de puntuación, nivel o vidas dibujado en el canvas (lo hace la barra de `GamePlayer`).
- Opciones/preferencias persistidas, skins (los añade `skin-designer` en el paso de pulido) y adaptación móvil (la hace `mobile-porter`, salvo `pad`).
- Cambios en los otros juegos simulados.
- Antifraude, Supabase Auth, paginación y realtime del leaderboard.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```ts
// lib/games/frogger/engine.ts
export class FroggerEngine implements GameEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks);
  // start, pause, resume, restart, end, destroy (idempotente), setInput, releaseInput
}
```

```ts
// lib/games/registry.ts — entrada nueva (el id es el del catálogo, no "frogger")
ranaria: {
  create: (canvas, cb) => new FroggerEngine(canvas, cb),
  width: W, // 640
  height: H, // 560
  controls: [
    { keys: ["←", "↑", "→", "↓"], label: "saltar" },
    { keys: ["W", "A", "S", "D"], label: "saltar" },
  ],
  pad: { up: "Saltar arriba", down: "Saltar abajo", left: "Saltar a la izquierda", right: "Saltar a la derecha" },
},
```

```sql
-- supabase/migrations/20261025120000_game_frogger.sql
update public.games
set title = 'FROGGER',
    short = 'Cruza la carretera y el río sin convertirte en papilla.',
    long  = 'Guía a tu rana con las flechas o WASD a través de una carretera repleta de coches y camiones y de un río de troncos y tortugas que se sumergen. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.'
where id = 'ranaria';
```

Tipos locales del motor (no exportados):

```ts
type EntityKind = "car" | "truck" | "log" | "turtle";
interface Entity {
  col: number;
  width: number;
  kind: EntityKind;
  phase?: number;
} // phase: ms del ciclo de inmersión (solo tortugas)
interface Lane {
  row: number;
  dir: 1 | -1;
  speed: number;
  entities: Entity[];
} // speed en celdas/s ya escalada por nivel
interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
}
```

Estado interno del motor (encapsulado en la clase, no en globals):

- `state`: `'playing' | 'gameover'`. La pausa es un indicador aparte (`paused`), porque la gestiona React.
- `frog`, `lanes`, `goals: boolean[5]` (bocas ocupadas), `pendingDir` (un salto pendiente), `furthestRow` (fila más alta alcanzada en la ronda), `timeLeft` (ms), `lives`, `score`, `level`.

Constantes del motor:

- `COLS = 16`, `ROWS = 14`, `CELL = 40`, `W = 640`, `H = 560`.
- Filas: `ROW_GOALS = 0`, `ROW_RIVER_TOP = 1`, `ROW_RIVER_BOT = 6`, `ROW_SAFE_MID = 7`, `ROW_ROAD_TOP = 8`, `ROW_ROAD_BOT = 12`, `ROW_START = 13`. Reaparición: `START_COL = 8`.
- `JUMP_MS = 120`, `START_LIVES = 3`, `BASE_TIME_MS = 15000`, `TIME_STEP_MS = 1000`, `MIN_TIME_MS = 8000`.
- `TURTLE_UP_MS = 3000`, `TURTLE_DOWN_MS = 1500`, `SPEED_PER_LEVEL = 1.15`, `MAX_SPEED_MULT = 2.5`, `LOOP_LEN = COLS + 4`, `MAX_FRAME_MS = 100`.
- Puntos: `POINTS_ROW = 10`, `POINTS_GOAL = 50`, `POINTS_ROUND = 200`, `POINTS_TIME = 10` (por segundo restante).
- `GOALS = [1, 4, 7, 10, 13]` (columna inicial de cada boca; ancho 2).

Tabla de carriles del nivel 1 (`speed` en celdas/s, `dir`: +1 → derecha). Cada carril reparte `count` entidades a intervalos iguales sobre `LOOP_LEN`, con fase inicial distinta por carril; todos dejan huecos ≥ 2 celdas en carretera y ≥ 1 en río:

| Fila | Zona      | Entidad  | Ancho | Cantidad | Velocidad | Sentido |
| ---- | --------- | -------- | ----- | -------- | --------- | ------- |
| 1    | río       | tronco   | 3     | 3        | 3,4       | −1      |
| 2    | río       | tronco   | 2     | 3        | 2,6       | +1      |
| 3    | río       | tortugas | 3     | 3        | 2,0       | −1      |
| 4    | río       | tronco   | 4     | 2        | 3,0       | +1      |
| 5    | río       | tronco   | 3     | 3        | 2,2       | +1      |
| 6    | río       | tortugas | 2     | 3        | 1,8       | −1      |
| 8    | carretera | camión   | 3     | 2        | 3,0       | −1      |
| 9    | carretera | coche    | 2     | 3        | 4,0       | −1      |
| 10   | carretera | camión   | 3     | 2        | 2,5       | +1      |
| 11   | carretera | coche    | 1     | 3        | 3,5       | −1      |
| 12   | carretera | coche    | 1     | 3        | 2,5       | +1      |

Convenciones:

- Coordenadas de celda con origen arriba a la izquierda. El «centro» de la rana es `col + 0.5`; una entidad cubre ese centro si `entity.col <= centro < entity.col + entity.width`.
- Loop con `requestAnimationFrame`: cada frame suma `dt` en ms limitado a `MAX_FRAME_MS`; las entidades avanzan `speed × dir × dt / 1000` celdas. Al salir del todo por un lado (`col >= COLS` yendo a la derecha, `col + width <= 0` yendo a la izquierda) reaparecen por el opuesto (`col = −width` o `col = COLS`).
- Salto: si no anima y hay `pendingDir`, empieza (`animT = 0`, calcula destino). El salto se ignora si `toCol` queda fuera de `[0, COLS−1]` o `toRow` fuera de `[0, ROWS−1]`. Al acabar (`animT >= JUMP_MS`) la rana se coloca en el destino y se resuelve la celda: si la fila es de río se conserva la columna fraccionaria; en cualquier otra fila la columna se redondea al entero más cercano.
- Resolución de celda al aterrizar: fila 0 → `checkGoal`; fila de carretera → `checkRoadCollision`; fila de río → `getSupport` (null → muerte); filas 7 y 13 → seguras. Si la fila supera `furthestRow`, suma `POINTS_ROW` por cada fila nueva.
- Cada frame, con la rana quieta o saltando, se vuelve a comprobar su fila actual: en carretera, colisión (un vehículo puede alcanzarla); en río quieta, `getSupport` (null → muerte, incluida tortuga que se sumerge) y arrastre `rana.col += lane.dir × lane.speed × dt / 1000`; si el centro sale de `[0, COLS)`, muerte.
- `getSupport(frog, lanes)`: entidad de río de la fila de la rana que cubre su centro, o `null`; una tortuga sumergida devuelve `null`. La tortuga está sumergida si `phase >= TURTLE_UP_MS` dentro de un ciclo de `TURTLE_UP_MS + TURTLE_DOWN_MS`.
- `checkGoal`: la boca `i` cubre `[GOALS[i], GOALS[i]+2)`; si el centro cae en una boca libre, se ocupa (+`POINTS_GOAL` + bonus de tiempo), la rana reaparece y, si las 5 están ocupadas, `completeRound()`. Si cae en una boca ocupada o en el muro, `killFrog()`.
- `completeRound()`: +`POINTS_ROUND`, `level + 1`, bocas vacías, `buildLanes(level)`, `furthestRow = ROW_START`, tiempo de ronda del nuevo nivel y reaparición.
- `killFrog()`: `lives − 1`; si queda 0, emite `onStats` con `lives: 0`, `state = 'gameover'` y llama a `onGameOver(score)` una sola vez; si no, reaparece en `(ROW_START, START_COL)`, reinicia el temporizador y limpia `pendingDir`. `furthestRow` no se reinicia al morir.
- Teclas del juego: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `KeyW`, `KeyA`, `KeyS`, `KeyD`, solo en `keydown` sin `repeat`. El motor llama a `preventDefault` en ellas e ignora eventos con `target` `input`, `textarea` o `select`. No gestiona `P` ni `Esc`.
- `setInput(button, true)` equivale a un `keydown` de esa dirección (los botones `a`/`b` se ignoran); `releaseInput()` limpia el salto pendiente.
- `onStats` emite `{ score, level, lives }` al iniciar, reiniciar y cuando cambia alguno.
- Al pausar se limpia `pendingDir`; `resume()` reinicia `lastTime`.
- El motor no pinta puntuación, nivel, vidas ni overlays de pausa o game over. Sí pinta la barra de tiempo (franja de 8 px en el borde inferior de la fila 13, ancho proporcional al tiempo, verde → amarillo → rojo).

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de Server y Client Components y de `cacheComponents`. Usar `/frontend-design` para el aspecto del tablero, la rana y la línea de controles. La referencia de integración en `GamePlayer` es SPEC 07, 08 y 09; para `pad` y `setInput`, SPEC 10 y `lib/games/snake/engine.ts`.

1. Migración del catálogo y `apply_migration`. Verificación: `select id, title, cover, color, position from games where id = 'ranaria'` devuelve FROGGER, `cover-rana`, `green` y `position = 7`; `get_advisors` sin avisos nuevos.
2. Constantes, tipos y `buildLanes(level)` en `lib/games/frogger/engine.ts` según la tabla de carriles (velocidades escaladas por nivel con tope). Verificación: compila; cada carril tiene al menos 2 entidades y huecos transitables.
3. Lógica del motor: bucle con `dt` limitado, avance y reaparición de entidades, ciclo de inmersión de las tortugas, salto con animación de 120 ms y salto pendiente, resolución de celda, `checkRoadCollision`, `getSupport`, arrastre, `checkGoal`, `completeRound`, `killFrog`, puntuación, temporizador y nivel. Verificación: compila.
4. Dibujo: fondo por zonas, bocas (ocupadas con silueta de rana), vehículos, troncos, tortugas visibles/sumergidas, rana con pose de salto y barra de tiempo, sin HUD de texto ni overlays. Verificación: compila.
5. Entrada y ciclo de vida: teclado, `setInput`/`releaseInput`, `onStats`, `onGameOver` (una sola vez), `start`, `pause`, `resume`, `restart`, `end`, `destroy` idempotente. Verificación: compila; `destroy()` dos veces no lanza error.
6. Registro: añadir `ranaria` a `REGISTRY` con `controls` y `pad`. Verificación: `/juegos/ranaria/jugar` arranca la partida sola, con la barra mostrando puntuación, nivel y vidas reales.
7. Revisión de jugabilidad: recorrer la carretera y el río, ocupar bocas, comprobar cada tipo de muerte, el ciclo de tortugas, la ronda completa y el aumento de velocidad. Las constantes se ajustan si el juego resulta injugable.
8. Limpieza: quitar importaciones muertas y ejecutar `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] `/juegos/ranaria` y `/juegos/ranaria/jugar` responden 200 y no hay errores en la consola del navegador.
- [ ] `ranaria` aparece en `/biblioteca` con el título FROGGER en el filtro ARCADE y como pestaña en `/salon`; ya no usa partida simulada.
- [ ] `games` sigue teniendo 9 filas y `ranaria` conserva `position = 7`, `cover-rana` y `green`.
- [ ] La partida empieza sola al entrar en `/jugar`, con la rana en la fila 13, columna 8.
- [ ] El canvas (640×560) muestra zonas diferenciadas: bocas, río, franja intermedia, carretera y franja de inicio.
- [ ] Cada pulsación de dirección mueve la rana exactamente una celda con animación de 120 ms; pulsar durante un salto encadena un solo salto más.
- [ ] La rana no sale por los bordes laterales con un salto.
- [ ] Coches y camiones se mueven en bucle por sus carriles y reaparecen por el lado opuesto.
- [ ] Troncos y tortugas se mueven en bucle; la rana montada es arrastrada con ellos.
- [ ] Las tortugas alternan 3 s visibles y 1,5 s sumergidas, cada grupo con su propia fase.
- [ ] La rana muere al ser alcanzada por un vehículo.
- [ ] La rana muere al caer al agua y cuando la tortuga que la soporta se sumerge.
- [ ] La rana muere si el arrastre la saca del tablero por un lado.
- [ ] La rana muere al llegar a una boca ocupada o al muro de la fila 0.
- [ ] La rana muere al agotarse el temporizador de ronda; la barra de tiempo del canvas disminuye y cambia de verde a rojo.
- [ ] Al morir se pierde una vida, la rana vuelve a la fila 13 y el temporizador se reinicia.
- [ ] Avanzar a una fila nueva por primera vez en la ronda suma 10 puntos; volver atrás y repetir no suma.
- [ ] Ocupar una boca libre suma 50 puntos más `segundos restantes × 10` y la marca con la silueta de la rana.
- [ ] Ocupar las 5 bocas suma 200 puntos, sube el nivel, vacía las bocas y reconstruye los carriles.
- [ ] La velocidad de las entidades sube 15 % por nivel (tope ×2,5) y el temporizador baja 1 s por nivel (mínimo 8 s).
- [ ] La barra superior muestra puntuación, nivel y vidas que coinciden con el motor.
- [ ] El canvas no dibuja puntuación, nivel, vidas ni textos de pausa o game over.
- [ ] Con 0 vidas se abre el modal «FIN DEL JUEGO» con la puntuación final correcta, una sola vez.
- [ ] PAUSA congela entidades, rana y temporizador; REANUDAR continúa sin saltos; durante la pausa las teclas no actúan.
- [ ] FIN abre el modal con la puntuación actual sin esperar a perder.
- [ ] Las teclas `P` y `Esc` no provocan una pausa independiente del canvas.
- [ ] Pulsar flechas en la pantalla de juego no hace scroll y escribir en el modal no mueve la rana.
- [ ] GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'ranaria'`, el nombre en mayúsculas y la puntuación final, y una copia en `av_scores`.
- [ ] La marca aparece en `/salon` (pestaña FROGGER) y en `/juegos/ranaria` sin reiniciar el servidor; `best` y `plays` de la tarjeta se actualizan.
- [ ] Si la inserción falla, el modal muestra el error, conserva `av_scores`, no marca la partida como guardada y permite reintentar.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos, nivel 1 y 3 vidas, sin duplicar listeners ni bucles.
- [ ] SALIR, VOLVER AL VAULT o cambiar de ruta detiene el loop y quita los listeners.
- [ ] Sin errores de hidratación al recargar `/jugar`.
- [ ] El gamepad virtual (SPEC 10) mueve la rana con la cruceta; `a` y `b` quedan desactivados.
- [ ] Asteroids, Tetris, Arkanoid y Snake se juegan y guardan igual que antes.
- [ ] Los otros 4 juegos no registrados siguen simulados y no crean filas en `scores`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** reemplazar `ranaria` en lugar de crear `frogger`. Decisión explícita del usuario; conserva `id`, enlaces, posición, `cover-rana` y `green`, y evita dos juegos de rana.
- **Sí:** el id registrado y el `scores.game_id` es `ranaria`, aunque el título sea FROGGER. Cambiar el id rompería enlaces y la clave de las marcas.
- **Sí:** motor `FroggerEngine` en `lib/games/frogger/` que implementa `GameEngine`, en lugar del componente `FroggerGame` y la play-page propia de la variante de game-jam. La ruta `/juegos/[id]/jugar` y el HUD, la pausa, el modal y el guardado ya son genéricos.
- **Sí:** canvas 640×560 (16×14 celdas de 40 px). El spec original lo daba también como 480×640; se usan 640×560 por coherencia con `ROWS`, `COLS` y `CELL`.
- **Sí:** el HUD de puntuación, nivel y vidas lo dibuja `GamePlayer` (patrón de los demás juegos); el canvas solo pinta la barra de tiempo, porque ese dato no llega a la barra de React.
- **Sí:** primitivas de canvas sin sprites bitmap. No hay assets de Frogger en el repositorio.
- **Sí:** movimiento de la rana en saltos discretos de 120 ms y entidades en movimiento continuo por celdas/s con `dt` limitado. Mecánica canónica; la colisión se resuelve con el centro de la rana.
- **Sí:** carriles con tabla fija y reparto uniforme de entidades, no aleatorio. Garantiza huecos transitables y partidas reproducibles.
- **Sí:** velocidades en celdas/s (el spec original usaba px/frame): independientes de la tasa de refresco del monitor.
- **Sí:** tortugas con ciclo de inmersión (3 s visibles / 1,5 s bajo el agua), con fase independiente por grupo.
- **Sí:** 3 vidas y 5 bocas destino; el temporizador de 15 s baja 1 s por nivel hasta 8 s, y las velocidades suben 15 % por nivel con tope ×2,5 para que el juego no sea imposible.
- **Sí:** el avance por filas (+10) se cuenta por ronda y no se reinicia al morir. Evita farmear puntos muriendo.
- **Sí:** reaparición inmediata tras morir, sin animación de muerte.
- **Sí:** flechas y `WASD`, solo en `keydown` sin `repeat`; un único salto pendiente.
- **Sí:** guardar en Supabase y `localStorage` a la vez (SPEC 06).
- **No:** referencia en `references/started-games/`; las mecánicas se definen en este spec.
- **No:** `INSERT` de una fila `frogger` ni color `lime` (la tabla solo admite `cyan`, `magenta`, `yellow` y `green`).
- **No:** cocodrilo disfrazado de tronco ni mosca en las bocas; van en un spec posterior.
- **No:** sonido, componente genérico `CanvasGame`, Auth, RLS nuevo ni realtime.

## Riesgos

| Riesgo                                                                     | Mitigación                                                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta el efecto dos veces y duplica loops o listeners    | `destroy()` idempotente y llamado siempre en el cleanup; criterio de JUGAR DE NUEVO.                                            |
| `onStats` por frame satura a React                                         | Emitir solo cuando cambian `score`, `level` o `lives`.                                                                          |
| `cacheComponents` afecta a `/jugar`                                        | El motor solo se instancia en el cliente dentro de `useEffect`.                                                                 |
| Con `dt` grande la rana atraviesa un vehículo o cae sin que se detecte     | `dt` limitado a `MAX_FRAME_MS` y comprobación de la fila actual en cada frame, no solo al aterrizar.                            |
| Un río sin huecos suficientes o con apoyos mal alineados es injugable      | Tabla de carriles con huecos mínimos; el paso 7 prueba la ronda completa y las constantes están nombradas en un solo lugar.     |
| La columna fraccionaria de la rana sobre troncos causa saltos descuadrados | Redondeo al aterrizar fuera del río y límites de salto comprobados contra `[0, COLS−1]`.                                        |
| Muerte repetida (varias causas en el mismo frame) resta más de una vida    | `killFrog()` ignora llamadas si la rana acaba de morir en ese frame; el estado `gameover` impide emitir `onGameOver` dos veces. |
| Las flechas hacen scroll o interfieren con el input del modal              | `preventDefault` solo en las teclas del juego e ignorar eventos cuyo `target` es `input`, `textarea` o `select`.                |
| Pausa con un salto pendiente o a mitad de animación                        | Al pausar se limpia `pendingDir`; `resume()` reinicia `lastTime`, así que `animT` no salta.                                     |
| Cualquiera puede insertar puntuaciones falsas con la clave pública         | Riesgo aceptado en SPEC 06; el antifraude va con Auth en otro spec.                                                             |

## Qué **no** está en este spec

- Sprites bitmap, animaciones de muerte, partículas y sonido.
- Cocodrilo disfrazado de tronco y mosca en las bocas.
- HUD dibujado en el canvas, pantallas de título, «GAME OVER» o «VICTORIA».
- Skins y adaptación móvil (los hacen `skin-designer` y `mobile-porter`).
- Cambios en los otros juegos simulados.
- Supabase Auth, antifraude, paginación y realtime del leaderboard.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
