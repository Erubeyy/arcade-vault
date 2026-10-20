# Referencia de integración de juegos en Arcade Vault

Resume el patrón que fijaron SPEC 05 (Asteroids) y SPEC 06 (`games` + `scores`). Verifica los nombres contra el código antes de citarlos en un spec.

## 1. Arquitectura actual (Asteroids)

- Motor: `lib/games/asteroids/engine.ts` (`AsteroidsEngine`) y `entities.ts`. Sin React; recibe un `<canvas>` y avisa por callbacks.
- Montaje: `components/asteroids-canvas.tsx` crea el motor en `useEffect`, lo destruye en el cleanup y expone `pause/resume/restart/end` con `useImperativeHandle`. Los callbacks se leen desde refs para no recrear el motor.
- `components/game-player.tsx` ramifica con `isAsteroids` (`gameId === "asteroids"`): sin `setInterval` simulado, estadísticas desde `onStats`, modal en `onGameOver`, línea `controls-hint`, insert en `scores` con `createClient()` de `lib/supabase/client.ts`, copia local con `saveScore` de `useSession` y `revalidateScores(gameId)`.
- `app/juegos/[id]/jugar/actions.ts`: Server Action `revalidateScores` que invalida `scores-<id>` y `games` con `{ expire: 0 }`.
- Lecturas: `lib/games.ts` (`getGames`, `getGame`, `"use cache"` + `cacheTag("games")`), `lib/scores.ts` (`getTopScores`, `cacheTag("scores-<id>")`), `lib/scores-query.ts` (`queryTopScores`, compartido con el navegador).
- BD: `public.games` (con `position`), `public.scores`, vista `games_with_stats` (`best`, `plays`), RLS: lectura pública, insert público en `scores`, sin update/delete.

## 2. Contrato genérico (paso 0, solo si `lib/games/registry.ts` no existe)

`lib/games/engine.ts`:

```ts
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
  resume(): void; // reinicia lastTime para evitar saltos de dt
  restart(): void; // reinicia desde cero y emite onStats
  end(): void; // termina la partida y emite onGameOver (botón FIN)
  destroy(): void; // cancela rAF, quita listeners; idempotente
}
export type EngineFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameEngine;
```

`lib/games/registry.ts`:

```ts
export interface GameDefinition {
  create: EngineFactory;
  width: number;
  height: number;
  controls: { keys: string[]; label: string }[];
}
export const REGISTRY: Record<string, GameDefinition> = {
  asteroids: { create: (c, cb) => new AsteroidsEngine(c, cb), width: 800, height: 600, controls: [...] },
};
export const isRealGame = (id: string) => id in REGISTRY;
```

Pasos de migración (los hace el primer spec que use la skill):

1. `AsteroidsEngine implements GameEngine`; `AsteroidsStats` pasa a ser `GameStats` (lives obligatorio en Asteroids, opcional en el contrato).
2. Crear `components/game-canvas.tsx` generalizando `asteroids-canvas.tsx`: recibe `gameId`, usa `REGISTRY[gameId]` para `create`, `width` y `height`; mismo patrón de refs y cleanup.
3. Renombrar la clase `.asteroids-canvas` a `.game-canvas` en `app/globals.css`.
4. En `GamePlayer` reemplazar `isAsteroids` por `isRealGame(gameId)`: el insert en `scores` y la revalidación aplican a todo juego registrado; `lives` ausente se muestra como `—`; `controls-hint` se pinta desde `REGISTRY[gameId].controls`.
5. Borrar `components/asteroids-canvas.tsx`.
6. Verificar que Asteroids se juega, pausa, termina, guarda y reinicia igual.

## 3. Reglas del motor (heredadas de SPEC 05)

