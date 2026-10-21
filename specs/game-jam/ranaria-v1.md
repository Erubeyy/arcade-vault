# SPEC JAM — Juego FROGGER (v1 núcleo) jugable dentro de Arcade Vault con leaderboard

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-10-20
> **Variante:** v1 núcleo — Frogger clásico mínimo: 5 carriles de carretera, 5 de río con troncos y tortugas que no se hunden, 5 casillas, temporizador y niveles por velocidad; sin peligros extra, sin animación de salto y sin panel de opciones.
> **Objetivo:** Crear Frogger como motor de canvas desacoplado, registrarlo en `REGISTRY` reemplazando el placeholder `ranaria` y guardar sus marcas en el leaderboard de Supabase.

## Por qué existe este spec

Frogger es el clásico de Konami (1981): una rana cruza una carretera con tráfico y un río con troncos y tortugas hasta llegar a una de las cinco casillas de la orilla superior. Sería el quinto juego real del Vault, después de Asteroids (SPEC 05), Tetris (SPEC 07), Arkanoid (SPEC 08) y Snake (SPEC 09). El contrato `GameEngine`, el registro `lib/games/registry.ts` y el `GameCanvas` genérico ya existen, así que este spec solo añade un motor y su integración.

El juego reemplaza al placeholder `ranaria` (ARCADE, `cover-rana`, `green`, `position` 7): el nombre y la portada ya describen una rana y no hay otro juego de cruzar en el catálogo. Las marcas de `ranaria` son simuladas y no escriben en `scores`, así que no hay datos que migrar.

No hay código de referencia en `references/started-games/` ni assets en `references/source-assets/`: las mecánicas, constantes y la puntuación se definen aquí y todo se dibuja con formas en el canvas.

Esta es la variante **núcleo**: la mecánica mínima que reconoce cualquiera que haya jugado Frogger. La v2 añade tortugas que se sumergen, cocodrilos, moscas de bonus, serpiente, animación de salto y panel de opciones. La v3 cambia la estructura a un cruce infinito con desplazamiento vertical.

## Alcance

**Dentro:**

- Motor `FroggerEngine` en `lib/games/frogger/` (`engine.ts`, `lanes.ts`) que implementa `GameEngine` y se registra en `lib/games/registry.ts` con el id `ranaria`.
- Tablero de 20×15 filas de 40 px sobre un canvas lógico de 800×600, de arriba abajo: fila 0 seto decorativo, fila 1 orilla con 5 casillas, filas 2–6 río, fila 7 mediana segura, filas 8–12 carretera, fila 13 salida y fila 14 barra de tiempo.
- La rana aparece en la fila 13, centrada (`x = 400`), mirando hacia arriba, y salta una fila o 40 px por pulsación.
- Carretera: 5 carriles de coches y camiones con dirección y velocidad propias; tocar un vehículo mata.
- Río: 5 carriles de troncos y grupos de tortugas que flotan siempre; la rana es arrastrada por la plataforma sobre la que está; caer al agua o salir del canvas arrastrada mata.
- Casillas: 5 huecos en la fila 1; entrar en una libre la ocupa y saca una rana nueva en la salida; chocar con el seto o con una casilla ocupada mata.
- Temporizador de 30 s por rana, dibujado como barra en la fila 14; agotarlo mata.
- 3 vidas. Morir resta una vida, muestra la rana aplastada 800 ms y saca una rana nueva en la salida; con 0 vidas la partida termina.
- Nivel: al ocupar las 5 casillas se vacían, sube el nivel y todos los carriles se aceleran un 20 % sobre la velocidad base, hasta ×2,5.
- Puntuación: 10 por cada fila nueva alcanzada en la vida de la rana, 50 por casilla, 10 por segundo restante al llegar y 1000 al completar las 5 casillas.
- Migración `supabase/migrations/<timestamp>_game_frogger.sql`: UPDATE del placeholder `ranaria` conservando `id`, `position`, `cat`, `cover` y `color`.
- Integración con `GamePlayer`: puntuación, nivel y vidas vienen de `onStats`; PAUSA, FIN y JUGAR DE NUEVO controlan el motor; el modal de guardar se abre en `onGameOver`. El resto del flujo (insert en `scores`, `av_scores`, `revalidateScores`, `controls-hint` desde `REGISTRY`) ya es genérico.
- Guardado en `scores` (`game_id = 'ranaria'`) + copia local `av_scores` + `revalidateScores`, con los estados guardando, guardado y error con reintento (patrón del SPEC 06).
- Línea de controles bajo la CRT: `← ↑ → ↓` o `W A S D` saltar.
- Estética neón con formas: asfalto oscuro con líneas discontinuas, río azul profundo, vehículos con contorno magenta y cian, troncos ámbar, tortugas verdes, rana verde neón orientada según el último salto.

