# SPEC NN — Juego <TÍTULO> jugable dentro de Arcade Vault con leaderboard

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06 <!-- + spec que creó lib/games/registry.ts, si existe -->
> **Fecha:** <fecha de hoy>
> **Objetivo:** <Una frase: portar/crear `<id>` como motor de canvas desacoplado, montarlo en la pantalla de juego y guardar sus marcas en el leaderboard de Supabase.>

## Por qué existe este spec

<!-- específico del juego: qué juego es, de dónde viene (references/started-games/NN-x o nuevo), qué placeholder reemplaza o por qué es entrada nueva, y qué particularidades de su código original obligan a decisiones (globals, HUD en DOM, sprites, sonido). -->

## Alcance

**Dentro:**

- Motor `<Nombre>Engine` en `lib/games/<id>/` que implementa `GameEngine` (`lib/games/engine.ts`) y se registra en `lib/games/registry.ts`.
- Migración `supabase/migrations/<timestamp>_game_<id>.sql`: <INSERT de la fila nueva con `position` = <n> | UPDATE del placeholder `<id>` conservando `id` y `position`>.
- Integración con `GamePlayer`: puntuación, nivel (y vidas si aplica) vienen del motor; PAUSA, FIN y JUGAR DE NUEVO controlan el motor; el modal de guardar se abre en `onGameOver`.
- Guardado en `scores` (`game_id = '<id>'`) + copia local `av_scores` + `revalidateScores`, con los estados guardando, guardado y error con reintento.
- Línea de controles bajo la pantalla CRT: <teclas>.
- <!-- específico: mecánicas, niveles, power-ups, assets que sí entran -->
- <!-- si registry.ts no existe: contrato GameEngine, registro, GameCanvas genérico y migración de Asteroids a ese contrato -->

**Fuera de alcance (para specs futuros):**

- Cambios en los demás juegos: siguen con partida simulada y solo `localStorage`.
- Controles táctiles y gamepad.
- Sonido y música <!-- salvo decisión contraria -->.
- Antifraude, Supabase Auth, paginación del leaderboard.
- Tests automatizados, SEO avanzado, i18n.
- <!-- específico: mecánicas del README no implementadas en game.js, etc. -->

## Modelo de datos

```ts
// lib/games/<id>/engine.ts
export class <Nombre>Engine implements GameEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks);
  // start, pause, resume, restart, end, destroy (idempotente)
}
```

```ts
// lib/games/registry.ts — entrada nueva
"<id>": {
  create: (canvas, cb) => new <Nombre>Engine(canvas, cb),
  width: <W>,
  height: <H>,
  controls: [/* { keys: ["←","→"], label: "mover" }, ... */],
},
```

```sql
-- supabase/migrations/<timestamp>_game_<id>.sql
-- <INSERT | UPDATE> según integration.md
```

Convenciones:

