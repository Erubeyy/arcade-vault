# SPEC 10 — Controles táctiles para jugar en móvil

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Fecha:** 2026-10-25
> **Objetivo:** Añadir un gamepad virtual único (cruceta + botones A y B) bajo el canvas, que mueve cualquiera de los 4 juegos reales desde una pantalla táctil mediante una entrada virtual en el contrato `GameEngine`.

## Por qué existe este spec

Hoy ningún juego se puede jugar en un móvil: los 4 motores (Asteroids, Tetris, Arkanoid y Snake) solo escuchan `keydown`/`keyup` en `window`, y los SPEC 05, 07, 08 y 09 dejaron «controles táctiles» fuera de alcance. Un móvil no tiene teclado, así que la página `/juegos/[id]/jugar` es hoy una pantalla que no responde.

La decisión de diseño, tomada por el usuario, es **un mismo control para todos los juegos**: el canvas ocupa la parte superior y debajo va un control simulado con una cruceta de 4 direcciones y un par de botones. Cada juego decide qué hace cada botón. Así el jugador aprende una sola disposición y el código tiene un solo componente.

Los toques no se convierten en `KeyboardEvent` falsos: el contrato `GameEngine` se amplía con un método opcional de entrada virtual que cada motor traduce a su propia lógica. Es más trabajo que emitir eventos sintéticos, pero no depende de los códigos de tecla ni de los filtros de `target` de cada motor.

## Alcance

**Dentro:**

- Tipo `VirtualButton` y método opcional `setInput(button, pressed)` en `GameEngine` (`lib/games/engine.ts`). Los motores que no lo implementen lo ignoran.
- Implementación de `setInput` en los 4 motores: `SnakeEngine`, `ArkanoidEngine`, `AsteroidsEngine` y `TetrisEngine`.
- Campo `pad` en `GameDefinition` (`lib/games/registry.ts`): qué botones usa cada juego y con qué etiqueta. Los botones ausentes se muestran atenuados y desactivados.
- Método `input(button, pressed)` en `GameCanvasHandle` (`components/game-canvas.tsx`) que reenvía al motor.
- Componente `components/touch-pad.tsx`: cruceta (`up`, `down`, `left`, `right`) y botones `a` y `b`, con eventos de puntero y multitoque (se pueden mantener varios botones a la vez, p. ej. `left` + `up` + `a` en Asteroids).
- Reparto de botones por juego:
  - Asteroids: `left`/`right` rotan, `up` propulsa, `a` dispara.
  - Tetris: `left`/`right` mueven, `down` baja, `up` y `a` rotan, `b` caída dura.
  - Arkanoid: `left`/`right` mueven la paleta, `a` lanza la bola.
  - Snake: `up`/`down`/`left`/`right` cambian la dirección.
- Repetición automática para la entrada virtual de Tetris en `left`, `right` y `down` (el teclado la obtiene del autorepetido del sistema; un toque mantenido no).
- Visibilidad solo en dispositivos táctiles con `@media (pointer: coarse)`: en ordenador el gamepad no se renderiza visualmente y se conserva la línea de teclas `.controls-hint`; en táctil ocurre lo contrario.
- Disposición vertical: canvas arriba y gamepad debajo, con la cruceta a la izquierda y los botones a la derecha del bloque inferior.
- Disposición apaisada: cruceta a la izquierda del canvas y botones A/B a la derecha, para que el canvas conserve un tamaño jugable.
- Endurecimiento de la página de juego táctil: `viewport` correcto, `touch-action: none` en el canvas y el gamepad, sin selección de texto ni menú contextual al mantener pulsado, sin zoom por doble toque y sin «pull-to-refresh» durante la partida.
- Liberar todos los botones al pausar, reiniciar, terminar la partida, destruir el motor, perder el foco (`blur`/`visibilitychange`) y al cancelarse el toque.
- Que HUD y modal «FIN DEL JUEGO» sean usables a 375 px, incluido el campo de iniciales sin provocar zoom automático en iOS.

**Fuera de alcance (para specs futuros):**