**Fuera de alcance (para specs futuros):**

- Cambios en los otros juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Sonido y música.
- Tortugas que se sumergen, cocodrilos, serpiente, nutrias, moscas de bonus, rana hembra y cocodrilo en las casillas.
- Animación de salto: el salto es instantáneo.
- Vida extra por puntuación.
- Panel de opciones, skins y nivel inicial.
- Sprites o assets propios: todo se dibuja con formas.
- Pantalla de título, «GAME OVER» o banners de nivel dibujados en el canvas.
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
// lib/games/frogger/lanes.ts — tabla de carriles del nivel 1
export type LaneKind = "car" | "truck" | "log" | "turtles";
export interface LaneDef {
  row: number; // fila del tablero (2–6 río, 8–12 carretera)
  kind: LaneKind;
  length: number; // largo de cada objeto en celdas de 40 px
  count: number; // objetos repartidos a distancia igual en el carril
  speed: number; // px/s en el nivel 1; negativo = hacia la izquierda
}
export const LANES: LaneDef[];
```

| Fila | Tipo      | Largo | Cantidad | Velocidad nivel 1 |
| ---- | --------- | ----- | -------- | ----------------- |
| 2    | `log`     | 4     | 3        | +70               |
| 3    | `turtles` | 2     | 4        | −65               |
| 4    | `log`     | 6     | 2        | +85               |
| 5    | `log`     | 3     | 3        | +55               |
| 6    | `turtles` | 3     | 4        | −45               |
| 8    | `truck`   | 2     | 2        | −60               |
| 9    | `car`     | 1     | 2        | +140              |
| 10   | `car`     | 1     | 3        | −90               |
| 11   | `car`     | 1     | 3        | +70               |
| 12   | `car`     | 1     | 3        | −50               |

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
    short = 'Cruza la carretera y el río y llena las cinco casillas.',
    long  = '<texto en español: esquiva el tráfico, salta sobre troncos y tortugas, 30 segundos por rana, 3 vidas, cada nivel acelera los carriles>'
where id = 'ranaria';
```

Estado interno del motor (encapsulado en la clase, no en globals):

- `state`: `'playing' | 'dying' | 'clearing' | 'gameover'`. La pausa es un indicador aparte (`paused`), porque la gestiona React.
- `frog: { x, row, facing }`: `x` en px (centro, número real) y `row` entera; `bestRow` (fila más alta alcanzada por la rana actual).
- `lanes: { def, objects: { x }[], speed }[]`: `x` es el borde izquierdo en px de cada objeto.
- `homes: boolean[5]`, `timeLeft` (s), `stateTimer` (ms restantes de `dying` o `clearing`).
- `score`, `level`, `lives`.

Constantes del motor:

- `W = 800`, `H = 600`, `CELL = 40`, `ROWS = 15`.
- `HOME_ROW = 1`, `RIVER_ROWS = 2..6`, `MEDIAN_ROW = 7`, `ROAD_ROWS = 8..12`, `START_ROW = 13`, `TIMER_ROW = 14`.
- `START_X = 400`, `MIN_X = 40`, `MAX_X = 760`.
- `HOME_X = [80, 240, 400, 560, 720]`, `HOME_W = 48`, `HOME_TOLERANCE = 20`.
- `FROG_SIZE = 32`, `FROG_HIT_INSET = 6`.
- `START_LIVES = 3`, `TIME_LIMIT_S = 30`, `DEATH_MS = 800`, `CLEAR_MS = 1000`.
- `HOP_POINTS = 10`, `HOME_POINTS = 50`, `TIME_BONUS_PER_S = 10`, `LEVEL_BONUS = 1000`.
- `LEVEL_SPEED_STEP = 0.2`, `MAX_SPEED_MULT = 2.5`, `WRAP_MARGIN = 240`, `MAX_DT = 0.05`.

