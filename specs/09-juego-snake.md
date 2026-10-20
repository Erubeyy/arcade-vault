# SPEC 09 — Juego Snake jugable dentro de Arcade Vault con leaderboard

> **Estado:** Aprobaddo
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-10-19
> **Objetivo:** Crear Snake como motor de canvas desacoplado con frutas de spritesheet que aparecen al azar, registrarlo en `REGISTRY` reemplazando el placeholder `serpentina` y guardar sus marcas en el leaderboard de Supabase.

## Por qué existe este spec

Snake es el cuarto juego real del Vault, después de Asteroids (SPEC 05), Tetris (SPEC 07) y Arkanoid (SPEC 08). El contrato `GameEngine`, el registro `lib/games/registry.ts` y el `GameCanvas` genérico ya existen, así que este spec solo añade un motor y su integración.

A diferencia de los tres anteriores, Snake **no tiene código de referencia** en `references/started-games/`: las mecánicas, constantes y la puntuación se definen aquí. Lo único que viene de fuera es el spritesheet de frutas `references/source-assets/snake-assets/fruits.png` (3790×442, RGBA, fondo transparente) y su atlas de coordenadas `sprites.js`, que usa `window.SPRITE_ATLAS` y rutas relativas a una página. El port del atlas pasa a un módulo TypeScript sin globals.

El juego reemplaza al placeholder `serpentina` (ARCADE, `cover-snake`, `green`, `position` 3) en lugar de crear una entrada nueva: conserva `id`, enlaces y posición, y evita dos juegos de serpiente en la biblioteca. Las marcas de `serpentina` son simuladas y no escriben en `scores`, así que no hay datos que migrar.

## Alcance

**Dentro:**

- Motor `SnakeEngine` en `lib/games/snake/` (`engine.ts`, `sprites.ts`) que implementa `GameEngine` y se registra en `lib/games/registry.ts` con el id `serpentina`.
- Tablero de 20×15 celdas de 40 px sobre un canvas lógico de 800×600. La serpiente empieza con 3 segmentos en el centro, mirando a la derecha, y avanza una celda por paso.
- Borde toroidal: al salir por un lado reaparece por el opuesto. Solo mata chocar con el propio cuerpo.
- Crecimiento: cada fruta comida añade un segmento (la cola no se retira en ese paso).
- Frutas: una sola fruta a la vez, elegida al azar entre las 22 del atlas y colocada en una celda libre al azar (nunca sobre la serpiente). Se dibuja con el sprite escalado a la celda manteniendo proporción.
- Puntuación: 10 puntos por fruta. Nivel = 1 + (frutas comidas / 5, entero).
- Velocidad creciente: el intervalo entre pasos empieza en 140 ms y baja 3 ms por fruta comida hasta un mínimo de 60 ms.
- Fin de partida: la cabeza entra en una celda ocupada por el cuerpo, o la serpiente llena las 300 celdas (victoria). Ambos casos llaman a `onGameOver(score)` una sola vez.
- Cola de giros: se guardan hasta 2 giros pendientes por paso; un giro de 180° (contrario a la dirección efectiva) se descarta.
- Asset copiado a `public/games/serpentina/fruits.png`. El motor carga la imagen antes de arrancar el loop.
- Migración `supabase/migrations/<timestamp>_game_snake.sql`: UPDATE del placeholder `serpentina` conservando `id`, `position`, `cat`, `cover` y `color`.
- Integración con `GamePlayer`: puntuación y nivel vienen de `onStats` (sin vidas: se muestra `—`); PAUSA, FIN y JUGAR DE NUEVO controlan el motor; el modal de guardar se abre en `onGameOver`. El resto del flujo (insert en `scores`, `av_scores`, `revalidateScores`, `controls-hint` desde `REGISTRY`) ya es genérico.
- Guardado en `scores` (`game_id = 'serpentina'`) + copia local `av_scores` + `revalidateScores`, con los estados guardando, guardado y error con reintento (patrón del SPEC 06).
- Línea de controles bajo la CRT: `← ↑ → ↓` o `W A S D` mover.
- Serpiente dibujada con formas en el canvas (verde neón, cabeza con ojos orientados); el fondo es un tablero oscuro con cuadrícula sutil.

