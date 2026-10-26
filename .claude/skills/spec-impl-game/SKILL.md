---
name: spec-impl-game
description: Implementa un spec de juego aprobado igual que /spec-impl (valida estado Aprobado, crea la rama spec-NN-slug, implementa paso a paso con pausas) y al terminar ejecuta en secuencia los agentes skin-designer y luego mobile-porter sobre ese juego.
disable-model-invocation: true
argument-hint: <NN-juego-slug>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*), Bash(npm run lint:*), Bash(npm run build:*)
---

# /spec-impl-game — Implementador de specs de juegos

Hace lo mismo que `/spec-impl` y, al terminar la implementación, lanza `skin-designer` y después `mobile-porter` sobre el juego implementado.

## Contexto de la sesión

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Configuración de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (por defecto, sin archivo de config)"`

Juegos registrados:
!`cat lib/games/registry.ts 2>/dev/null || echo "No existe lib/games/registry.ts"`

---

## Instrucciones

Sigue estas cinco fases en orden estricto. **No avances a la siguiente fase si la anterior no terminó correctamente.**

---

### Fase 1 — Identificar el spec

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` está vacío:

- Lista los archivos disponibles en `specs/` (ya los tienes arriba).
- Pide al usuario el nombre exacto del spec.
- Detente y espera respuesta. No continúes.

Si `$ARGUMENTS` tiene valor:

- Busca el archivo en `specs/`. El usuario puede haber escrito el nombre completo (`09-juego-snake`), solo el número (`09`) o solo el slug (`juego-snake`). Intenta encontrarlo en cualquiera de esos casos.
- Si no lo encuentras, muestra los specs disponibles y pide que corrija el nombre.
- Si lo encuentras, continúa a la Fase 2.

Comprobación extra de este comando: el spec debe ser de **un juego** (normalmente `specs/NN-juego-<slug>.md`). Extrae el **id de catálogo** del juego (el `id` de la fila en `games`, que será también la clave en `lib/games/registry.ts`; p. ej. `serpentina`). Si no puedes determinarlo con certeza, pregúntaselo al usuario. Si el spec no es de un juego, dilo y sugiere usar `/spec-impl`.

---

### Fase 2 — Validar el estado del spec

Lee el spec localizado. Busca la línea de estado (`**Estado:**`, `**Status:**` u otra etiqueta equivalente, cerca del inicio del archivo).

**Regla absoluta:** solo puedes continuar si el estado **significa "Aprobado"**, en cualquier idioma (`Aprobado`, `Approved`, `Aprovado`, `Approuvé`, `Genehmigt`, `Approvato`, …).

Cualquier otro valor (Borrador/Draft, En revisión, Implementado, Obsoleto, valor no reconocido, línea no encontrada) significa **detenerte** y mostrar este mensaje:

```
❌ No puedo implementar este spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado significa "Aprobado" (p. ej. `Aprobado`,
`Approved` o el equivalente en otro idioma).

Para continuar tienes dos opciones:
  1. Si el spec está listo para implementarse, ábrelo y cambia el estado
     a "Aprobado" manualmente. Ese cambio lo hace la persona, no el agente.
  2. Si el spec aún necesita trabajo, usa /spec [nombre] para retomarlo.
```

No ofrezcas alternativas ni sugieras "puedo empezar igualmente". El bloqueo es intencional. Si dudas de que un valor signifique "aprobado", no lo asumas: detente y pregunta.

---

### Fase 3 — Crear la rama git y cambiar a ella

0. **Revisa primero el árbol de trabajo.** Si `git status --short` (arriba) **no está vacío**, detente, muestra los cambios pendientes y pregunta:

   ```
   ⚠️ Hay cambios sin commitear en el árbol de trabajo.
   Cambiar de rama los arrastraría. ¿Qué quieres hacer?
     1. Haz commit o stash tú mismo y vuelve a ejecutar este comando  (recomendado)
     2. Continuar de todas formas — los cambios viajan a la nueva rama
   ```

   Espera la respuesta. **No hagas stash ni commit por el usuario** salvo que lo pida explícitamente. Si está limpio, pasa al paso 1 sin mencionarlo.

1. Deriva el nombre de la rama del nombre completo del spec, sin extensión: `spec-NN-slug` (p. ej. `09-juego-snake.md` → `spec-09-juego-snake`).

2. Lee `AutoCreateBranch` de la configuración mostrada arriba. Si no existe el archivo, falta el valor o no se reconoce → trátalo como `true`. Solo un `false` explícito (en cualquier capitalización) lo desactiva.

   **Si es `true`:** procede sin preguntar.

   - Si la rama **no existe**: `git checkout -b spec-NN-slug`.
   - Si **ya existe**: se retoma trabajo previo. Cambia a ella, lee `git log --oneline`, di qué pasos del plan parecen hechos y desde cuál propones retomar. Espera confirmación del punto de reanudación antes de implementar nada.
   - En ambos casos confirma que el cambio de rama fue exitoso antes de continuar.

   **Si es `false`:** pregunta antes de tocar git:

   ```
   AutoCreateBranch está en false.
   ¿Crear y cambiar a la rama spec-NN-slug? [y/N]
   ```

   - Si responde que sí: crea/cambia como en el caso `true`.
   - Si responde que no o vacío: **no crees ninguna rama**, avisa que implementarás en la rama actual y pide confirmación explícita.

3. Confirma al usuario:

   ```
   ✅ Listo para implementar.

   Spec:   specs/NN-slug.md
   Juego:  <id de catálogo>
   Rama:   spec-NN-slug  (activa)
   Estado: Aprobado   (← el valor real encontrado)
   ```

4. **Todavía no implementes.** Muestra primero el resumen del spec: **objetivo**, **alcance**, **plan de implementación** (pasos numerados) y **criterios de aceptación**. Identifica las secciones por significado, no por título exacto.

---

### Fase 4 — Implementar paso a paso

Tras el resumen, di:

```
Voy a implementar el spec siguiendo exactamente el plan de implementación.
Haré una pausa tras cada paso para que revises el diff.
Al terminar, ejecutaré skin-designer y después mobile-porter sobre <id>.