Convenciones:

- Coordenadas con origen arriba a la izquierda; la fila `r` ocupa `y` de `r × 40` a `r × 40 + 40`.
- Loop con `requestAnimationFrame` y `dt` en segundos limitado a `MAX_DT`; los objetos avanzan `speed × dt`.
- Velocidad de un carril: `def.speed × min(MAX_SPEED_MULT, 1 + LEVEL_SPEED_STEP × (level − 1))`.
- Reparto y envoltura: cada carril mide `LANE_SPAN = W + 2 × WRAP_MARGIN`; el objeto `i` empieza en `−WRAP_MARGIN + i × LANE_SPAN / count`; al pasar de `W + WRAP_MARGIN` (o de `−WRAP_MARGIN` por la izquierda) se desplaza `LANE_SPAN`.
- Salto: una pulsación es un salto; se ignora `e.repeat`. Arriba y abajo cambian `row` en 1; izquierda y derecha cambian `x` en 40. Un salto que dejaría la rana fuera de `MIN_X..MAX_X` o por debajo de `START_ROW` se ignora.
- Al aterrizar en la mediana, la carretera o la salida, `x` se ajusta al múltiplo de 40 más cercano dentro de `MIN_X..MAX_X`; en el río no se ajusta.
- Carretera: muere si el rectángulo de la rana reducido `FROG_HIT_INSET` por lado se solapa con un vehículo de su fila. Se comprueba cada frame, no solo al saltar.
- Río: la rana está a salvo si su centro `x` cae dentro de un objeto de su fila; entonces `x += speed × dt`. Si no, muere ahogada. Si el arrastre lleva su centro fuera de `0..W`, muere.
- Casillas: al saltar a la fila 1, si `|x − HOME_X[i]| ≤ HOME_TOLERANCE` para una casilla libre, la ocupa; si la casilla está ocupada o no hay casilla, muere.
- Puntos por avance: `HOP_POINTS` cuando `row < bestRow`; `bestRow` vuelve a `START_ROW` con cada rana nueva. Retroceder no resta.
- Al llegar a casilla: `HOME_POINTS + TIME_BONUS_PER_S × floor(timeLeft)`. Con las 5 ocupadas: `LEVEL_BONUS`, estado `clearing` durante `CLEAR_MS`, luego casillas vacías, `level + 1` y carriles con la velocidad nueva.
- `dying`: el mundo sigue moviéndose, la entrada se ignora y la rana se dibuja aplastada; al terminar `DEATH_MS` sale una rana nueva o, con `lives = 0`, se llama a `onGameOver(score)` una sola vez.
- El temporizador solo corre en `playing`; vuelve a `TIME_LIMIT_S` con cada rana nueva.
- Teclas del juego: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `KeyW`, `KeyA`, `KeyS`, `KeyD`. El motor llama a `preventDefault` en ellas e ignora eventos con `target` `input`, `textarea` o `select`.
- `onStats` emite `{ score, level, lives }` al iniciar, reiniciar y cuando cambia alguno.
- `resume()` reinicia `lastTime`; durante la pausa las teclas no actúan.
- El motor dibuja la barra de tiempo con la etiqueta «TIEMPO» (React no la conoce), pero no puntuación, nivel, vidas ni overlays de pausa o game over.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de Server y Client Components y de `cacheComponents`. Usar `/frontend-design` para la paleta del tablero, los vehículos, la rana y la línea de controles. La referencia de integración en `GamePlayer` es SPEC 09.