- Clase con ciclo de vida explícito; sin `document.getElementById`, sin `window` global ni `requestAnimationFrame` al cargar el módulo. Las entidades reciben `ctx` y el estado de teclas como argumentos.
- Canvas lógico fijo (`W`×`H`) escalado por CSS; la física no depende del tamaño en pantalla.
- Velocidades en px/s multiplicadas por `dt` (segundos, limitado a 0.05) o acumulador equivalente, según el original.
- `destroy()` idempotente: soporta el doble montaje de React Strict Mode.
- Teclado: `preventDefault` solo en las teclas del juego; ignorar eventos con `target` `input`/`textarea` (el modal pide iniciales).
- `onStats` solo al iniciar, reiniciar o cambiar un valor; `onGameOver` una sola vez por partida.
- El canvas no dibuja lo que muestra la barra de React (puntuación, nivel, vidas) ni el overlay de game over. Sí puede dibujar lo que React no conoce (temporizadores de power-up, "siguiente pieza", etc.).
- Pausa: `pause()` cancela el loop sin perder estado y las teclas no actúan; `resume()` reinicia `lastTime`.

## 4. Catálogo en Supabase

Cada juego real necesita su fila en `public.games`. Se crea una migración versionada `supabase/migrations/<timestamp>_game_<id>.sql` y se aplica con `apply_migration`. No cambia el esquema, por lo que no hace falta regenerar `database.types.ts`. No tocar RLS ni la vista.

Entrada nueva (siguiente `position`):

```sql
insert into public.games (id, title, short, long, cat, cover, color, position)
values ('<id>', '<TÍTULO>', '<short>', '<long>', '<ARCADE|PUZZLE|SHOOTER|VERSUS>',
        '<cover-x>', '<cyan|magenta|yellow|green>',
        (select coalesce(max(position), 0) + 1 from public.games));
```

Reemplazo de un placeholder (conserva `id`, `position` y las marcas existentes, que son simuladas y no escriben en `scores`):

```sql
update public.games
set title = '<TÍTULO>', short = '<short>', long = '<long>', cover = '<cover-x>', color = '<color>'
where id = '<placeholder-id>';
```

Si el id de un placeholder cambia, hay que actualizar también los enlaces; por eso se recomienda conservarlo. La portada (`cover`) es una clase CSS de `app/globals.css`; reutilizar una existente o crear una nueva es una decisión del spec.

`revalidateTag("games")` ya invalida el catálogo tras guardar una marca.

## 5. Notas según el tipo de referencia (`references/started-games/`)

| Referencia     | Particularidades                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `02-asteroids` | Ya portado (SPEC 05). Úsalo como modelo.                                                                                                                                                                                                                                                                                                         |
| `03-tetris`    | Globals de módulo y funciones sueltas → clase. Loop con acumulador (`dropAccum`/`dropInterval`), no `dt`. El HUD vive en el DOM (`updateHUD`): `score`/`lines`/`level` → `onStats`; decidir en el spec dónde queda "siguiente pieza" (canvas auxiliar o dentro del canvas principal). Pausa y game over usan un overlay DOM que React sustituye. |
| `04-arkanoid`  | Sprites (`assets/spritesheet-breakout.png`, `spritesheet.js`), niveles en `levels.js` y sonidos en `assets/sounds/`. Los assets pasan a `public/games/<id>/`; el motor carga las imágenes antes de `start()` y decide si el sonido entra (por defecto fuera de alcance).                                                                         |
| Sin referencia | El spec debe definir mecánicas, constantes, controles, puntuación, niveles y condición de fin con el mismo nivel de detalle que SPEC 05.                                                                                                                                                                                                         |

Siempre: la fuente de verdad es el código (`game.js`), no el README.

## 6. Checklist de verificación al implementar

- `/juegos/<id>`, `/juegos/<id>/jugar` y `/salon` sin errores de consola.
- Jugar, terminar y guardar → `select * from scores where game_id = '<id>' order by id desc limit 1` (`execute_sql`).
- La marca aparece en Salón y detalle sin reiniciar el servidor.
- Sin red: error en el modal, `av_scores` conserva la marca, reintento funciona.
- Desmontar (SALIR/cambiar de ruta) quita loop y listeners; JUGAR DE NUEVO no duplica disparos/entradas.
- 375 px / 768 px / 1280 px sin scroll horizontal.
- `npm run lint` y `npm run build`.
