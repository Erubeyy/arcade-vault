# SPEC 01 — MVP visual: las 5 pantallas de Arcade Vault

> **Estado:** Implementado
> **Depende de:** ninguno
> **Fecha:** 2026-10-10
> **Objetivo:** Portar a Next.js (App Router) las 5 pantallas del prototipo `references/templates/` (biblioteca, detalle, reproductor, auth y salón de la fama) con datos mock, sin implementar ningún juego.

## Por qué existe este spec

El prototipo vive en `references/templates/` como React UMD + Babel con un router por hash y datos globales en `window`. Este spec lo traduce a la arquitectura real del proyecto (App Router, TypeScript, Tailwind v4 con tema en `app/globals.css`) para tener un MVP navegable. Los juegos, el backend y la auth real quedan para specs posteriores.

## Alcance

**Dentro:**

- Layout global con `Nav` (logo, links, contador de créditos, botón de sesión, menú móvil) y footer, reutilizados en todas las rutas.
- Cinco rutas de App Router:
  - `/` — Biblioteca: hero, buscador, chips de categoría, grilla de `GameCard` con tilt, estado vacío.
  - `/juegos/[id]` — Detalle: portada, tags, descripción, `stat-strip`, acciones y leaderboard top 10.
  - `/juegos/[id]/jugar` — Reproductor: HUD, marco CRT, arena decorativa, pausa, FIN y modal de fin de juego con guardado de puntuación.
  - `/login` — Auth: tabs iniciar sesión / crear cuenta, botón invitado, botones sociales inertes.
  - `/salon` — Salón de la Fama: tabs por juego, podio, tabla top 12 y fila "tu mejor marca" si hay sesión.
- Datos mock tipados: 8 juegos, categorías y `seededScores` determinista, portados de `data.jsx`.
- Sesión simulada con `localStorage` mediante un provider de cliente.
- Guardado simulado de puntuaciones en `localStorage`.
- Textos en español, tal como en el prototipo.
- Ruta inexistente (`id` de juego inválido) responde con `notFound()`.

**Fuera de alcance (para specs futuros):**

- Cualquier juego real (lógica, canvas, input de teclado o táctil).
- Backend, base de datos, route handlers y API.
- Autenticación real (hash de contraseñas, OAuth Google/GitHub, validación, recuperación).
- Leaderboards reales que lean las puntuaciones guardadas en `av_scores`.
- Internacionalización, SEO avanzado, tests automatizados.

## Modelo de datos

```ts
// lib/games.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;          // slug: "bloque-buster", "caida", ...
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;       // clase CSS: "cover-bricks", "cover-tetro", ...
  color: GameColor;
  best: number;
  plays: string;       // "12.4K"
}
export const GAMES: Game[];
export const CATS: ["TODOS", ...Category[]];

// lib/scores.ts
export interface ScoreRow { rank: number; name: string; score: number; date: string } // date: "DD/MM/2026"
export function seededScores(seed: number, count?: number): ScoreRow[]; // determinista, mismo algoritmo que data.jsx

// lib/session.tsx  (client)
export interface User { name: string }          // MAYÚSCULAS, máx. 10 caracteres
// localStorage "av_user"   -> User | null
// localStorage "av_scores" -> { game: string; score: number; name: string; at: number }[]
```

Convenciones:

- Los números se formatean con `toLocaleString("es-ES")`.
- Las claves de `localStorage` son exactamente `av_user` y `av_scores`, igual que el prototipo.
- Los `seed` se calculan igual que en el prototipo: detalle `id.length * 17 + 3` (10 filas), salón `id.length * 23 + 7` (12 filas).

## Plan de implementación

Antes de empezar, leer la guía relevante en `node_modules/next/dist/docs/01-app/` (rutas dinámicas, `params` asíncrono, `cacheComponents`, Client Components). Usar `/frontend-design` para cualquier ajuste visual.