**Fuera de alcance (para specs futuros):**

- Cambios en los otros juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Sonido y música.
- Valores de puntuación distintos por fruta, power-ups, frutas con efectos, obstáculos, modos de juego y niveles con mapas.
- Sprites para la serpiente y las otras filas del `fruits.png` (el atlas solo recorta la fila `y = 136–295`).
- Pantalla de título, «GAME OVER» o «VICTORIA» dibujados en el canvas.
- Recoloreo de las frutas con la paleta neón del sitio: se mantienen los sprites originales.
- Antifraude, Supabase Auth, paginación del leaderboard.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```ts
// lib/games/snake/engine.ts
export class SnakeEngine implements GameEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks);
  // start, pause, resume, restart, end, destroy (idempotente)
}
```

```ts
// lib/games/snake/sprites.ts — portado de references/source-assets/snake-assets/sprites.js, sin globals
export type FruitName =
  "banana" | "orange" | /* ...22 nombres del atlas */ "melon";
export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const FRUITS: Record<FruitName, SpriteRect>; // coordenadas literales de sprites.js
export const FRUIT_NAMES: FruitName[]; // Object.keys(FRUITS)
export function loadFruits(src: string): Promise<HTMLImageElement>;
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  name: FruitName,
  cx: number,
  cy: number,
  size: number,
): void; // escala por la dimensión mayor y centra en (cx, cy)
```

```ts
// lib/games/registry.ts — entrada nueva (el id es el del catálogo, no "snake")
serpentina: {
  create: (canvas, cb) => new SnakeEngine(canvas, cb),
  width: 800,
  height: 600,
  controls: [
    { keys: ["←", "↑", "→", "↓"], label: "mover" },
    { keys: ["W", "A", "S", "D"], label: "mover" },
  ],
},
```

```sql
-- supabase/migrations/<timestamp>_game_snake.sql
update public.games
set title = 'SNAKE',
    short = 'Come frutas, crece y no te muerdas la cola.',
    long  = '<texto en español: borde toroidal, frutas al azar, crecimiento, velocidad creciente, niveles cada 5 frutas>'
where id = 'serpentina';
```

Estado interno del motor (encapsulado en la clase, no en globals):

- `state`: `'playing' | 'gameover'`. La pausa es un indicador aparte (`paused`), porque la gestiona React.
- `snake: { x, y }[]` (índice 0 = cabeza), en coordenadas de celda; `dir` y `queue` (máximo 2 giros pendientes).
- `fruit: { x, y, name: FruitName }`, `eaten` (frutas comidas), `score`, `level`, `stepMs`.
- `accum` (ms acumulados) para el paso a intervalo fijo variable.

Constantes del motor:

- `W = 800`, `H = 600`, `CELL = 40`, `COLS = 20`, `ROWS = 15`.
- `START_LENGTH = 3`, `START_STEP_MS = 140`, `STEP_DECREASE_MS = 3`, `MIN_STEP_MS = 60`.
- `POINTS_PER_FRUIT = 10`, `FRUITS_PER_LEVEL = 5`, `MAX_QUEUE = 2`, `MAX_FRAME_MS = 100`.

Convenciones:

- Coordenadas de celda con origen arriba a la izquierda; `x` en `0..COLS−1` y `y` en `0..ROWS−1`; el módulo (`(x + COLS) % COLS`) aplica el borde toroidal.
- Loop con `requestAnimationFrame` y acumulador: cada frame suma `dt` en ms limitado a `MAX_FRAME_MS`, y se da un paso por cada `stepMs` acumulado (como Tetris, no por `dt` continuo).
- `stepMs = max(MIN_STEP_MS, START_STEP_MS − STEP_DECREASE_MS × eaten)`.
- La cabeza se mueve primero; si entra en una celda del cuerpo (la cola actual **no** cuenta cuando no se come en ese paso, porque se retira) termina la partida.
- La fruta nueva se elige entre las celdas libres, uniforme, y su `name` es uniforme sobre `FRUIT_NAMES`; la fruta nueva puede repetir el sprite de la anterior.
- Teclas del juego: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `KeyW`, `KeyA`, `KeyS`, `KeyD`. El motor llama a `preventDefault` en ellas e ignora eventos con `target` `input`, `textarea` o `select`.
- `onStats` emite `{ score, level }` (sin `lives`) al iniciar, reiniciar y cuando cambia `score` o `level`.
- Al pausar se limpia la cola de giros; `resume()` reinicia `lastTime` y pone `accum = 0`.
- El motor no pinta puntuación, nivel ni overlays de pausa o game over.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de Server y Client Components, de `public` (assets estáticos) y de `cacheComponents`. Usar `/frontend-design` para el tablero, la cabeza de la serpiente y la línea de controles. La referencia de integración en `GamePlayer` es SPEC 07 y SPEC 08.