- Gestos sobre el canvas (swipe en Snake, arrastrar la paleta en Arkanoid, tap para rotar).
- Un tercer botón o un joystick analógico; deslizar el dedo de un botón a otro sin levantarlo.
- Pantalla completa, bloqueo de orientación y aviso de «gira el dispositivo».
- Vibración háptica y sonido de pulsación.
- Remapeo de botones y ajustes del gamepad (tamaño, posición, zurdos).
- Rediseño de los paneles de opciones y skins (solo se exige que no rompan el layout a 375 px).
- Soporte de gamepad físico (Gamepad API) y de ratón como sustituto del teclado.
- Cambios en los 5 juegos todavía simulados (no tienen controles).
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

Esta feature no introduce tablas ni persistencia. Añade tipos de TypeScript al contrato de motores y un campo al registro.

```ts
// lib/games/engine.ts
export type VirtualButton = "up" | "down" | "left" | "right" | "a" | "b";

export interface GameEngine {
  // ...start, pause, resume, restart, end, destroy sin cambios
  setInput?(button: VirtualButton, pressed: boolean): void; // opcional; true = pulsado, false = soltado
  releaseInput?(): void; // suelta todos los botones virtuales; opcional
}
```

```ts
// lib/games/registry.ts
export interface GameDefinition {
  // ...create, width, height, controls sin cambios
  pad: Partial<Record<VirtualButton, string>>; // botón usado → etiqueta accesible (aria-label)
}

// Ejemplo (Asteroids); un botón ausente se muestra desactivado
pad: { left: "Rotar a la izquierda", right: "Rotar a la derecha", up: "Propulsar", a: "Disparar" },
```

```ts
// components/game-canvas.tsx
export interface GameCanvasHandle {
  // ...pause, resume, restart, end, engine sin cambios
  input: (button: VirtualButton, pressed: boolean) => void;
}
```

```tsx
// components/touch-pad.tsx
export function TouchPad({
  pad,
  disabled,
  onInput,
}: {
  pad: GameDefinition["pad"];
  disabled: boolean; // true en pausa y con el modal abierto
  onInput: (button: VirtualButton, pressed: boolean) => void;
}): JSX.Element;
```

Traducción de `setInput` por motor:

| Motor     | Botón          | Efecto                                                                |
| --------- | -------------- | --------------------------------------------------------------------- |
| Snake     | 4 direcciones  | Encola un giro (`queueTurn`) al pulsar; soltar no hace nada           |
| Arkanoid  | `left`/`right` | Equivale a mantener `ArrowLeft`/`ArrowRight` hasta soltar             |
| Arkanoid  | `a`            | Lanza la bola solo en el flanco de pulsación y si `state === 'ready'` |
| Asteroids | `left`/`right` | Equivale a mantener `ArrowLeft`/`ArrowRight`                          |
| Asteroids | `up`           | Equivale a mantener `ArrowUp` (propulsión)                            |
| Asteroids | `a`            | Equivale a `Space`, con el mismo flanco `justPressed` que el teclado  |
| Tetris    | `left`/`right` | Mueve al pulsar y repite mientras siga pulsado                        |
| Tetris    | `down`         | Baja una fila al pulsar y repite mientras siga pulsado                |
| Tetris    | `up`, `a`      | Rota una vez por pulsación, sin repetición                            |
| Tetris    | `b`            | Caída dura una vez por pulsación, sin repetición                      |

Constantes nuevas:

- `INPUT_REPEAT_DELAY_MS = 170` y `INPUT_REPEAT_MS = 50` en `lib/games/tetris/engine.ts`.

Convenciones:

