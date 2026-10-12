# SPEC 02 — Página Home y link "Acerca de" en la nav

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-11
> **Objetivo:** Crear la página Home en `/` copiando exactamente el diseño de `references/templates/home-about/`, mover la Biblioteca a `/biblioteca` y actualizar la nav con "Inicio" y "Acerca de" (este último apuntando a un placeholder mínimo).

## Por qué existe este spec

El SPEC 01 dejó la Biblioteca en `/`. El template `references/templates/home-about/` agrega una landing (Home) y una página About, y su nav tiene cuatro links: Inicio, Biblioteca, Salón de la Fama y Acerca de. La Home necesita la ruta `/`, así que la Biblioteca se muda a `/biblioteca`, como en el prototipo. La página About completa queda para otro spec; aquí solo se deja el link funcional.

## Alcance

**Dentro:**

- Nueva Home en `/` (`app/page.tsx`) con las secciones del template: hero con siluetas flotantes, "¿Por qué Arcade Vault?" (4 feature cards), "Juegos disponibles ahora" (6 mini cards), stats, "Actividad en vivo" (últimas puntuaciones + top jugadores), precios con FAQ y CTA final.
- Animación `reveal` al hacer scroll (IntersectionObserver) y `fade-in`, igual que el template.
- Diseño idéntico al template: se portan a `app/globals.css` los estilos de `/* ===== HOME PAGE ===== */`, `/* ===== ACTIVITY ===== */` y `/* ===== PRICING ===== */` de `references/templates/home-about/styles.css`, sin reescribirlos con utilidades de Tailwind.
- La Biblioteca pasa de `/` a `/biblioteca` (`app/biblioteca/page.tsx`), sin cambios visuales.
- Nav (desktop y panel móvil) con cuatro links: Inicio (`/`), Biblioteca (`/biblioteca`), Salón de la Fama (`/salon`), Acerca de (`/about`).
- Ruta `/about` con un placeholder mínimo (`app/about/page.tsx`): título "ACERCA DE" y texto "PRÓXIMAMENTE".
- Actualizar los links internos que apuntaban a la Biblioteca en `/` para que apunten a `/biblioteca`.
- Textos en español, tal como en el template.

**Fuera de alcance (para specs futuros):**

- La página About real (misión, highlights, equipo, formulario de contacto) y sus estilos (`/* ===== ABOUT PAGE ===== */`).
- Los estilos de gamepad y de tweaks/themes que el template trae en el mismo `styles.css`.
- Datos reales para "Actividad en vivo" y "Top jugadores" (conectar con `av_scores` o backend).
- Cambios de comportamiento en sesión, créditos o Salón de la Fama.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```ts
// lib/home-data.ts  (constantes estáticas copiadas del template)
export interface Feature { icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET"; title: string; desc: string; color: GameColor }
export interface RecentScore { player: string; game: string; score: number; when: string; color: GameColor }
export interface TopPlayer { rank: number; player: string; score: number }
export const FEATURES: Feature[];        // 4 items
export const RECENT_SCORES: RecentScore[]; // 7 items
export const TOP_PLAYERS: TopPlayer[];     // 5 items
export const STATS: { n: string; u: string; s: string }[]; // 3 items
```

Convenciones:

- Los 6 juegos del preview salen de `GAMES.slice(0, 6)` (`lib/games.ts`).
- Los números se formatean con `toLocaleString("es-ES")`.
- Los textos y valores son exactamente los de `home.jsx`.

## Plan de implementación

Antes de empezar, leer la guía relevante en `node_modules/next/dist/docs/01-app/` (Server/Client Components, `Link`, `usePathname`, `cacheComponents`). Usar `/frontend-design` para cualquier ajuste visual.

