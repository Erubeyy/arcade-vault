# SPEC 07 — Juego Tetris jugable dentro de Arcade Vault con leaderboard

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-10-19
> **Objetivo:** Portar `references/started-games/03-tetris/` a TypeScript como un motor de canvas desacoplado, registrarlo en un registro genérico de juegos, montarlo en la pantalla de juego reemplazando el placeholder `caida` y guardar sus marcas en el leaderboard de Supabase.

## Por qué existe este spec

Tetris es el segundo juego real del Vault y el primero que obliga a generalizar el patrón del SPEC 05. Hoy `components/game-player.tsx` ramifica por `gameId === "asteroids"` y no existe `lib/games/registry.ts`, así que este spec empieza creando el contrato `GameEngine`, el registro y un `GameCanvas` genérico, y migra Asteroids a ellos.

El juego reemplaza al placeholder `caida` (PUZZLE, `cover-tetro`, `position` 2) en lugar de crear una entrada nueva: conserva `id`, enlaces y posición, y evita tener dos Tetris en la biblioteca. Las marcas de `caida` son simuladas y no escriben en `scores`, así que no hay datos que migrar.

El código original (`game.js`, ~590 líneas) usa globals de módulo, toca el DOM en la carga (`getElementById`), arranca con `init()` al importarse y mezcla en el mismo archivo el HUD, el overlay de pausa/game over, los records locales y los ajustes (tema, skin). Se usa un loop con acumulador (`dropAccum` / `dropInterval`), no `dt`. La fuente de verdad es `game.js`: el README omite skins, tema, nivel inicial, records y combos, que sí existen en el código.

## Alcance

**Dentro:**

- Contrato genérico `lib/games/engine.ts` (`GameStats`, `GameCallbacks`, `GameEngine`, `EngineFactory`) y registro `lib/games/registry.ts` (`REGISTRY`, `isRealGame`).
- `components/game-canvas.tsx` genérico que sustituye a `components/asteroids-canvas.tsx`; migración de `AsteroidsEngine` al contrato sin cambiar su jugabilidad. La clase CSS `.asteroids-canvas` pasa a `.game-canvas`.
- `GamePlayer` deja de ramificar por `gameId === "asteroids"` y usa `isRealGame(gameId)`: insert en `scores`, copia `av_scores` y `revalidateScores` para todo juego registrado; `lives` ausente se muestra como `—`; la línea de controles se pinta desde `REGISTRY[gameId].controls`.
- Motor `TetrisEngine` en `lib/games/tetris/` (`engine.ts`, `pieces.ts`, `skins.ts`): tablero 10×20, 7 piezas, rotación horaria con wall kicks `[0, -1, 1, -2, 2]`, soft drop, hard drop, pieza fantasma, siguiente pieza, líneas, niveles y fin de partida.
- Canvas lógico 420×600: tablero de 300×600 (10×20 celdas de 30 px) a la izquierda y un panel de 120×600 a la derecha donde el motor dibuja «SIGUIENTE» y la siguiente pieza. Textos del canvas en español.
- Barra de React con puntuación y nivel desde `onStats`; sin vidas. LINES no se muestra en la barra (no existe en el contrato) y no se dibuja en el canvas.
- 4 skins del original (`retro`, `neon`, `pastel`, `pixel`) con su paleta y su función de dibujo de bloque.
- Tema del canvas claro/oscuro: solo cambia el fondo, el color de la rejilla y el alpha del fantasma dentro del canvas. El sitio no cambia de tema.
- Nivel inicial de 1 a 10: se aplica al iniciar o reiniciar la partida.
- Panel `components/tetris-options.tsx` bajo la pantalla CRT, solo para `tetris`, con select de skin, toggle de tema y select de nivel inicial. Skin y tema se aplican en vivo; el nivel inicial, al siguiente JUGAR DE NUEVO.
- Preferencias en `localStorage` bajo la clave `av_tetris_prefs`; si falla, valores por defecto (`retro`, `dark`, nivel 1).
- Migración `supabase/migrations/<timestamp>_game_tetris.sql`: UPDATE del placeholder `caida` conservando `id` y `position`.
- Guardado en `scores` (`game_id = 'caida'`) + copia local `av_scores` + `revalidateScores`, con los estados guardando, guardado y error con reintento (patrón del SPEC 06).
- Línea de controles bajo la CRT: `← →` mover, `↑` o `X` rotar, `↓` bajar, `ESPACIO` caída.