- Los botones virtuales ignoran la entrada con `paused` o `gameover`, igual que el teclado. Soltar siempre se procesa.
- `releaseInput()` pone en «soltado» todos los botones virtuales; el motor lo llama en `pause()`, `restart()`, `end()` y `destroy()`. React lo llama además al perder el foco.
- La entrada virtual y la de teclado conviven: no se desactiva una al usar la otra.
- El gamepad se muestra con `@media (pointer: coarse)`; la disposición apaisada con `@media (pointer: coarse) and (orientation: landscape)`.
- Tamaño mínimo de cada botón: 56×56 px (zona táctil), con separación suficiente para no pulsar dos a la vez por error.
- Los botones usan `onPointerDown`/`onPointerUp`/`onPointerCancel` con `setPointerCapture`, `touch-action: none` y `onContextMenu` con `preventDefault`.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/01-app/` la guía de metadata y del `viewport`, y las de Server y Client Components. Usar `/frontend-design` para el gamepad (cruceta, botones A/B y su apariencia retro). La referencia de integración en `GamePlayer` es SPEC 07 a 09. Cada paso deja el sistema compilando y las partidas con teclado funcionando igual que antes.

1. Contrato y registro: añadir `VirtualButton`, `setInput?` y `releaseInput?` a `GameEngine`; añadir `pad` a `GameDefinition` (con `{}` en los 4 juegos por ahora); añadir `input` a `GameCanvasHandle`. Verificación: compila; los 4 juegos se juegan igual con teclado.
2. Componente y layout: crear `components/touch-pad.tsx` y sus estilos en `app/globals.css` (cruceta + botones A/B, vertical y apaisado, visible solo con `pointer: coarse`, oculto `.controls-hint` y `.crt-bottom` en táctil); montarlo en `GamePlayer` solo si `isReal`, con `disabled` en pausa o con el modal abierto, y reenviar a `canvasRef.current?.input`. Verificación: con emulación táctil aparece el gamepad bajo el canvas en vertical y a los lados en apaisado; en escritorio no aparece; pulsar no rompe nada aunque los motores aún lo ignoren.
3. Snake: implementar `setInput` y `releaseInput`, y rellenar `pad` de `serpentina` con las 4 direcciones. Verificación: la serpiente gira con la cruceta, el giro de 180° se descarta y la cola de 2 giros se respeta.
4. Arkanoid: implementar `setInput` y `releaseInput`, y rellenar `pad` de `bloque-buster` (`left`, `right`, `a`). Verificación: la paleta se mueve mientras se mantiene `left`/`right` y `a` lanza la bola una vez.
5. Asteroids: implementar `setInput` y `releaseInput`, y rellenar `pad` de `asteroids` (`left`, `right`, `up`, `a`). Verificación: se puede rotar, propulsar y disparar a la vez con varios dedos.
6. Tetris: implementar `setInput` y `releaseInput` con repetición automática, y rellenar `pad` de `caida` (las 4 direcciones, `a`, `b`). Verificación: mantener `left` repite el movimiento tras el retardo; `up`, `a` y `b` actúan una vez por pulsación.
7. Endurecimiento de la página: `export const viewport` en `app/layout.tsx` (`width=device-width`, `initialScale=1`, sin `maximumScale` para no bloquear el zoom de accesibilidad en el resto del sitio); `touch-action: none` y `user-select: none` en el canvas y el gamepad; `overscroll-behavior-y: contain` mientras está montado `.av-player`; ajustar HUD, opciones y modal a 375 px (campo de iniciales de al menos 16 px de fuente). Verificación: sin zoom por doble toque sobre el gamepad, sin «pull-to-refresh» al arrastrar sobre el canvas y sin scroll horizontal a 375 px.
8. Limpieza: quitar importaciones muertas y ejecutar `npm run lint` y `npm run build`. Verificación: sin errores.

## Criterios de aceptación

- [ ] En emulación táctil (`pointer: coarse`), `/juegos/<id>/jugar` de los 4 juegos reales muestra el gamepad debajo del canvas en vertical y a sus lados (cruceta izquierda, A/B derecha) en apaisado.
- [ ] En ordenador (`pointer: fine`) no se ve el gamepad y sigue visible la línea de teclas `.controls-hint`; en táctil ocurre lo contrario.
- [ ] El gamepad no aparece en `/juegos/<id>/jugar` de los 5 juegos todavía simulados ni en ninguna otra ruta.
- [ ] Los botones que un juego no usa aparecen atenuados y desactivados, y los usados tienen `aria-label` con su función.
- [ ] Cada botón mide al menos 56×56 px y se pueden mantener varios a la vez (multitoque).
- [ ] Snake: las 4 direcciones cambian el rumbo; el giro de 180° se descarta; dos toques dentro del mismo paso se aplican en pasos consecutivos.
- [ ] Arkanoid: la paleta se mueve a 600 px/s mientras se mantiene `left`/`right` y se detiene al soltar; `a` lanza la bola solo en estado `ready` y mantenerlo no encadena lanzamientos.
- [ ] Asteroids: `left`/`right` rotan, `up` propulsa y `a` dispara; mantener `left` + `up` + `a` a la vez funciona; mantener `a` no dispara en ráfaga más rápido que con la barra espaciadora.
- [ ] Tetris: un toque en `left`/`right`/`down` mueve una vez; mantenerlo repite a partir de 170 ms cada 50 ms; `up`/`a` rotan una vez por toque; `b` hace caída dura una vez por toque.
- [ ] Con PAUSA activa los botones están desactivados y no actúan; al REANUDAR no queda ningún botón «pegado».
- [ ] Al abrirse el modal «FIN DEL JUEGO» el gamepad queda desactivado, y tras JUGAR DE NUEVO ningún botón sigue activo.
- [ ] Si el navegador cancela el toque (`pointercancel`), cambia de pestaña o pierde el foco, se sueltan todos los botones.
- [ ] El teclado sigue funcionando igual en los 4 juegos y puede usarse junto al gamepad.
- [ ] Arrastrar un dedo sobre el canvas o el gamepad no hace scroll de la página ni activa «pull-to-refresh».
- [ ] Mantener pulsado un botón no abre menú contextual, no selecciona texto y un doble toque rápido no hace zoom.
- [ ] A 375 px en vertical, el HUD (incluido el panel de opciones del juego) y el gamepad no producen scroll horizontal.
- [ ] A 390×844 en vertical, el canvas y el gamepad completos son visibles a la vez sin hacer scroll vertical con la página al inicio.
- [ ] A 844×390 en apaisado, el canvas y los botones laterales son visibles sin scroll horizontal y el canvas conserva la proporción 4:3 (o la de su juego) sin deformarse.
- [ ] El campo de iniciales del modal tiene fuente de al menos 16 px (iOS no hace zoom al enfocarlo) y el modal cabe en 375×667 sin cortarse.
- [ ] Salir de la partida (SALIR, REGRESAR, VOLVER AL VAULT o cambio de ruta) no deja listeners ni intervalos de repetición activos.
- [ ] Sin errores de hidratación al recargar `/jugar` en emulación táctil.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** un gamepad único para todos los juegos, con cruceta + botones A y B. Decisión explícita del usuario; se aprende una vez y hay un solo componente.
- **Sí:** canvas arriba y control debajo en vertical. Decisión explícita del usuario.
- **Sí:** cruceta a la izquierda y A/B a la derecha del canvas en apaisado. Elegido por el usuario entre mantener la disposición apilada y esta; en un móvil de lado el canvas apilado quedaría diminuto.
- **Sí:** ampliar el contrato `GameEngine` con `setInput`/`releaseInput` opcionales. Decisión explícita del usuario sobre disparar `KeyboardEvent` sintéticos; evita depender de `e.code`, de `e.repeat` y de los filtros de `target`.
- **Sí:** los métodos nuevos son opcionales. Los motores futuros y los juegos simulados no se ven obligados a implementarlos.
- **Sí:** `pad` vive en el registro, junto a `controls`. La etiqueta de cada botón es la fuente del `aria-label` y de qué botones se desactivan.
- **Sí:** mostrar el gamepad con `@media (pointer: coarse)`, no por ancho de pantalla. Decisión del usuario; una ventana estrecha de escritorio no debe enseñar botones táctiles.
- **Sí:** repetición automática de Tetris dentro del motor (170 ms de retardo, 50 ms de intervalo). El teclado usa el autorepetido del sistema; un toque mantenido no genera repeticiones.
- **Sí:** Asteroids dispara por flanco con `a`, como con `Space`. Mantener el botón no sustituye a pulsar repetidamente.
- **Sí:** `viewport` sin `maximumScale`. Bloquear el zoom perjudica la accesibilidad en el resto del sitio; el zoom de doble toque se evita con `touch-action` solo en el área de juego.
- **Sí:** ocultar `.controls-hint` y `.crt-bottom` en táctil para recuperar altura. La línea de teclas no sirve sin teclado y la barra de la CRT es decorativa.
- **Sí:** PAUSA, FIN y SALIR siguen en el HUD de React. No hay botón de pausa dentro del gamepad.
- **No:** gestos sobre el canvas (swipe, arrastrar paleta). El usuario pidió un control simulado; los gestos duplicarían superficie de código y chocan con el scroll.
- **No:** `KeyboardEvent` sintéticos. Descartados por frágiles.
- **No:** bloqueo de orientación ni pantalla completa. No son fiables en iOS Safari y no se pidieron.
- **No:** tercer botón. Hoy ningún juego lo necesita y quedaría siempre desactivado.
- **No:** deslizar el dedo entre botones. Cada botón captura su puntero; a cambio se evitan pulsaciones fantasma.
- **No:** rediseñar los paneles de opciones y skins. Solo se exige que no rompan el layout a 375 px; el usuario no los incluyó en el alcance.
- **No:** vibración ni sonido de pulsación.

## Riesgos

| Riesgo                                                                                | Mitigación                                                                                                                                          |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un botón queda «pegado» al cancelarse el toque o cambiar de pestaña                   | `onPointerCancel`, `lostpointercapture`, `blur` y `visibilitychange` llaman a `releaseInput`; también se llama en pausa, reinicio, fin y `destroy`. |
| Portátil con pantalla táctil: `pointer: coarse` falso, se ocultan las teclas o el pad | Se acepta: el puntero principal define el modo. Un híbrido con ratón principal ve la UI de escritorio y sigue pudiendo jugar con teclado.           |
| iOS Safari ignora `touch-action` en algunos casos y hace zoom o scroll                | Se combina con `overscroll-behavior-y: contain`, `user-select: none` y `preventDefault` en `onContextMenu`; se revisa a 375 px y en apaisado.       |
| El pad no cabe en vertical sin scroll junto con HUD y panel de opciones               | Se ocultan `.crt-bottom` y `.controls-hint` en táctil; si aún no cabe, el HUD se compacta (estadísticas en una fila) y se ajusta en el paso 7.      |
| La entrada virtual y el teclado se pisan (p. ej. `releaseInput` suelta una tecla)     | `releaseInput` solo toca el estado virtual, que el motor guarda aparte del mapa de teclas.                                                          |
| Doble disparo: el toque produce además un `click`/evento de ratón compatible          | Los botones solo usan eventos de puntero con `preventDefault`, no `onClick`.                                                                        |
| Los motores dejan intervalos o listeners tras salir de la partida                     | La repetición de Tetris se hace dentro del loop `requestAnimationFrame` existente, sin `setInterval`; `destroy()` sigue siendo idempotente.         |
| Strict Mode duplica el efecto y el pad envía entrada a un motor ya destruido          | `GameCanvasHandle.input` usa `engineRef.current?.` y el cleanup pone el ref en `null`.                                                              |
| El campo de iniciales provoca zoom en iOS al enfocarse                                | Fuente de al menos 16 px en táctil.                                                                                                                 |
| Sin dispositivo real a mano, la emulación no reproduce latencia ni multitoque real    | Se verifica con el modo táctil de Chrome DevTools y, antes de aprobar el spec, con un móvil real en la red local.                                   |

## Qué **no** está en este spec

- Gestos sobre el canvas (swipe, arrastre de paleta, tap para rotar).
- Tercer botón, joystick analógico y deslizar entre botones.
- Pantalla completa, bloqueo de orientación y aviso de giro.
- Vibración háptica y sonido de pulsación.
- Remapeo de botones, zurdos y ajustes del gamepad.
- Rediseño de los paneles de opciones y skins.
- Gamepad físico (Gamepad API).
- Cambios en los juegos simulados.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
