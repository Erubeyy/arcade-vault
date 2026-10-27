# SPEC 05 — Juego Asteroids jugable dentro de Arcade Vault

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-16
> **Objetivo:** Portar el juego de `references/started-games/02-asteroids/` a TypeScript como un motor de canvas desacoplado y montarlo en la pantalla de juego como una entrada nueva `asteroids`, notificando a React la puntuación, las vidas, el nivel y el fin de partida.

## Por qué existe este spec

Hasta hoy `components/game-player.tsx` simula la partida de todos los juegos con un `setInterval` que suma puntos al azar. Asteroids es el primer juego real del Vault. Este spec fija el patrón para los siguientes (Tetris, Arkanoid): un motor de canvas sin dependencia de React ni del DOM global, que recibe un `<canvas>` y reporta cambios de estado por callbacks, mientras la barra superior, la pausa y el modal de guardar puntuación siguen siendo de React.

El juego original es JavaScript con globals de módulo (`document.getElementById`, `window.addEventListener`, `requestAnimationFrame` al cargar). Eso no sirve tal cual en un Client Component que se monta y desmonta, por eso el motor se encapsula en una clase con ciclo de vida explícito.

## Alcance

**Dentro:**

- Nueva entrada `asteroids` en `lib/games.ts` (categoría `SHOOTER`) para que existan `/juegos/asteroids` y `/juegos/asteroids/jugar` y aparezca en la biblioteca y en el Salón de la Fama.
- Port fiel de `game.js` a TypeScript en `lib/games/asteroids/`: nave, balas, asteroides (tamaños 1–3 con formas fijas y procedurales), partículas, power-ups de disparo triple y escudo, niveles, vidas, invencibilidad con parpadeo y mundo toroidal. Mismas constantes de física y de puntuación.
- Motor `AsteroidsEngine` con ciclo de vida (`start`, `pause`, `resume`, `restart`, `end`, `destroy`) y callbacks hacia React.
- Componente cliente `components/asteroids-canvas.tsx` que monta el canvas 800×600 lógico, escalado por CSS al ancho de la pantalla CRT.
- Integración en `components/game-player.tsx` solo cuando `gameId === "asteroids"`: puntuación, vidas y nivel de la barra superior vienen del motor; PAUSA, FIN y JUGAR DE NUEVO controlan el motor; el modal de guardar puntuación se abre al terminar la partida.
- El canvas ya no dibuja puntuación, vidas, nivel ni el overlay "GAME OVER"; esas cifras viven solo en la barra de React. Los contadores `TRIPLE Ns` y `ESCUDO Ns` se quedan en el canvas porque React no los muestra.
- Una línea de ayuda con los controles bajo la pantalla CRT: `← →` rotar, `↑` propulsar, `ESPACIO` disparar.
- Entrada solo por teclado. Textos del canvas en español, como el original.

**Fuera de alcance (para specs futuros):**

- Cualquier cambio en `rocas` y en los otros 7 juegos: siguen con la puntuación simulada actual.
- Controles táctiles o gamepad.
- La "estrella fugaz" y los OVNIs: el README del original los menciona pero `game.js` no los implementa.
- Sonido y música.
- Recolorear el juego con la paleta neón del sitio: se mantiene el trazo blanco vectorial sobre negro.
- Portada nueva en CSS para `asteroids`.
- Guardar puntuaciones en Supabase (siguen en `localStorage` mediante `saveScore`).
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

Estructuras nuevas en `lib/games/asteroids/`:

```ts
// lib/games/asteroids/engine.ts
export interface AsteroidsStats {
  score: number;
  lives: number;
  level: number;
}

export interface AsteroidsCallbacks {
  onStats: (stats: AsteroidsStats) => void; // solo cuando cambia algún valor, no en cada frame
  onGameOver: (finalScore: number) => void; // una vez por partida
}

export class AsteroidsEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: AsteroidsCallbacks);
  start(): void; // initGame + arranca el loop + registra el teclado
  pause(): void; // detiene el loop sin perder el estado
  resume(): void; // reanuda y reinicia lastTime para evitar un salto de dt
  restart(): void; // initGame desde cero y emite onStats
  end(): void; // termina la partida actual y emite onGameOver (botón FIN)
  destroy(): void; // cancela rAF y quita los listeners; idempotente
}
```