1. Migración del catálogo y `apply_migration`. Verificación: `select id, title, cover, color, position from games where id = 'serpentina'` devuelve SNAKE, `cover-snake`, `green` y `position = 3`; `get_advisors` sin avisos nuevos.
2. Asset y atlas: copiar `fruits.png` a `public/games/serpentina/fruits.png` y crear `lib/games/snake/sprites.ts` portado de `sprites.js`, sin `document` ni `window` fuera de las funciones. Verificación: compila sin errores de tipos; `GET /games/serpentina/fruits.png` responde 200.
3. Motor, lógica y dibujo: `lib/games/snake/engine.ts` con estado encapsulado, paso a intervalo variable, cola de giros, borde toroidal, crecimiento, colocación aleatoria de la fruta y `draw` (tablero, fruta con sprite, cuerpo y cabeza), sin HUD ni overlays. Verificación: compila.
4. Entrada, callbacks y ciclo de vida: teclado, `onStats`, `onGameOver` (choque con el cuerpo o tablero lleno, una sola vez), `start` (carga la imagen y arranca el loop; si `destroy()` llega antes de que cargue, no arranca), `pause`, `resume`, `restart`, `end`, `destroy`. Verificación: compila; `destroy()` dos veces, y antes de que cargue la imagen, no lanza error.
5. Registro: añadir `serpentina` a `REGISTRY`. Verificación: `/juegos/serpentina/jugar` arranca la partida sola, con la barra mostrando puntuación y nivel reales y `—` en vidas.
6. Revisión visual del atlas: jugar hasta ver las 22 frutas (o forzarlas temporalmente en desarrollo) y comprobar que ninguna sale recortada ni descentrada. Verificación: las 22 se ven completas dentro de su celda; si alguna coordenada de `sprites.js` recorta mal, se corrige en `sprites.ts`.
7. Limpieza: quitar importaciones muertas y ejecutar `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] `/juegos/serpentina` y `/juegos/serpentina/jugar` responden 200 y no hay errores en la consola del navegador.
- [ ] `serpentina` aparece en `/biblioteca` con el título SNAKE en el filtro ARCADE y como pestaña en `/salon`; ya no usa partida simulada.
- [ ] `games` sigue teniendo 9 filas y `serpentina` conserva `position = 3`, `cover-snake` y `green`.
- [ ] La partida empieza sola al entrar en `/jugar`: serpiente de 3 segmentos en el centro, mirando a la derecha, y una fruta con sprite en una celda libre.
- [ ] La serpiente avanza una celda por paso, a 140 ms por paso al inicio.
- [ ] `←` `↑` `→` `↓` y `W` `A` `S` `D` cambian la dirección; pulsar la dirección contraria a la actual no hace nada.
- [ ] Dos giros pulsados dentro del mismo paso se aplican en pasos consecutivos y no se pierden.
- [ ] Pulsar flechas en la pantalla de juego no hace scroll en la página.
- [ ] Al salir por un borde la serpiente reaparece por el borde opuesto y la partida continúa.
- [ ] Comer una fruta suma 10 puntos, añade un segmento y coloca otra fruta en una celda libre; la fruta nunca aparece sobre la serpiente.
- [ ] Las frutas que aparecen varían entre los 22 sprites del atlas y se ven completas dentro de la celda.
- [ ] El intervalo entre pasos baja 3 ms por fruta comida y no baja de 60 ms.
- [ ] El nivel de la barra sube a 2 al comer la fruta 5, a 3 al comer la fruta 10, y así cada 5 frutas.
- [ ] La barra superior muestra puntuación y nivel que coinciden con el motor y `—` en vidas.
- [ ] El canvas no dibuja puntuación, nivel ni textos de pausa o game over.
- [ ] Chocar la cabeza con el cuerpo abre el modal «FIN DEL JUEGO» con la puntuación final correcta, una sola vez.
- [ ] Llenar las 300 celdas abre el modal con la puntuación final, una sola vez.
- [ ] PAUSA congela la serpiente y REANUDAR continúa sin saltos; durante la pausa las teclas no actúan.
- [ ] FIN abre el modal con la puntuación actual sin esperar a perder.
- [ ] En el modal se pueden escribir iniciales con espacio y flechas sin que el juego reaccione.
- [ ] GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'serpentina'`, el nombre en mayúsculas y la puntuación final, y una copia en `av_scores`.
- [ ] La marca aparece en `/salon` (pestaña SNAKE) y en `/juegos/serpentina` sin reiniciar el servidor; `best` y `plays` de la tarjeta se actualizan.
- [ ] Si la inserción falla, el modal muestra el error, conserva `av_scores`, no marca como guardada la partida y permite reintentar.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos, nivel 1 y 3 segmentos, y no duplica listeners ni bucles (la serpiente no avanza al doble de velocidad).
- [ ] SALIR, VOLVER AL VAULT o cambiar de ruta detiene el loop y quita los listeners.
- [ ] Sin errores de hidratación al recargar `/jugar`.
- [ ] A 375 px, 768 px y 1280 px no hay scroll horizontal y el canvas 800×600 se escala sin deformarse (4:3).
- [ ] Asteroids, Tetris y Arkanoid se juegan y guardan igual que antes.
- [ ] Los otros 5 juegos no registrados siguen simulados y no crean filas en `scores`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** reemplazar `serpentina` en lugar de crear `snake`. Decisión explícita del usuario; conserva el `id`, los enlaces y la posición.
- **Sí:** el id registrado en `REGISTRY` y en `scores.game_id` es `serpentina`, no `snake`, aunque el título sea SNAKE. Cambiar el id rompería enlaces y la clave de las marcas.
- **Sí:** conservar `cat`, `cover` (`cover-snake`) y `color` (`green`) del placeholder. Ya describen una serpiente y no hace falta portada nueva.
- **Sí:** borde toroidal. Decisión explícita del usuario; solo el cuerpo mata.
- **Sí:** velocidad creciente por cada fruta comida, de 140 ms a 60 ms en pasos de 3 ms. Decisión explícita del usuario sobre el crecimiento; la curva concreta es la recomendada.
- **Sí:** 10 puntos por fruta y nivel cada 5 frutas. El nivel solo informa en la barra; la velocidad depende de las frutas comidas, no del nivel.
- **Sí:** las 22 frutas y verduras del atlas, sin excluir ajo, berenjena, zanahoria, hongo, brócoli, pimiento, cacahuate ni tomate. Decisión explícita del usuario.
- **Sí:** una sola fruta a la vez, aleatoria en celda libre. El usuario pidió aparición aleatoria; más de una fruta cambiaría la mecánica.
- **Sí:** flechas y `WASD`. Recomendado; `WASD` es el estándar de los otros juegos del Vault (Arkanoid usa `A`/`D`).
- **Sí:** cola de hasta 2 giros y descarte del giro de 180°. Evita el suicidio por pulsar dos teclas rápido, que en Snake se percibe como un fallo del juego.
- **Sí:** canvas lógico 800×600, cuadrícula 20×15 de celdas de 40 px. 4:3 como Asteroids y Arkanoid, y las dos medidas son múltiplos de 40.
- **Sí:** loop con acumulador y paso a intervalo variable, no movimiento continuo. Es un juego de cuadrícula, como Tetris.
- **Sí:** serpiente dibujada con formas, sin sprites. El `fruits.png` solo contiene frutas.
- **Sí:** victoria al llenar el tablero termina la partida con `onGameOver`. Evita un estado imposible (sin celdas libres para la fruta).
- **Sí:** assets en `public/games/serpentina/`, cargados por ruta absoluta (`/games/serpentina/fruits.png`), como Arkanoid.
- **Sí:** `onStats` solo cuando cambian los valores.
- **Sí:** guardar en Supabase y `localStorage` a la vez (SPEC 06).
- **No:** referencia en `references/started-games/`. No existe; las mecánicas se definen en este spec.
- **No:** sonido. Decisión explícita del usuario; tampoco hay mp3 en `source-assets`.
- **No:** iframe ni `<Script>` con `sprites.js`: depende de `window.SPRITE_ATLAS`.
- **No:** táctil, ratón, gamepad, power-ups, obstáculos ni modos de juego.