1. Crear `lib/games.ts` y `lib/scores.ts` portando `data.jsx` a TypeScript. Verificación: `npm run build` compila.
2. Crear `lib/session.tsx` con `SessionProvider` y hook `useSession` (`user`, `login`, `signOut`, `saveScore`), con lectura de `localStorage` protegida por `try/catch` y sin romper el SSR. Montarlo en `app/layout.tsx`.
3. Crear `components/nav.tsx` (Client Component) con menú móvil y estado activo por `usePathname`. Agregar `Nav` y el footer a `app/layout.tsx` dentro de `<main className="av-main">`. Verificación: la nav se ve en `/`.
4. Biblioteca: crear `components/game-card.tsx` (tilt) y `components/library.tsx` (búsqueda y chips, Client Component). Reemplazar `app/page.tsx`. Verificación: filtrar por texto y categoría, y ver el estado vacío.
5. Detalle: crear `app/juegos/[id]/page.tsx` con leaderboard y `notFound()` para ids inválidos. Verificación: clic en una tarjeta lleva al detalle.
6. Salón: crear `app/salon/page.tsx` y `components/hall-of-fame.tsx` (tabs, podio, tabla, fila del usuario). Verificación: cambiar de tab cambia podio y tabla.
7. Auth: crear `app/login/page.tsx` y `components/auth-form.tsx` (tabs, invitado, sociales inertes). Al enviar, llama a `login` y redirige a `/`. Verificación: la nav muestra el nombre y "Cerrar sesión" lo limpia.
8. Reproductor: crear `app/juegos/[id]/jugar/page.tsx` y `components/game-player.tsx` (HUD, CRT, pausa, FIN, modal, guardado vía `saveScore`). Verificación: la puntuación sube sola, pausa la detiene, FIN abre el modal y guardar escribe en `av_scores`.
9. Pasada responsive y de limpieza: revisar 375px, 768px y 1280px en las 5 rutas; eliminar el contenido del scaffold que sobre. Verificación: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [ ] Existen las rutas `/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/login` y `/salon`, y cada una renderiza sin errores en consola.
- [ ] `/` muestra 8 tarjetas; escribir "rana" deja solo RANARIA; elegir "SHOOTER" deja 2; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Clic en una tarjeta o en su botón JUGAR navega a `/juegos/<id>`.
- [ ] `/juegos/<id>` muestra título, tags, descripción, partidas, mejor global, dificultad y 10 filas de leaderboard con las 3 primeras destacadas.
- [ ] `/juegos/no-existe` y `/juegos/no-existe/jugar` devuelven la página 404 de Next.
- [ ] "JUGAR AHORA" lleva a `/juegos/<id>/jugar` y "VOLVER AL VAULT" a `/`.
- [ ] En el reproductor la puntuación aumenta sola; PAUSA la detiene y muestra "EN PAUSA"; REANUDAR la continúa.
- [ ] FIN abre el modal "FIN DEL JUEGO" con la puntuación final; GUARDAR PUNTUACIÓN añade una entrada a `localStorage["av_scores"]` y muestra "PUNTUACIÓN GUARDADA"; JUGAR DE NUEVO reinicia en 0.
- [ ] SALIR del reproductor vuelve a `/juegos/<id>`.
- [ ] En `/login`, la pestaña "CREAR CUENTA" muestra el campo de correo y "INICIAR SESIÓN" lo oculta.
- [ ] Enviar el formulario guarda `av_user` (nombre en mayúsculas, máx. 10 caracteres), redirige a `/` y la nav muestra ese nombre; recargar la página conserva la sesión.
- [ ] "JUGAR COMO INVITADO" redirige a `/` sin sesión; los botones Google y GitHub no hacen nada.
- [ ] Cerrar sesión elimina `av_user` y la nav vuelve a mostrar "Iniciar Sesión".
- [ ] `/salon` muestra podio (2°, 1°, 3°), tabla de 12 filas y un tab por cada uno de los 8 juegos; cambiar de tab cambia los datos.
- [ ] En `/salon` la fila "TU MEJOR MARCA" aparece solo con sesión iniciada.
- [ ] La nav marca como activo "Biblioteca" en `/`, `/juegos/*` y "Salón de la Fama" en `/salon`.
- [ ] A 375px de ancho aparece el botón hamburguesa, el panel móvil abre y cierra, y ninguna ruta tiene scroll horizontal.
- [ ] Recargar con el mismo `id` produce los mismos datos del leaderboard (sin hydration errors).
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** rutas reales de App Router. URLs compartibles y es la forma idiomática en Next; el router por hash del prototipo era una limitación de la demo.
- **No:** replicar `location.hash` con una SPA. Contradice la arquitectura del proyecto.
- **Sí:** datos mock tipados en `lib/`. Cero infraestructura y fácil de sustituir cuando exista backend.
- **No:** route handlers `/api/*` para servir el mock. Trabajo sin valor visual.
- **Sí:** sesión y puntuaciones simuladas en `localStorage` con las claves del prototipo (`av_user`, `av_scores`). Permite probar el flujo completo sin backend.
- **No:** auth real ni OAuth. Merece su propio spec.
- **Sí:** el reproductor es un placeholder con puntuación simulada, para dejar listo el HUD, la pausa y el modal que usarán los juegos reales.
- **No:** implementar ningún juego. Decisión cerrada por el usuario.
- **Sí:** el leaderboard y el salón usan `seededScores` y no leen `av_scores`. Se conserva el comportamiento del prototipo; conectarlos es trabajo de un spec con backend.
- **Sí:** los componentes interactivos son Client Components pequeños; las páginas siguen siendo Server Components cuando no necesitan estado.
- **Sí:** el CSS del prototipo ya está portado en `app/globals.css`, así que se reutilizan sus clases (`av-*`, `btn`, `card`, ...) en lugar de reescribir estilos con utilidades de Tailwind.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Hydration mismatch al leer `localStorage` en el primer render | El provider inicia con `user = null` y lee `localStorage` en `useEffect`. |
| `localStorage` bloqueado o con JSON corrupto | Todo acceso va en `try/catch` y cae a `null` / `[]`. |
| `cacheComponents` y `params` asíncrono en Next 16 cambian las reglas de rutas dinámicas | Leer la guía en `node_modules/next/dist/docs/01-app/` antes del paso 5 y ajustar según corresponda. |
| `Math.random` en el puntaje simulado causa mismatch SSR | Solo se usa dentro de `useEffect`/`setInterval`, nunca en el render inicial. |
| Tilt de tarjetas y animaciones afectan rendimiento en móvil | El tilt solo reacciona a `onMouseMove`; no se aplica en táctil. |

## Qué **no** está en este spec

- Ningún juego jugable.
- Backend, base de datos o API.
- Autenticación real u OAuth.
- Leaderboards conectados a puntuaciones guardadas.
- Tests automatizados, i18n y SEO avanzado.

Cada uno de estos puntos, si se aborda, va en su propio spec.