**Fuera de alcance (para specs futuros):**

- Cambios en los otros 7 juegos simulados.
- Controles táctiles y gamepad.
- Sonido y música (el original no tiene).
- Records locales del original (`tetris-records`), contador de combos y estadísticas «Líneas máx.»: el leaderboard lo da Supabase.
- Las teclas `P` y `Esc` para pausar: la pausa la gestiona el botón PAUSA de React.
- Overlay DOM del original (pantalla de inicio «Jugar», menú de pausa, formulario de nombre): lo sustituyen la barra y el modal de React.
- Tema claro/oscuro de todo el sitio.
- Antifraude, Supabase Auth, paginación del leaderboard.
- Modos nuevos (hold, 7-bag, rotación SRS, T-spin, lock delay): el original no los implementa.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```ts
// lib/games/engine.ts
export interface GameStats {
  score: number;
  level: number;
  lives?: number; // omitido si el juego no tiene vidas
}
export interface GameCallbacks {
  onStats: (stats: GameStats) => void; // solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // una vez por partida
}
export interface GameEngine {
  start(): void;
  pause(): void;
  resume(): void; // reinicia lastTime para evitar saltos
  restart(): void; // reinicia desde cero y emite onStats
  end(): void; // termina la partida y emite onGameOver (botón FIN)
  destroy(): void; // cancela rAF, quita listeners; idempotente
}
export type EngineFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options?: unknown, // opciones propias del juego; cada motor las valida
) => GameEngine;
```

```ts
// lib/games/registry.ts
export interface GameDefinition {
  create: EngineFactory;
  width: number;
  height: number;
  controls: { keys: string[]; label: string }[];
}
export const REGISTRY: Record<string, GameDefinition>; // asteroids (800×600) y caida (420×600)
export const isRealGame = (id: string) => id in REGISTRY;
```

```ts
// lib/games/tetris/engine.ts
export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";
export type TetrisTheme = "dark" | "light";
export interface TetrisOptions {
  skin: TetrisSkin;
  theme: TetrisTheme;
  startLevel: number; // 1–10
}

export class TetrisEngine implements GameEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    options?: Partial<TetrisOptions>,
  );
  setSkin(skin: TetrisSkin): void; // repinta aunque esté en pausa
  setTheme(theme: TetrisTheme): void; // repinta aunque esté en pausa
  setStartLevel(level: number): void; // aplica en el próximo start/restart
}
```

```ts
// lib/games/registry.ts — entrada nueva (el id es el del catálogo, no "tetris")
caida: {
  create: (canvas, cb, options) => new TetrisEngine(canvas, cb, options),
  width: 420,
  height: 600,
  controls: [
    { keys: ["←", "→"], label: "mover" },
    { keys: ["↑", "X"], label: "rotar" },
    { keys: ["↓"], label: "bajar" },
    { keys: ["ESPACIO"], label: "caída" },
  ],
},
```

```ts
// localStorage — clave "av_tetris_prefs"
{ skin: "retro", theme: "dark", startLevel: 1 } // TetrisOptions; un valor inválido se descarta y se usa el defecto
```

```sql
-- supabase/migrations/<timestamp>_game_tetris.sql
update public.games
set title = 'TETRIS',
    short = 'Encaja las piezas, completa líneas y aguanta el ritmo.',
    long  = '<texto en español: 7 piezas, rotar con wall kicks, pieza fantasma, caída rápida, niveles cada 10 líneas>',
    cover = 'cover-tetro',
    color = 'magenta'
where id = 'caida';
```

Conservados de `game.js` sin cambios:

- `COLS = 10`, `ROWS = 20`, `BLOCK = 30`; las 7 matrices de `PIECES` y su orden (I, O, T, S, Z, J, L); `randomPiece` uniforme (sin 7-bag).
- `LINE_SCORES = [0, 100, 300, 500, 800]` multiplicado por el nivel vigente antes de subir de nivel; soft drop +1 punto por fila; hard drop +2 puntos por celda recorrida.
- `level = startLevel + floor(lines / 10)`; `dropInterval = max(100, 1000 − (level − 1) × 90)` ms.
- Fin de partida: la pieza recién generada colisiona en `spawn()`.
- Fantasma con `ghostAlpha` (0.2 en oscuro; 0.4 en claro; el skin `neon` define 0.35). Los valores por skin y tema se copian de `style.css` a `lib/games/tetris/skins.ts`; el motor no lee estilos computados (`getComputedStyle`) ni CSS del DOM.