```ts
// lib/games/asteroids/entities.ts
// Bullet, Asteroid, Ship, Particle, PowerUp: clases con update(dt, ...) y draw(ctx).
// Reciben el contexto 2D y el estado de teclas como argumentos; no leen globals.
```

```ts
// lib/games.ts — entrada nueva al final de GAMES
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Pulveriza asteroides y sobrevive al campo de rocas.",
  long: "...",            // texto en español, menciona rotar, propulsar, disparar y los power-ups
  cat: "SHOOTER",
  cover: "cover-rocas",   // se reutiliza la portada existente
  color: "cyan",
  best: 9600,             // dato sembrado, como el resto del catálogo
  plays: "1.2K",
}
```

Convenciones:

- Canvas lógico 800×600 (`W`, `H` constantes del motor). El CSS lo escala al 100 % del ancho de `.crt-screen` (relación 4:3); la física y las colisiones no dependen del tamaño en pantalla.
- Velocidades en px/s y aceleraciones en px/s², multiplicadas por `dt` (segundos, limitado a 0.05), igual que el original.
- `state` interno: `'playing' | 'dead' | 'gameover'`, igual que el original.
- Teclado: `ArrowLeft`/`ArrowRight` rotan, `ArrowUp` propulsa, `Space` dispara (un disparo por pulsación). El motor llama a `preventDefault` en esas teclas para que la página no haga scroll, pero ignora los eventos cuyo `target` sea un `input` o `textarea` (el modal pide iniciales).
- `onStats` se emite al iniciar, al reiniciar y cuando cambian `score`, `lives` o `level`.
- `GamePlayer` sigue usando `useSession().saveScore({ game, score, name })`; no cambia su firma.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de Server y Client Components y de `cacheComponents`, y heredar las convenciones de `components/game-player.tsx`. Usar `/frontend-design` para el estilo de la línea de controles y del canvas dentro del marco CRT.