1. Mover la Biblioteca: crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` y dejar `app/page.tsx` como placeholder temporal. Verificación: `/biblioteca` muestra las 8 tarjetas.
2. Actualizar links a la Biblioteca (`/` → `/biblioteca`) en `app/juegos/[id]/page.tsx` ("VOLVER AL VAULT"), `components/hall-of-fame.tsx`, `components/game-player.tsx` y las redirecciones de `components/auth-form.tsx` (el prototipo redirige a Biblioteca tras login/invitado). Verificación: cada botón lleva a `/biblioteca`.
3. Portar a `app/globals.css` los estilos de Home, Activity y Pricing del template, más las variables o keyframes que falten (`float`, `reveal`, etc.). Verificación: `npm run build` compila y las pantallas existentes no cambian.
4. Crear `lib/home-data.ts` con las constantes del modelo de datos.
5. Crear los componentes de la Home en `components/home/`: `floating-silhouettes.tsx`, `feature-icon.tsx`, `mini-card.tsx` y `reveal.tsx` (Client Component con IntersectionObserver). Verificación: compilan sin errores.
6. Crear `app/page.tsx` con todas las secciones de la Home usando los componentes anteriores; los CTAs usan `Link` hacia `/biblioteca`, `/login`, `/salon` y `/juegos/<id>`. Verificación: `/` se ve igual que la Home del template.
7. Crear `app/about/page.tsx` con el placeholder "ACERCA DE · PRÓXIMAMENTE".
8. Actualizar `components/nav.tsx`: links Inicio, Biblioteca, Salón de la Fama y Acerca de en desktop y panel móvil, con estado activo por `usePathname` (Inicio solo en `/`; Biblioteca en `/biblioteca` y `/juegos/*`). Verificación: el link activo cambia en cada ruta.
9. Pasada responsive y de limpieza: revisar 375px, 768px y 1280px en `/`, `/biblioteca` y `/about`; comparar lado a lado con `references/templates/home-about/arcade-vault-standalone.html`. Verificación: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [ ] `/` renderiza la Home con hero, 4 feature cards, 6 mini cards, 3 stats, 7 puntuaciones recientes, 5 top jugadores, tarjeta de precios con 3 FAQ y CTA final, sin errores en consola.
- [ ] El hero muestra las 8 siluetas flotantes, el título "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA" y los botones "EXPLORAR JUEGOS" y "CREAR CUENTA".
- [ ] Las secciones con `reveal` aparecen al hacer scroll y no quedan ocultas tras recargar.
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" e "INSERTAR MONEDA" llevan a `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS" llevan a `/login`; "VER SALÓN" lleva a `/salon`.
- [ ] Clic en una mini card lleva a `/juegos/<id>`.
- [ ] `/biblioteca` muestra las 8 tarjetas, el buscador y los chips, igual que `/` en el SPEC 01.
- [ ] "VOLVER AL VAULT", "VOLVER A LA BIBLIOTECA" y la redirección tras iniciar sesión o entrar como invitado llevan a `/biblioteca`.
- [ ] La nav muestra, en este orden, Inicio, Biblioteca, Salón de la Fama y Acerca de, en desktop y en el panel móvil.
- [ ] La nav marca como activo "Inicio" solo en `/`, "Biblioteca" en `/biblioteca` y `/juegos/*`, "Salón de la Fama" en `/salon` y "Acerca de" en `/about`.
- [ ] `/about` responde 200 y muestra "PRÓXIMAMENTE"; no existe formulario de contacto ni contenido de About.
- [ ] A 375px la Home no tiene scroll horizontal y el menú hamburguesa abre y cierra el panel con los 4 links.
- [ ] Las rutas `/salon`, `/login`, `/juegos/<id>` y `/juegos/<id>/jugar` se ven igual que antes de este spec.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** Home en `/` y Biblioteca en `/biblioteca`. Coincide con las rutas del prototipo (`home` / `biblioteca`) y con los CTAs de la Home.
- **No:** Biblioteca en `/juegos`. Se aleja del nombre del prototipo y se mezcla con `/juegos/[id]`.
- **Sí:** nav con los 4 links del template, incluido "Inicio". "Solo el nav hacia About" se interpreta como no construir la página, no como omitir links.
- **Sí:** `/about` con placeholder mínimo. El link y el estado activo funcionan sin 404; el diseño de About va en su propio spec.
- **No:** dejar el link a una ruta inexistente. Produciría un 404 visible.
- **Sí:** datos de actividad y top jugadores como constantes estáticas en `lib/home-data.ts`. Garantiza copia exacta del diseño y evita depender de `seededScores`.
- **No:** derivar esos datos de `seededScores` o `av_scores`. Los valores diferirían del template; conectarlos es trabajo de un spec con backend.
- **Sí:** reutilizar las clases CSS del template portadas a `app/globals.css`, igual que en el SPEC 01.
- **No:** portar los estilos de About, gamepad ni tweaks. Fuera de este spec.
- **Sí:** mantener el botón de sesión actual de la nav (`NOMBRE · SALIR`) en lugar del `NOMBRE ▾` del template. Es el comportamiento ya implementado y probado en el SPEC 01; cambiarlo no pertenece a este spec.
- **Sí:** solo `Reveal` y la lógica de scroll son Client Components; la página Home es un Server Component.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Las secciones `reveal` nacen con opacidad 0 y quedan ocultas si falla el JS | El observer se monta en un Client Component; si `IntersectionObserver` no existe, se añade la clase `in` directamente. |
| Mover la Biblioteca rompe links o redirecciones olvidadas | El paso 2 lista los archivos conocidos; el criterio de aceptación verifica cada botón, y se busca `href="/"` con grep. |
| Colisión de nombres de clases CSS entre Home y pantallas existentes (`.kicker`, `.section-title`, `.stat-n`) | Comparar contra `app/globals.css` antes de pegar y ajustar solo lo necesario; verificar que las 5 rutas del SPEC 01 no cambian. |
| `cacheComponents` en Next 16 afecta Server Components con datos estáticos | Leer la guía en `node_modules/next/dist/docs/01-app/` antes del paso 6. |
| Animaciones de siluetas y `pulse` afectan rendimiento en móvil | Se conservan las del template; respetar `prefers-reduced-motion` si el template ya lo hace. |

## Qué **no** está en este spec

- La página About real ni el formulario de contacto.
- Estilos de gamepad, temas o tweaks del template.
- Datos reales para actividad en vivo o top jugadores.
- Cambios en sesión, créditos o Salón de la Fama.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