## Riesgos

| Riesgo                                                                            | Mitigación                                                                                                                                                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta el efecto dos veces y duplica loops o listeners           | `destroy()` idempotente y llamado siempre en el cleanup; criterio de JUGAR DE NUEVO.                                                                                                               |
| `onStats` por frame satura a React                                                | Emitir solo cuando cambian `score` o `level`.                                                                                                                                                      |
| `cacheComponents` afecta a `/jugar`                                               | El motor solo se instancia en el cliente dentro de `useEffect`.                                                                                                                                    |
| Los sprites del atlas están recortados a mano y alguno sale cortado o descentrado | El paso 6 revisa las 22 frutas; `drawFruit` centra por la dimensión mayor y las coordenadas se corrigen en `sprites.ts`.                                                                           |
| La imagen (586 KB) tarda en cargar o `destroy()` llega antes que ella             | El loop arranca al resolverse la carga; una bandera `destroyed` impide arrancar tras `destroy()`. Un error de carga se registra con `console.error` y el juego usa un círculo de color como fruta. |
| Sin referencia, el equilibrio de la dificultad puede no gustar                    | Las constantes (`START_STEP_MS`, `STEP_DECREASE_MS`, `MIN_STEP_MS`) están nombradas en un solo lugar del motor; ajustarlas es un cambio de una línea.                                              |
| Pulsar dos giros rápidos hace que la serpiente se muerda en 180°                  | Cola de giros con el descarte del 180° contra la última dirección encolada.                                                                                                                        |
| El borde toroidal confunde al jugador sobre dónde está la cabeza                  | Cabeza con ojos orientados y distinta del cuerpo; la cuadrícula del tablero marca los bordes.                                                                                                      |
| Colocar la fruta falla o se cuelga cuando casi no quedan celdas libres            | La celda se elige entre la lista de celdas libres, no por reintentos; si la lista está vacía, es victoria.                                                                                         |
| Las flechas hacen scroll o interfieren con el input del modal                     | `preventDefault` solo en las teclas del juego e ignorar eventos cuyo `target` es `input`, `textarea` o `select`.                                                                                   |
| Una tecla de giro queda en cola tras pausar o perder el foco                      | Al pausar se limpia la cola de giros.                                                                                                                                                              |
| Cualquiera puede insertar puntuaciones falsas con la clave pública                | Riesgo aceptado en SPEC 06; el antifraude va con Auth en otro spec.                                                                                                                                |

## Qué **no** está en este spec

- Cambios en los otros juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Sonido y música.
- Puntos distintos por fruta, power-ups, obstáculos, modos de juego y mapas.
- Sprites de serpiente y las demás filas de `fruits.png`.
- Pantallas de título, «GAME OVER» y «VICTORIA» en el canvas.
- Recoloreo neón de las frutas o portada nueva.
- Supabase Auth, antifraude y paginación del leaderboard.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