- Canvas lógico <W>×<H>, escalado por CSS al ancho de `.crt-screen`; la física no depende del tamaño en pantalla.
- `onStats` solo emite al iniciar, reiniciar y cuando cambia `score`, `level` o `lives`.
- Teclas del juego: <lista>; el motor hace `preventDefault` solo en ellas e ignora eventos con `target` `input` o `textarea`.
- <!-- específico: constantes de física y puntuación que se conservan del original -->

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` las guías de Server y Client Components y de `cacheComponents`. Usar `/frontend-design` para la línea de controles.

0. <!-- solo si registry.ts no existe --> Contrato y registro: crear `lib/games/engine.ts`, `lib/games/registry.ts` y `components/game-canvas.tsx`; migrar Asteroids al contrato y quitar las ramas `gameId === "asteroids"` de `GamePlayer`. Verificación: Asteroids se juega, guarda y reinicia igual que antes; `npm run build` compila.
1. Migración del catálogo y `apply_migration`. Verificación: `select` sobre `games` muestra la fila con los datos esperados; `get_advisors` sin avisos nuevos.
2. Entidades en `lib/games/<id>/` portadas de <origen>, sin `document` ni `window`. Verificación: compila sin errores de tipos.
3. Motor `<Nombre>Engine`: estado, loop, entrada, callbacks y ciclo de vida. Verificación: compila; `destroy()` dos veces no lanza error.
4. Registro y controles. Verificación: `/juegos/<id>/jugar` arranca la partida sola.
5. <!-- específico: assets, niveles, HUD interno -->
6. Comparación lado a lado con `references/started-games/<carpeta>/index.html`. Verificación: mismo comportamiento y puntuación.
7. Limpieza: `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] `/juegos/<id>` y `/juegos/<id>/jugar` responden 200 y no hay errores en la consola.
- [ ] El juego aparece en `/biblioteca` (filtro `<CAT>`) y como pestaña en `/salon`; <!-- si reemplaza: el placeholder ya no es simulado -->.
- [ ] La partida empieza sola al entrar en `/jugar`.
- [ ] Las teclas del juego hacen lo descrito y no provocan scroll en la página.
- [ ] La barra superior (puntuación, nivel<!-- , vidas -->) coincide con los valores internos del motor.
- [ ] PAUSA congela el juego y REANUDAR continúa sin saltos; durante la pausa las teclas no actúan.
- [ ] FIN abre el modal con la puntuación actual.
- [ ] En el modal se pueden escribir iniciales sin que el juego reaccione.
- [ ] GUARDAR PUNTUACIÓN crea una fila en `scores` con `game_id = '<id>'`, nombre en mayúsculas y la puntuación final, y una copia en `av_scores`.
- [ ] La marca aparece en `/salon` y `/juegos/<id>` sin reiniciar el servidor; `best` y `plays` de la tarjeta se actualizan.
- [ ] Si la inserción falla, el modal muestra el error, conserva `av_scores`, no marca como guardada la partida y permite reintentar.
- [ ] JUGAR DE NUEVO reinicia sin duplicar listeners ni bucles.
- [ ] SALIR, VOLVER AL VAULT o cambiar de ruta detiene el loop y quita los listeners.
- [ ] Sin errores de hidratación al recargar `/jugar`.
- [ ] A 375 px no hay scroll horizontal y el canvas se escala sin deformarse.
- [ ] Los juegos no registrados siguen simulados y no crean filas en `scores`.
- [ ] <!-- específico del juego -->
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** <!-- reemplazo del placeholder o entrada nueva, y por qué -->.
- **Sí:** motor desacoplado en `lib/games/<id>/` que implementa `GameEngine`; el HUD vive solo en la barra de React.
- **Sí:** `onStats` solo cuando cambian los valores.
- **Sí:** guardar en Supabase y `localStorage` a la vez (SPEC 06).
- **No:** iframe ni `<Script>` con el JS original.
- **No:** sonido, táctil ni mecánicas nuevas <!-- ajustar -->.
- <!-- específico del juego -->

## Riesgos

| Riesgo                                                                  | Mitigación                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| React Strict Mode monta el efecto dos veces y duplica loops o listeners | `destroy()` idempotente y llamado siempre en el cleanup; criterio de JUGAR DE NUEVO. |
| `onStats` por frame satura a React                                      | Emitir solo cuando cambian los valores.                                              |
| `cacheComponents` afecta a `/jugar`                                     | El motor solo se instancia en el cliente dentro de `useEffect`.                      |
| El port cambia la jugabilidad respecto al original                      | Conservar constantes y comparar en paralelo con la referencia (paso 6).              |
| Cualquiera puede insertar puntuaciones falsas con la clave pública      | Riesgo aceptado en SPEC 06; el antifraude va con Auth en otro spec.                  |
| <!-- específico del juego -->                                           | <!-- mitigación -->                                                                  |

## Qué **no** está en este spec

- Cambios en los demás juegos del catálogo.
- Controles táctiles, gamepad y sonido <!-- ajustar -->.
- Supabase Auth, antifraude y paginación del leaderboard.
- Tests automatizados, SEO avanzado e i18n.
- <!-- específico del juego -->

Cada uno de estos puntos, si se aborda, va en su propio spec.