¿Empezamos con el Paso 1?
```

Espera confirmación explícita ("sí", "dale", "go" o equivalente. Sin ella no empieces.

Una vez confirmado, durante toda la implementación:

- **Nunca hagas commit automáticamente**, ni por paso ni al final. Solo si el usuario lo pide explícitamente.
- **Implementa lo que dice el spec.** Si algo te parece subóptimo, menciónalo como observación pero implementa lo acordado. Los cambios al spec van en el spec, no en el código por sorpresa.
- **Ritmo:** implementa un paso, resume los archivos tocados y qué hiciste, y di: `Paso N completado. ¿Puedes revisar el diff y confirmarme si sigo con el Paso N+1?` Espera confirmación.
- **Si hay una ambigüedad** que el spec no resuelve: detente, descríbela exactamente, presenta dos o tres opciones concretas y espera la decisión. No improvises.
- **Si piden algo fuera del alcance del spec:** recuérdalo, sugiere anotarlo para el siguiente spec y no lo implementes en esta rama.

Al terminar el último paso NO muestres todavía el mensaje de cierre; pasa a la Fase 5.

---

### Fase 5 — Pulido con agentes (secuencial)

1. **Verificación previa.** Confirma que el juego aparece en `lib/games/registry.ts` con su id y ejecuta `npm run lint` y `npm run build`. Informa honestamente del resultado. Si algo falla, detente, muestra el error y **no lances ningún agente** hasta resolverlo con el usuario.

2. Avisa: `Implementación terminada. Lanzo skin-designer y después mobile-porter para <id>.` No pidas confirmación extra: es el propósito de este comando.

3. **Primero `skin-designer`.** Llama a la herramienta `Agent` con `subagent_type: "skin-designer"` y un prompt como:

   > skin-designer: `<id>`. Audita y corrige (no te limites a auditar). Juego recién implementado según `specs/NN-slug.md` en la rama `spec-NN-slug`. Deja constancia en `references/game-with-themes.md`. No hagas commits ni ramas.

   Ejecútalo en primer plano y **espera su resultado**. Resume al usuario: skins resultantes, soporte claro/oscuro, verificación realizada y archivos tocados.

4. **Después `mobile-porter`, solo cuando el anterior haya terminado** (nunca en paralelo: ambos editan los archivos del mismo juego). Llama a `Agent` con `subagent_type: "mobile-porter"` y un prompt como:

   > mobile-porter: `<id>`. Audita y corrige `/juegos/<id>` y `/juegos/<id>/jugar`. Juego recién implementado según `specs/NN-slug.md`; ya tiene los skins de skin-designer, no los rompas. Deja constancia en `references/mobile-ready.md`. No hagas commits ni ramas.

   Espera su resultado y resume: tabla OK/incumple, viewports verificados y archivos tocados.

5. Si `skin-designer` falla o queda bloqueado, detente y pregunta al usuario antes de lanzar `mobile-porter`. Si un agente pide aclaración, relaya la pregunta al usuario.

6. **Mensaje final:**

   ```
   ✅ Spec implementado y pulido (skin-designer → mobile-porter).

   Siguiente paso: revisa el diff completo (incluidos los cambios de los agentes)
   y verifica uno a uno los criterios de aceptación del spec.
   Si todos pasan:
     - Cambia el estado del spec a "Implementado".
     - Añade el juego a la tabla "Specs implemented" y a la lista de juegos reales de CLAUDE.md.
     - Haz el commit final antes de mergear esta rama.
   ```

---

## Resumen del comportamiento esperado

```
/spec-impl-game 10-juego-frogger

  Fase 1  →  Localiza specs/10-juego-frogger.md y el id del juego
  Fase 2  →  Estado "Aprobado" → ✅ continúa  (Borrador/Implementado/… → ❌ se detiene)
  Fase 3  →  Crea/cambia a spec-10-juego-frogger y muestra el resumen
  Fase 4  →  Implementa paso a paso con pausas, sin commits
  Fase 5  →  lint + build → skin-designer (espera) → mobile-porter (espera) → cierre
```