1. Añadir la entrada `asteroids` a `lib/games.ts`. Verificación: `/juegos/asteroids` y `/juegos/asteroids/jugar` responden 200 (con la partida simulada todavía), el juego aparece en `/biblioteca` con el filtro SHOOTER y como pestaña en `/salon`; `npm run build` compila.
2. Crear `lib/games/asteroids/entities.ts` con `Bullet`, `Asteroid`, `Ship`, `Particle` y `PowerUp` portados de `game.js`, con constantes (`RADII`, `SPEEDS`, `POINTS`, `LARGE_ASTEROID_SHAPES`) y utilidades (`wrap`, `dist`, `rand`, `randInt`). Verificación: compila sin errores de tipos y sin usar `document` ni `window` en el módulo.
3. Crear `lib/games/asteroids/engine.ts` con `AsteroidsEngine`: estado, `initGame`, `nextLevel`, `killShip`, `update`, `draw`, loop con `requestAnimationFrame`, teclado y callbacks. Se elimina del `draw` el HUD de puntuación, vidas y nivel y el overlay de GAME OVER; se conservan los contadores TRIPLE y ESCUDO. Verificación: compila; `destroy()` llamado dos veces no lanza error.
4. Crear `components/asteroids-canvas.tsx` (Client Component): renderiza `<canvas width={800} height={600}>`, crea el motor en `useEffect`, lo destruye en el cleanup (seguro con el doble montaje de React Strict Mode) y expone `pause`, `resume`, `restart` y `end` por `ref`. Añadir en `app/globals.css` la clase del canvas (100 % de ancho y alto, `display: block`). Verificación: compila.
5. Integrar en `components/game-player.tsx`: si `gameId === "asteroids"`, renderizar `AsteroidsCanvas` en lugar de `.game-arena`, no arrancar el `setInterval` simulado, leer `score`, `lives` y `level` desde `onStats`, abrir el modal en `onGameOver`, conectar PAUSA/REANUDAR a `pause`/`resume`, FIN a `end` y JUGAR DE NUEVO a `restart`. Los demás juegos conservan el código actual. Verificación: se juega Asteroids de principio a fin y las barras muestran los valores reales.
6. Añadir bajo la pantalla CRT la línea de controles solo para `asteroids`. Verificación: se ve a 375 px, 768 px y 1280 px sin scroll horizontal.
7. Pasada de limpieza: probar un `node_modules/.bin/next build` completo, comparar el comportamiento con `references/started-games/02-asteroids/index.html` abierto en otra pestaña y revisar los demás juegos. Verificación: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [ ] `/juegos/asteroids` y `/juegos/asteroids/jugar` responden 200 y no hay errores en la consola del navegador.
- [ ] `asteroids` aparece en `/biblioteca` (filtro SHOOTER) y como pestaña en `/salon`; la Home no cambia.
- [ ] Al entrar en `/juegos/asteroids/jugar` la partida empieza sola, con la nave en el centro, 4 asteroides grandes fuera de la zona segura y la nave parpadeando durante 3 s.
- [ ] `←` y `→` rotan la nave, `↑` la propulsa con inercia y `ESPACIO` dispara una bala por pulsación con una cadencia mínima de 0.2 s.
- [ ] Pulsar las flechas o `ESPACIO` en la pantalla de juego no hace scroll en la página.
- [ ] Nave, balas, asteroides y power-ups atraviesan los bordes del canvas y reaparecen por el lado opuesto.
- [ ] Destruir un asteroide grande, mediano o pequeño suma 20, 50 y 100 puntos, y los grandes y medianos se parten en dos del tamaño inmediato inferior.
- [ ] La puntuación, las vidas y el nivel de la barra superior se actualizan al destruir un asteroide, perder una vida y completar un nivel, y coinciden con los valores internos del motor.
- [ ] El canvas no dibuja puntuación, vidas, nivel ni el texto "GAME OVER"; sí dibuja `TRIPLE Ns` y `ESCUDO Ns` mientras el efecto está activo.
- [ ] Chocar con un asteroide resta una vida, la nave reaparece a los 2 s con invencibilidad y, con 0 vidas, se abre el modal "FIN DEL JUEGO" con la puntuación final correcta.
- [ ] Recoger un power-up de disparo triple lanza 3 balas por disparo durante 10 s; recoger un escudo absorbe un impacto durante un máximo de 5 s.
- [ ] Destruir todos los asteroides sube el nivel en 1 y crea `3 + nivel` asteroides grandes.
- [ ] PAUSA congela asteroides, balas y nave, y REANUDAR continúa sin que los objetos den un salto; durante la pausa las teclas no mueven la nave.
- [ ] FIN abre el modal con la puntuación actual sin esperar a perder las vidas.
- [ ] En el modal se pueden escribir iniciales con espacio y flechas sin que el juego reaccione.
- [ ] GUARDAR PUNTUACIÓN guarda en `localStorage` (`av_scores`) una entrada con `game: "asteroids"` y la puntuación final.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos, 3 vidas y nivel 1, sin duplicar listeners ni bucles (pulsar `ESPACIO` dispara una sola bala).
- [ ] SALIR, VOLVER AL VAULT o cambiar de ruta detiene el loop y quita los listeners de teclado.
- [ ] Un recarga de `/juegos/asteroids/jugar` no produce errores de hidratación.
- [ ] A 375 px la pantalla de juego no tiene scroll horizontal y el canvas se escala sin deformarse (4:3).
- [ ] Los demás 8 juegos del catálogo, incluido `rocas`, siguen con su partida simulada y la barra superior sin cambios.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** entrada nueva `asteroids` en el catálogo. Decisión explícita del usuario; `rocas` queda intacto como juego simulado.
- **No:** reemplazar `rocas`. Se acepta tener temporalmente dos juegos de asteroides en la biblioteca; el usuario decide cuándo retirar el placeholder.
- **Sí:** portar a TypeScript con un motor desacoplado en `lib/games/asteroids/`. Permite montar y desmontar el juego desde React, tipar las entidades y reutilizar el patrón en Tetris y Arkanoid.
- **No:** embeber `game.js` en un `iframe` o con `<Script>`. La puntuación no llegaría a React sin hacks y no habría pausa ni limpieza.
- **Sí:** el HUD de puntuación, vidas y nivel vive solo en la barra de React y el canvas notifica por callbacks. Decisión explícita del usuario; evita datos duplicados.
- **Sí:** los contadores `TRIPLE` y `ESCUDO` se quedan en el canvas. React no tiene ese dato y añadirlo a la barra amplía el diseño del player.
- **Sí:** el modal de React maneja el fin de partida y el reinicio; se quita el "ESPACIO PARA REINICIAR" del canvas para no contradecirlo.
- **Sí:** `onStats` solo emite cuando cambian los valores. Un `setState` por frame provocaría 60 renders por segundo.
- **Sí:** canvas lógico 800×600 escalado por CSS. La física del original depende de `W` y `H`; cambiar el tamaño interno la alteraría.
- **Sí:** trazo blanco vectorial sobre negro, sin recolorear. Es la estética del juego original y encaja en el marco CRT.
- **No:** controles táctiles, sonido, estrella fugaz ni OVNIs. Cada uno es una mecánica o una superficie propia y va en su spec.
- **Sí:** `GamePlayer` ramifica por `gameId === "asteroids"` y el resto conserva su simulación. Es la forma mínima de convivir hasta que existan los demás motores; la abstracción general se decide cuando haya un segundo juego real.
- **Sí:** reutilizar la portada `cover-rocas` y datos sembrados (`best`, `plays`) como el resto del catálogo.
- **No:** guardar en Supabase. Las puntuaciones siguen en `localStorage`, como acordó el SPEC 04.

