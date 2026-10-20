---
name: new-game
description: Diseña el spec para crear un juego nuevo (o portar uno de references/started-games/) e integrarlo en Arcade Vault con catálogo en Supabase y leaderboard. Úsalo antes de escribir código de un juego.
disable-model-invocation: true
argument-hint: "nombre del juego o carpeta de references/started-games (p. ej. 03-tetris)"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), mcp__supabase__list_tables, mcp__supabase__execute_sql
---

# /new-game — Spec de un juego con leaderboard

## Contexto de la sesión

Fecha de hoy (úsala en la cabecera del spec, nunca la adivines):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null`

Juegos ya portados y registro genérico:
!`ls lib/games/ 2>/dev/null`

---

Esta skill **no escribe código, no toca git ni la base de datos**. Produce un spec en `specs/` siguiendo el método de la skill `/spec` (su `SKILL.md` y su `template.md` son la referencia de formato y de reglas) y el patrón de SPEC 05 y SPEC 06; la implementación la hace `/spec-impl` cuando el humano lo apruebe.

Responde en el idioma del proyecto (español), igual que los specs existentes.

## Fase 0 — Leer la skill /spec (obligatorio)

**Antes de hacer cualquier otra cosa y, en todo caso, antes de crear el archivo de especificación**, lee completas, con `Read`:

1. `~/.claude/skills/spec/SKILL.md`: el flujo (fases, cuándo parar de preguntar, modo rápido frente a sección por sección, reglas de guardado, `specs/.spec-config.yml`, reglas duras).
2. `~/.claude/skills/spec/template.md`: la forma exacta de cada sección del spec y las reglas globales del documento.

Si alguno no existe en esa ruta, prueba con `~/.agents/skills/spec/`. Si no lo encuentras, detente y avisa al usuario: no escribas el spec de memoria.

Reglas de `/spec` que esta skill hereda sin cambios:

- El spec no contiene código largo, ni TODOs, ni criterios no verificables ("que funcione bien").
- Una frase por idea y nombres concretos de archivos, claves y tablas.
- La sección "Fuera de alcance" y el cierre "Qué **no** está en este spec" son obligatorios.
- Cada paso del plan deja el sistema funcional y se puede commitear solo.
- El último paso del plan no es "probar todo": eso son los criterios de aceptación.
- Lo que `template.md` de `/spec` y el `template.md` de esta skill digan distinto, se resuelve así: la estructura y las reglas las manda `/spec`; los contenidos fijos de un juego (leaderboard, ciclo de vida, criterios comunes) los aporta el `template.md` de esta skill.

## Fase 1 — Contexto

1. Lee `CLAUDE.md` y `AGENTS.md`.
2. Lee `specs/05-juego-asteroids.md` y `specs/06-games-y-leaderboard.md` (el patrón fundacional) y el spec de juego más reciente si hay otro.
3. Lee `integration.md` (misma carpeta que esta skill): contrato del motor, registro, integración en `GamePlayer` y SQL del catálogo.
4. Mira el catálogo real con `execute_sql` (solo `select`): `select id, title, cat, cover, color, position from games order by position;`. Sirve para ofrecer placeholders reemplazables y calcular la siguiente `position`.
5. Comprueba si existe `lib/games/registry.ts`. Si **no** existe, el plan del spec debe empezar con el paso 0 "Contrato y registro" de `integration.md`, que incluye migrar Asteroids.

Si `$ARGUMENTS` está vacío, pide una descripción del juego en una frase; si no cabe en una, sugiere dividirlo.

## Fase 2 — Origen del juego

**Con referencia** (`$ARGUMENTS` coincide con una carpeta de `references/started-games/`): lee su `CLAUDE.md`, `README.md`, `game.js` y los archivos auxiliares (`levels.js`, `style.css`, `assets/`). Extrae y anota para el spec:

- Estado (globals de módulo que habrá que encapsular en una clase) y loop (`requestAnimationFrame`, `dt` o acumulador).
- Entrada: teclas exactas y si hay estados de pausa/game over propios.
- HUD: qué se pinta en DOM (se mueve a la barra de React) y qué en canvas.
- Tamaño del canvas y constantes de física/puntuación que deben conservarse.
- Assets (sprites, sonido) y dependencias del DOM.
- Condición de fin de partida y fórmula de puntuación.
- Diferencias entre README y código: **la fuente de verdad es `game.js`**.

**Sin referencia**: pregunta mecánicas, controles, puntuación, niveles, condición de fin y qué referencia visual seguir.

## Fase 3 — Preguntas

Haz bloques de 3 a 5 preguntas con `AskUserQuestion`; no una a una. Cubre siempre:

- **Catálogo**: ¿reemplaza un placeholder (lista los candidatos de la misma categoría, p. ej. Tetris → `caida`, Arkanoid → `bloque-buster`) o es entrada nueva? En ambos casos: `id`, `title`, `short`, `long`, `cat`, `cover`, `color`.
- **HUD**: qué muestra la barra de React (`score`, `level`, `lives` opcional) y qué se queda en el canvas.
- **Controles**: teclas del juego (las que harán `preventDefault`) y texto de la línea de ayuda.
- **Canvas**: tamaño lógico y relación de aspecto frente a `.crt-screen`.
- **Assets y sonido**: dentro o fuera de alcance; si dentro, van a `public/games/<id>/`.
- **Fuera de alcance**: táctil, gamepad, sonido, mecánicas del README no implementadas, recoloreo.
- **Decisiones cerradas** que el usuario no quiera reabrir.

Propón siempre una opción recomendada y marca los riesgos propios del juego.

## Fase 4 — Redacción

Sigue la "Fase 3 — Write the spec" de `/spec` (que leíste en la Fase 0) y rellena el `template.md` de esta skill, que ya trae lo fijo de un juego (leaderboard, guardado, ciclo de vida, criterios comunes). Concéntrate en lo específico: mecánicas, constantes, controles, modelo de datos del juego, decisiones y riesgos.

Modo de redacción, tal como lo define `/spec`:

- **Información completa** (puedes responder sin suponer nada qué archivos cambian, cuáles son el primer y el último paso, y cómo se verifica que está terminado): escribe el spec entero y pasa directo a la Fase 5. No pidas confirmación sección por sección ni muestres un borrador.
- **Información incompleta** (el usuario cortó las preguntas, una respuesta fue vaga o una sección obliga a inventar): desarrolla las secciones de una en una, muéstralas y espera confirmación antes de la siguiente.

Orden de contenido (el de `/spec`): cabecera, alcance, modelo de datos, plan de implementación, criterios de aceptación, decisiones, riesgos y cierre "Qué no está".

Reglas:

- Usa el estado `Borrador` (o su equivalente en el idioma de los specs existentes). Nunca `Aprobado`: eso lo cambia el humano.
- `Depende de:` SPEC 05, SPEC 06 y el spec que haya creado el registro genérico, si ya existe.
- Cada paso del plan lleva una línea `Verificación:`.
- No inventes datos: si algo no está claro, vuelve a la Fase 3.
- Si el usuario pide saltarse las preguntas, avísale como indica `/spec` y, si insiste, anota "Definición rápida sin aclaración detallada" en la sección de decisiones.

## Fase 5 — Guardar

Sigue la "Phase 4 — Save the spec" de `/spec`:

1. Calcula el número `NN` siguiente al mayor de `specs/` (dos dígitos) y el slug: `specs/NN-juego-<slug>.md`.
2. Usa la fecha del contexto de la sesión; nunca escribas una fecha que no hayas leído de ahí.
3. Comprueba que cada spec citado en `Depende de:` existe en `specs/`; si alguno no existe, dilo en vez de dejar una referencia colgada.
4. Escribe el archivo con `Write`, sin pedir permiso ni confirmar el nombre; solo pregunta si el archivo ya existe.
5. Si `specs/.spec-config.yml` no existe, créalo con el contenido por defecto que define `/spec` (`AutoCreateBranch: true`). Si existe, no lo toques.
6. Cierra con un resumen corto: ruta del spec, decisiones clave (reemplazo vs. nuevo, HUD, fuera de alcance), aviso de que está en `Borrador` y el siguiente paso: revisarlo, cambiar el estado a `Aprobado` a mano y ejecutar `/spec-impl NN-slug`. Si creaste `.spec-config.yml`, menciónalo.
7. **Detente aquí.** No propongas implementar el spec ni escribir código.