Convenciones:

- Canvas lógico 420×600, escalado por CSS dentro de `.crt-screen`; la física no depende del tamaño en pantalla.
- `onStats` emite `{ score, level }` (sin `lives`) al iniciar, reiniciar y cuando cambia `score` o `level`.
- Teclas del juego: `ArrowLeft`, `ArrowRight`, `ArrowDown`, `ArrowUp`, `KeyX`, `Space`. El motor llama a `preventDefault` solo en flechas y `Space`, e ignora eventos con `target` `input`, `textarea` o `select`.
- Loop con acumulador: `dropAccum` suma el tiempo entre frames y la pieza baja una fila (o se fija) al alcanzar `dropInterval`; `resume()` reinicia `lastTime`.
- El motor no pinta puntuación, nivel, líneas ni overlays de pausa o game over.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de Server y Client Components y de `cacheComponents`. Usar `/frontend-design` para la línea de controles y el panel de opciones. La referencia visual de `GamePlayer` es SPEC 05.

0. Contrato y registro: crear `lib/games/engine.ts`, `lib/games/registry.ts` (solo con `asteroids`) y `components/game-canvas.tsx`; `AsteroidsEngine implements GameEngine` y `AsteroidsStats` pasa a `GameStats`; renombrar `.asteroids-canvas` a `.game-canvas`; en `GamePlayer` reemplazar `isAsteroids` por `isRealGame(gameId)`, mostrar `—` si falta `lives` y pintar `controls-hint` desde `REGISTRY`; borrar `components/asteroids-canvas.tsx`. Verificación: Asteroids se juega, pausa, termina, guarda y reinicia igual que antes; `npm run build` compila.
1. Migración del catálogo y `apply_migration`. Verificación: `select id, title, cover, color, position from games where id = 'caida'` devuelve TETRIS, `cover-tetro`, `magenta` y `position = 2`; `get_advisors` sin avisos nuevos.
2. `lib/games/tetris/pieces.ts` y `skins.ts`: constantes, las 7 piezas, `rotateCW`, tabla de skins y tabla de tema (fondo, rejilla, alpha del fantasma). Verificación: compila sin errores de tipos y sin `document` ni `window` en los módulos.
3. `lib/games/tetris/engine.ts`: estado encapsulado (tablero, pieza actual, siguiente, `score`, `lines`, `level`, `dropAccum`, `dropInterval`), `collide`, `tryRotate`, `lockPiece`, `clearLines`, `spawn`, hard y soft drop, `draw` de tablero, fantasma y pieza, y panel «SIGUIENTE». Verificación: compila; `destroy()` dos veces no lanza error.
4. Entrada de teclado, callbacks y ciclo de vida (`start`, `pause`, `resume`, `restart`, `end`, `destroy`) y métodos `setSkin`, `setTheme`, `setStartLevel`. Verificación: compila.
5. Registrar `caida` en `REGISTRY`. Verificación: `/juegos/caida/jugar` arranca la partida sola con la barra mostrando puntuación y nivel reales y `—` en vidas.
6. `components/tetris-options.tsx` con skin, tema y nivel inicial, preferencias en `av_tetris_prefs` y montaje bajo la CRT solo para `caida`; `GameCanvas` recibe las opciones iniciales y expone el motor para los cambios en vivo. Verificación: cambiar skin y tema repinta al instante, incluso en pausa; recargar conserva las preferencias.
7. Comparación lado a lado con `references/started-games/03-tetris/index.html`. Verificación: mismas piezas, rotaciones, puntos por 1–4 líneas, velocidad por nivel y mismo fin de partida.
8. Limpieza: quitar importaciones muertas y ejecutar `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] `/juegos/caida` y `/juegos/caida/jugar` responden 200 y no hay errores en la consola del navegador.
- [ ] `caida` aparece en `/biblioteca` con el título TETRIS en el filtro PUZZLE y como pestaña en `/salon`; ya no usa partida simulada.
- [ ] `games` sigue teniendo 9 filas y `caida` conserva `position = 2`.
- [ ] La partida empieza sola al entrar en `/jugar`, con una pieza cayendo en el centro superior y la siguiente visible en el panel.
- [ ] `←` y `→` mueven la pieza una columna y no la sacan del tablero; `↑` y `X` la rotan en sentido horario con wall kicks `[0, −1, 1, −2, 2]` y descartan el giro si todos colisionan.
- [ ] `↓` baja una fila y suma 1 punto; `ESPACIO` deja caer la pieza al instante y suma 2 puntos por celda recorrida.
- [ ] La pieza fantasma se dibuja donde aterrizará la pieza actual y se actualiza al mover o rotar.
- [ ] Pulsar flechas o `ESPACIO` en la pantalla de juego no hace scroll en la página.
- [ ] Completar 1, 2, 3 y 4 líneas suma 100, 300, 500 y 800 puntos multiplicados por el nivel vigente.
- [ ] El nivel sube cada 10 líneas y el intervalo de caída es `max(100, 1000 − (nivel − 1) × 90)` ms.
- [ ] Elegir nivel inicial N y pulsar JUGAR DE NUEVO empieza en el nivel N con su velocidad de caída.
- [ ] La barra superior muestra puntuación y nivel iguales a los del motor, y `—` en vidas.
- [ ] El canvas no dibuja puntuación, nivel, líneas ni overlays de pausa o game over; sí dibuja «SIGUIENTE» y su pieza.
- [ ] Cuando una pieza nueva colisiona al aparecer, se abre el modal «FIN DEL JUEGO» con la puntuación final correcta, una sola vez.
- [ ] PAUSA congela la caída y las teclas no mueven la pieza; REANUDAR continúa sin que la pieza dé un salto.
- [ ] FIN abre el modal con la puntuación actual sin esperar a perder.
- [ ] En el modal se pueden escribir iniciales con espacio y flechas sin que el juego reaccione.
- [ ] GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = 'caida'`, el nombre en mayúsculas y la puntuación final, y una copia en `av_scores`.
- [ ] La marca aparece en `/salon` (pestaña TETRIS) y en `/juegos/caida` sin reiniciar el servidor; `best` y `plays` de la tarjeta se actualizan.
- [ ] Si la inserción falla, el modal muestra el error, conserva `av_scores`, no marca como guardada la partida y permite reintentar.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos y no duplica listeners ni bucles (una pulsación de `ESPACIO` produce una sola caída).
- [ ] SALIR, VOLVER AL VAULT o cambiar de ruta detiene el loop y quita los listeners.
- [ ] Cambiar el skin entre `retro`, `neon`, `pastel` y `pixel` repinta tablero, fantasma y siguiente pieza al instante, también en pausa.
- [ ] Cambiar el tema modifica solo fondo, rejilla y alpha del fantasma del canvas; el resto del sitio no cambia.
- [ ] Recargar `/juegos/caida/jugar` conserva skin, tema y nivel inicial desde `av_tetris_prefs`; con `localStorage` bloqueado o un valor inválido se usan `retro`, `dark` y nivel 1 sin errores.
- [ ] Usar los selectores del panel de opciones con el teclado (flechas) no mueve la pieza.
- [ ] Sin errores de hidratación al recargar `/jugar`.
- [ ] A 375 px, 768 px y 1280 px no hay scroll horizontal y el canvas 420×600 se escala sin deformarse, completo dentro de la pantalla CRT.
- [ ] Asteroids se juega, pausa, termina y guarda igual que antes de la migración al registro.
- [ ] Los otros 7 juegos no registrados siguen simulados y no crean filas en `scores`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** reemplazar `caida` en lugar de crear `tetris`. Decisión explícita del usuario; conserva el `id`, los enlaces y la posición, y evita dos Tetris en la biblioteca.
- **Sí:** el id registrado en `REGISTRY` y en `scores.game_id` es `caida`, no `tetris`, aunque el título sea TETRIS. Cambiar el id rompería enlaces y la clave de las marcas.
- **Sí:** crear el contrato `GameEngine` y el registro en este spec y migrar Asteroids. El SPEC 05 dejó la abstracción para cuando hubiera un segundo juego real.
- **Sí:** `lives` opcional en `GameStats`. Tetris no tiene vidas y la barra muestra `—`.
- **Sí:** `EngineFactory` recibe un tercer parámetro `options` de tipo `unknown`. Permite pasar skin, tema y nivel inicial sin añadir métodos al contrato común; cada motor valida lo suyo.
- **Sí:** HUD con puntuación y nivel en la barra de React. LINES queda fuera: ampliar el contrato y el diseño del player no justifica un dato secundario.
- **Sí:** «SIGUIENTE» dentro del canvas principal (420×600), con un panel de 120 px. Evita un segundo canvas y más cableado entre motor y React. Decisión explícita del usuario.
- **Sí:** incluir skins, tema del canvas y nivel inicial. Decisión explícita del usuario, aunque la recomendación era dejarlos fuera por ser extras del original.
- **Sí:** tema solo del canvas. El sitio es oscuro neón; un tema claro global toca layout y tokens y va en otro spec.
- **Sí:** los valores de skin y tema se copian a `skins.ts`. Evita `getComputedStyle` y CSS del original dentro del motor.
- **Sí:** panel de opciones de React bajo la CRT. Mantiene el motor sin DOM.
- **Sí:** preferencias en `localStorage` (`av_tetris_prefs`), con valores por defecto si falla.
- **Sí:** el nivel inicial no distingue marcas. Se guarda igual en `scores`; empezar alto infla la puntuación y se acepta hasta que haya antifraude.
- **Sí:** se conservan `ArrowDown` con repetición de tecla, `Space` sin filtro de repetición y la tabla de puntos del original.
- **No:** `P` y `Esc` en el motor. La pausa es solo el botón PAUSA de React.
- **No:** records locales, combos ni estadísticas del original. El leaderboard es el de Supabase.
- **No:** 7-bag, hold, SRS, T-spin ni lock delay. Son mecánicas nuevas.
- **No:** iframe ni `<Script>` con el JS original.
- **No:** sonido, táctil ni gamepad.