## Riesgos

| Riesgo                                                                                   | Mitigación                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode monta el efecto dos veces y deja dos loops o listeners duplicados      | `destroy()` es idempotente y el cleanup del `useEffect` lo llama siempre; el criterio de JUGAR DE NUEVO verifica que `ESPACIO` dispara una sola bala. |
| Las flechas y `ESPACIO` hacen scroll en la página o interfieren con el input del modal   | `preventDefault` solo para esas teclas y se ignoran los eventos cuyo `target` es un `input` o `textarea`.                                             |
| `onStats` por frame satura a React con renders                                           | Se emite solo cuando cambia `score`, `lives` o `level`.                                                                                               |
| Un salto grande de `dt` al reanudar tras la pausa teletransporta los objetos             | `resume()` reinicia `lastTime`, y `dt` sigue limitado a 0.05 s.                                                                                       |
| El port cambia la jugabilidad respecto al original                                       | Se conservan las constantes y se compara en paralelo con `references/started-games/02-asteroids/index.html` en el paso 7.                             |
| `cacheComponents` en Next 16 afecta a la página `/jugar`                                 | El motor solo se instancia en el cliente dentro de `useEffect`; la página sigue siendo la misma Server Component con `Suspense`.                      |
| La biblioteca muestra dos juegos de asteroides con portada idéntica                      | Es intencional y temporal; retirar `rocas` o crear una portada nueva es un spec aparte.                                                               |
| El README del original menciona power-ups y estrella fugaz de forma distinta a `game.js` | La fuente de verdad es `game.js`: power-ups sí, estrella fugaz no.                                                                                    |

## Qué **no** está en este spec

- Cambios en `rocas` ni en los otros 7 juegos.
- Controles táctiles, gamepad y sonido.
- Estrella fugaz, OVNIs y cualquier mecánica nueva.
- Recoloreo neón o portada nueva.
- Persistencia de puntuaciones en Supabase.
- Una abstracción genérica de motores de juego.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