1. Migración del catálogo y `apply_migration`. Verificación: `select id, title, cover, color, position from games where id = 'ranaria'` devuelve FROGGER, `cover-rana`, `green` y `position = 7`; `get_advisors` sin avisos nuevos.
2. Tabla de carriles `lib/games/frogger/lanes.ts` con `LaneDef` y `LANES`, sin `document` ni `window`. Verificación: compila sin errores de tipos.
3. Motor, mundo y dibujo: `lib/games/frogger/engine.ts` con estado encapsulado, movimiento y envoltura de los carriles y `draw` (seto, casillas, río, mediana, carretera, objetos, rana y barra de tiempo), sin HUD ni overlays. Verificación: compila.
4. Rana y reglas: saltos, ajuste a la cuadrícula, arrastre en el río, colisiones, casillas, temporizador, muerte, vidas, niveles y puntuación. Verificación: compila.
5. Entrada, callbacks y ciclo de vida: teclado, `onStats`, `onGameOver` (una sola vez), `start`, `pause`, `resume`, `restart`, `end`, `destroy`. Verificación: compila; `destroy()` dos veces no lanza error.
6. Registro: añadir `ranaria` a `REGISTRY`. Verificación: `/juegos/ranaria/jugar` arranca la partida sola, con la barra mostrando puntuación, nivel y vidas reales.
7. Revisión de jugabilidad: cruzar el nivel 1 completo y llegar al nivel 3. Verificación: cada carril del río se puede cruzar sin esperar más de un ciclo; si no, se ajustan `count` o `speed` en `lanes.ts` y se anota el cambio.
8. Limpieza: quitar importaciones muertas y ejecutar `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] `/juegos/ranaria` y `/juegos/ranaria/jugar` responden 200 y no hay errores en la consola del navegador.
- [ ] `ranaria` aparece en `/biblioteca` con el título FROGGER en el filtro ARCADE y como pestaña en `/salon`; ya no usa partida simulada.
- [ ] `games` sigue teniendo 9 filas y `ranaria` conserva `position = 7`, `cover-rana` y `green`.
- [ ] La partida empieza sola al entrar en `/jugar`: rana en la fila 13 centrada, carriles en movimiento y barra de tiempo llena.
- [ ] `↑` `↓` `←` `→` y `W` `S` `A` `D` hacen saltar la rana una fila o 40 px; mantener la tecla pulsada produce un solo salto.
- [ ] La rana no sale por los laterales ni baja de la fila de salida al saltar.
- [ ] Pulsar flechas en la pantalla de juego no hace scroll en la página.
- [ ] Los 10 carriles se mueven con la dirección y la velocidad de la tabla de `LANES` en el nivel 1 y reaparecen por el lado contrario.
- [ ] Tocar un coche o camión resta una vida.
- [ ] Sobre un tronco o tortuga la rana se desplaza con él; saltar al agua o ser arrastrada fuera del canvas resta una vida.
- [ ] Entrar en una casilla libre la marca ocupada, suma 50 + 10 por segundo restante y saca una rana nueva en la salida con el tiempo lleno.
- [ ] Saltar al seto o a una casilla ocupada resta una vida.
- [ ] Cada fila nueva alcanzada por la rana actual suma 10; retroceder y volver a avanzar por la misma fila no suma.
- [ ] Agotar los 30 s resta una vida.
- [ ] Tras morir, la rana aplastada se ve 800 ms y las teclas no actúan; luego aparece una rana nueva.
- [ ] Ocupar las 5 casillas suma 1000, las vacía tras 1 s, sube el nivel y los carriles van un 20 % más rápido que en el nivel anterior sobre la base, sin pasar de ×2,5.
- [ ] La barra superior (puntuación, nivel, vidas) coincide con los valores internos del motor.
- [ ] El canvas dibuja la barra «TIEMPO» y no dibuja puntuación, nivel, vidas ni textos de pausa o game over.
- [ ] Perder la tercera vida abre el modal «FIN DEL JUEGO» con la puntuación final correcta, una sola vez.
- [ ] PAUSA congela carriles, rana y temporizador; REANUDAR continúa sin saltos; durante la pausa las teclas no actúan.
- [ ] FIN abre el modal con la puntuación actual sin esperar a perder.
- [ ] En el modal se pueden escribir iniciales con flechas y `W` `A` `S` `D` sin que la rana se mueva.
- [ ] GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'ranaria'`, el nombre en mayúsculas y la puntuación final, y una copia en `av_scores`.
- [ ] La marca aparece en `/salon` (pestaña FROGGER) y en `/juegos/ranaria` sin reiniciar el servidor; `best` y `plays` de la tarjeta se actualizan.
- [ ] Si la inserción falla, el modal muestra el error, conserva `av_scores`, no marca como guardada la partida y permite reintentar.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos, nivel 1, 3 vidas y casillas vacías, y no duplica listeners ni bucles (una pulsación produce un solo salto).
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
- **Sí:** variante núcleo sin peligros extra. Es la apuesta segura: valida carretera, río, casillas y niveles antes de añadir profundidad.
- **Sí:** canvas lógico 800×600 con filas de 40 px. 4:3 como Asteroids, Arkanoid y Snake, y caben las 13 filas clásicas más el seto y la barra de tiempo.
- **Sí:** posiciones horizontales de la rana en múltiplos de 40 (de 40 a 760) y casillas centradas en 80, 240, 400, 560 y 720. Las casillas quedan simétricas y alcanzables desde la cuadrícula.
- **Sí:** ajuste a la cuadrícula al salir del río. Tras ser arrastrada, la rana vuelve a columnas limpias y los coches se esquivan de forma predecible.
- **Sí:** un salto por pulsación, sin repetición. En Frogger cada salto es una decisión; la repetición provoca muertes involuntarias.
- **Sí:** salto instantáneo. La animación y su ventana de invulnerabilidad añaden reglas que van en la v2.
- **Sí:** flechas y `WASD`. Estándar del Vault (Snake usa las mismas).
- **Sí:** puntuación inspirada en el original: 10 por fila nueva, 50 por casilla, bonus por tiempo y 1000 por completar las casillas.
- **Sí:** 3 vidas y 30 s por rana. Valores habituales que mantienen partidas cortas.
- **Sí:** el nivel solo acelera los carriles. Un único eje de dificultad, fácil de ajustar en una constante.
- **Sí:** la barra de tiempo se dibuja en el canvas. React no conoce el temporizador y sin ella el jugador no sabe cuánto le queda.
- **Sí:** la muerte deja el mundo en movimiento durante 800 ms. Comunica qué pasó sin pantalla extra.
- **Sí:** `onStats` solo cuando cambian los valores.
- **Sí:** guardar en Supabase y `localStorage` a la vez (SPEC 06).
- **No:** referencia en `references/started-games/`. No existe; las mecánicas se definen en este spec.
- **No:** tortugas que se sumergen, cocodrilos, serpiente, moscas ni vida extra. Van en la v2.
- **No:** panel de opciones ni `localStorage` propio. Sin opciones no hay nada que persistir.
- **No:** sonido, táctil, ratón ni gamepad.

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta el efecto dos veces y duplica loops o listeners     | `destroy()` idempotente y llamado siempre en el cleanup; criterio de JUGAR DE NUEVO.                                  |
| `onStats` por frame satura a React                                          | Emitir solo cuando cambian `score`, `level` o `lives`; el temporizador no pasa por `onStats`.                         |
| `cacheComponents` afecta a `/jugar`                                         | El motor solo se instancia en el cliente dentro de `useEffect`.                                                       |
| Sin referencia, algún carril del río es imposible o trivial                 | El paso 7 cruza los niveles 1 a 3; `count` y `speed` están en una sola tabla de `lanes.ts`.                           |
| A velocidad alta un coche atraviesa a la rana entre dos frames              | `MAX_DT = 0.05`: a ×2,5 el coche más rápido avanza 17,5 px por frame, menos que el ancho efectivo de la rana (20 px). |
| La rana muere por un píxel al rozar un coche                                | Caja de colisión reducida `FROG_HIT_INSET` por lado.                                                                  |
| El arrastre del río deja la rana entre dos columnas y no acierta la casilla | `HOME_TOLERANCE = 20` acepta medio salto de error; fuera del río la `x` se ajusta a la cuadrícula.                    |
| `onGameOver` se dispara dos veces (muerte y FIN a la vez)                   | El motor pasa a `gameover` al primer disparo e ignora los siguientes.                                                 |
| Las flechas hacen scroll o interfieren con el input del modal               | `preventDefault` solo en las teclas del juego e ignorar eventos cuyo `target` es `input`, `textarea` o `select`.      |
| Cualquiera puede insertar puntuaciones falsas con la clave pública          | Riesgo aceptado en SPEC 06; el antifraude va con Auth en otro spec.                                                   |

## Qué **no** está en este spec

- Cambios en los otros juegos simulados.
- Controles táctiles, de ratón y gamepad.
- Sonido y música.
- Tortugas que se sumergen, cocodrilos, serpiente, nutrias, moscas, rana hembra y cocodrilo en las casillas.
- Animación de salto y vida extra.
- Panel de opciones, skins y nivel inicial.
- Sprites, portada nueva y pantallas de título o «GAME OVER» en el canvas.
- Supabase Auth, antifraude y paginación del leaderboard.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