## Riesgos

| Riesgo                                                                         | Mitigación                                                                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta el efecto dos veces y duplica loops o listeners        | `destroy()` idempotente y llamado siempre en el cleanup; criterio de JUGAR DE NUEVO.                                            |
| `onStats` por frame satura a React                                             | Emitir solo cuando cambian `score` o `level`.                                                                                   |
| `cacheComponents` afecta a `/jugar`                                            | El motor solo se instancia en el cliente dentro de `useEffect`.                                                                 |
| El port cambia la jugabilidad respecto al original                             | Conservar constantes y comparar en paralelo con la referencia (paso 7).                                                         |
| La migración de Asteroids al registro rompe su jugabilidad o su guardado       | El paso 0 es commiteable solo y verifica Asteroids de punta a punta antes de añadir Tetris.                                     |
| El canvas 420×600 (7:10) no cabe en `.crt-screen` (4:3) o se deforma           | `GameCanvas` usa `width` y `height` del registro y lo centra con su relación de aspecto; criterio de 375/768/1280 px.           |
| Los selects del panel de opciones roban el foco y capturan flechas o `ESPACIO` | El motor ignora eventos con `target` `select`; tras cambiar una opción se devuelve el foco con `blur()`, como hace el original. |
| `ESPACIO` repetido al mantenerlo pulsado provoca varias caídas duras seguidas  | Se conserva el comportamiento del original; si resulta molesto al comparar en el paso 7, se decide en un spec aparte.           |
| El nivel inicial alto permite marcas infladas en el leaderboard                | Riesgo aceptado y documentado; el antifraude real va en un spec con Auth.                                                       |
| Hidratación: leer `localStorage` durante el render difiere servidor y cliente  | Las preferencias se leen en `useEffect` y el motor se crea tras leerlas; hasta entonces se muestran los valores por defecto.    |
| Cualquiera puede insertar puntuaciones falsas con la clave pública             | Riesgo aceptado en SPEC 06; el antifraude va con Auth en otro spec.                                                             |
| El README del original omite skins, tema, nivel inicial, records y combos      | La fuente de verdad es `game.js`: skins, tema y nivel inicial entran; records y combos quedan fuera.                            |

## Qué **no** está en este spec

- Cambios en los otros 7 juegos simulados.
- Controles táctiles, gamepad y sonido.
- `P` y `Esc` como teclas de pausa, y el overlay DOM del original.
- Records locales, combos y estadísticas del original.
- Tema claro/oscuro de todo el sitio.
- Hold, 7-bag, SRS, T-spin, lock delay y cualquier mecánica nueva.
- Supabase Auth, antifraude y paginación del leaderboard.
- Distinguir o limitar las marcas según el nivel inicial.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
