# SPEC 03 — Página About y formulario de contacto con Resend

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-11
> **Objetivo:** Reemplazar el placeholder de `/about` por la página About exacta del template `references/templates/home-about/` y hacer que su formulario de contacto envíe un correo real mediante Resend con una Server Action.

## Por qué existe este spec

El SPEC 02 dejó `/about` como placeholder ("PRÓXIMAMENTE") y declaró fuera de alcance la página real, sus estilos (`/* ===== ABOUT PAGE ===== */`) y el formulario. En el template el envío es simulado: `onSubmit` solo muestra la terminal de éxito. Este spec porta el diseño tal cual y conecta el formulario a un envío real. Es el primer código de servidor del proyecto, así que fija el patrón (Server Action + variables de entorno) para futuros specs con backend.

## Alcance

**Dentro:**

- Página `/about` con las secciones de `about.jsx`: hero ("ACERCA DE ARCADE VAULT", misión y 3 highlights con iconos pixel), divisor animado de 24 píxeles y sección de contacto (intro con 3 tips + formulario).
- Animación `reveal` al hacer scroll y `fade-in`, igual que el template.
- Diseño idéntico al template: se portan a `app/globals.css` los estilos de `/* ===== ABOUT PAGE ===== */` de `references/templates/home-about/styles.css`, incluidos `shake`, `terminal-success`, `tip-led` y sus keyframes, sin reescribirlos con utilidades de Tailwind.
- Formulario con campos NOMBRE, CORREO ELECTRÓNICO y MENSAJE, botón "▶  ENVIAR MENSAJE", animación `shake` si hay error de validación y terminal de éxito ("MENSAJE RECIBIDO… GRACIAS, {NOMBRE}.") con "ENVIAR OTRO MENSAJE".
- Envío con una Server Action (`app/about/actions.ts`) que usa el SDK `resend` y envía el correo a `CONTACT_TO_EMAIL` desde `onboarding@resend.dev`, con `replyTo` igual al correo del visitante.
- Validación en el servidor (campos obligatorios, formato de correo, longitudes máximas) y campo honeypot oculto contra bots.
- Estado de error en el formulario: conserva lo escrito y muestra un aviso estilo terminal con opción de reintentar.
- Variables de entorno `RESEND_API_KEY` y `CONTACT_TO_EMAIL` en `.env.local`.
- Textos en español, tal como en el template.

**Fuera de alcance (para specs futuros):**

- Dominio propio verificado en Resend y remitente personalizado.
- Rate limiting por IP o por sesión (requiere almacén externo).
- Guardar los mensajes en base de datos o un panel para leerlos.
- Correo de confirmación automático al visitante.
- Plantillas de correo con React Email.
- Los estilos de gamepad y de tweaks/themes del template.
- Tests automatizados, SEO avanzado, i18n.

## Modelo de datos

```ts
// lib/contact.ts  (esquema compartido entre cliente y servidor)
export interface ContactInput { name: string; email: string; msg: string; website?: string } // website = honeypot
export type ContactResult = { ok: true; name: string } | { ok: false; error: "validation" | "send" };
export const LIMITS = { name: 60, email: 120, msg: 2000 };
export function validateContact(input: ContactInput): boolean; // true si los 3 campos tienen texto, el correo es válido y respetan LIMITS
```

Convenciones:

- Variables de entorno (solo servidor, nunca `NEXT_PUBLIC_*`): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`.
- Remitente fijo: `Arcade Vault <onboarding@resend.dev>`. Asunto: `[Arcade Vault] Nuevo mensaje de {name}`.
- `.gitignore` ya ignora `.env*`, así que las claves no se versionan.
- Si el honeypot `website` viene con contenido, la acción devuelve `{ ok: true }` sin enviar nada (el bot no recibe señal de bloqueo).
- Textos y clases CSS exactamente los de `about.jsx`.

## Plan de implementación

Antes de empezar, leer la guía relevante en `node_modules/next/dist/docs/01-app/` (Server Actions / Forms, Server y Client Components, variables de entorno, `cacheComponents`). Usar `/frontend-design` para cualquier ajuste visual.

1. Instalar `resend` (`npm install resend`) y crear `.env.local` con `RESEND_API_KEY` y `CONTACT_TO_EMAIL`. Verificación: `npm run build` compila.
2. Portar a `app/globals.css` los estilos de `/* ===== ABOUT PAGE ===== */` y los keyframes que falten. Verificación: `npm run build` compila y las demás pantallas no cambian.
3. Crear `lib/contact.ts` con `ContactInput`, `ContactResult`, `LIMITS` y `validateContact`.
4. Crear `app/about/actions.ts` (`"use server"`) con `sendContactMessage(input)`: valida, descarta honeypot, envía con Resend y devuelve `ContactResult`; captura excepciones y errores de Resend como `{ ok: false, error: "send" }` sin filtrar detalles al cliente. Verificación: invocar la acción con datos válidos entrega el correo en `CONTACT_TO_EMAIL`.
5. Crear los componentes en `components/about/`: `highlight-icon.tsx` (HEART, BROWSER, PLANT) y `reveal.tsx` (reutilizar el de `components/home/` si su interfaz sirve; si no, extraerlo a un lugar común sin cambiar la Home). Verificación: compilan sin errores.
6. Crear `components/about/contact-form.tsx` (Client Component): estado `form`, `sent`, `shake`, `error`; honeypot oculto; llama a `sendContactMessage`; muestra terminal de éxito, aviso de error y botón de reintento. Verificación: formulario vacío hace shake; envío válido muestra la terminal.
7. Reemplazar `app/about/page.tsx` (Server Component) con el hero, el divisor y la sección de contacto usando los componentes anteriores. Verificación: `/about` se ve igual que la página About del template.
8. Pasada responsive y de limpieza: revisar 375px, 768px y 1280px en `/about`; comparar lado a lado con `references/templates/home-about/arcade-vault-standalone.html`; probar el error con una `RESEND_API_KEY` inválida. Verificación: `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [ ] `/about` responde 200, ya no muestra "PRÓXIMAMENTE" y no hay errores en consola.
- [ ] El hero muestra el kicker "▸ ACERCA DE", el título "ACERCA DE ARCADE VAULT", el texto de misión y los 3 highlights con sus iconos y colores (magenta, cyan, green).
- [ ] El divisor muestra 24 píxeles animados y la sección de contacto muestra el título "CONTÁCTANOS" y los 3 tips ("RESPUESTA EN 24-48H", "SUGERENCIAS BIENVENIDAS", "SIN SPAM, JAMÁS").
- [ ] Las secciones con `reveal` aparecen al hacer scroll y no quedan ocultas tras recargar.
- [ ] Enviar el formulario con algún campo vacío sacude el formulario y no envía ningún correo.
- [ ] Enviar nombre, correo válido y mensaje llega un correo a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Nuevo mensaje de {nombre}`, el cuerpo con nombre, correo y mensaje, y `Reply-To` igual al correo del visitante.
- [ ] Tras un envío exitoso se muestra la terminal "MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE EN MAYÚSCULAS}." y "ENVIAR OTRO MENSAJE" restablece el formulario vacío.
- [ ] La acción rechaza en el servidor un correo con formato inválido o campos que exceden `LIMITS`, aunque se salte la validación del cliente.
- [ ] Un envío con el campo honeypot relleno muestra éxito pero no genera ningún correo.
- [ ] Con `RESEND_API_KEY` inválida o ausente se muestra el aviso de error, los campos conservan lo escrito, hay opción de reintentar y la consola del navegador no expone la clave ni el error interno.
- [ ] `RESEND_API_KEY` no aparece en el bundle del cliente (no existe en `.next/static`).
- [ ] La nav marca "Acerca de" como activo en `/about`.
- [ ] A 375px `/about` no tiene scroll horizontal y el formulario es usable.
- [ ] Las rutas `/`, `/biblioteca`, `/salon`, `/login` y `/juegos/<id>` se ven igual que antes de este spec.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisiones

- **Sí:** Server Action para el envío. Es el patrón idiomático de App Router, mantiene la clave solo en el servidor y no expone un endpoint público.
- **No:** Route Handler `/api/contact`. Más código y una superficie pública sin beneficio hoy.
- **Sí:** `onboarding@resend.dev` como remitente y `CONTACT_TO_EMAIL` por variable de entorno. Funciona sin verificar dominio; el destino se cambia sin tocar código.
- **No:** dominio propio verificado. Requiere DNS; se aborda cuando exista dominio de producción.
- **Sí:** `replyTo` con el correo del visitante. Permite responder directo desde el cliente de correo.
- **Sí:** validación en el servidor más honeypot. Cubre abuso básico sin dependencias ni infraestructura.
- **No:** rate limiting. Necesita un almacén (Upstash/KV); merece su propio spec.
- **Sí:** mostrar aviso de error estilo terminal y conservar los datos escritos. El template no cubre el fallo; así el usuario no pierde su mensaje.
- **Sí:** mantener la validación de campos vacíos con `shake` del template como primera línea en el cliente.
- **Sí:** reutilizar las clases CSS del template portadas a `app/globals.css`, igual que en los SPEC 01 y 02.
- **No:** portar estilos de gamepad ni tweaks. Fuera de este spec.
- **Sí:** la página `/about` es un Server Component; solo el formulario y `Reveal` son Client Components.
- **No:** correo de confirmación al visitante ni almacenamiento en base de datos. Fuera de alcance.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Con `onboarding@resend.dev` Resend solo entrega al correo dueño de la cuenta | `CONTACT_TO_EMAIL` debe ser el correo con el que se registró la cuenta de Resend; se prueba en el paso 4. |
| `RESEND_API_KEY` expuesta al cliente | Solo se lee dentro de `app/about/actions.ts`, sin prefijo `NEXT_PUBLIC_`; el criterio de aceptación verifica el bundle. |
| Spam o abuso del formulario | Honeypot y validación de longitudes; el rate limiting queda como spec futuro. |
| Inyección de contenido en el HTML del correo | El cuerpo se envía como texto plano (`text`) o con los valores escapados; nunca se interpolan campos del visitante en HTML sin escapar. |
| Colisión de nombres de clases CSS del About con pantallas existentes (`.field`, `.kicker`, `.shake`) | Comparar contra `app/globals.css` antes de pegar y ajustar solo lo necesario; verificar que las demás rutas no cambian. |
| `cacheComponents` en Next 16 afecta Server Components y Server Actions | Leer la guía en `node_modules/next/dist/docs/01-app/` antes del paso 4. |
| El `Reveal` de la Home no sirve tal cual para About | Se extrae o se reutiliza sin cambiar el comportamiento de la Home (paso 5). |

## Qué **no** está en este spec

- Dominio propio verificado en Resend.
- Rate limiting, captcha o almacén externo.
- Base de datos o panel para leer los mensajes.
- Correo de confirmación al visitante y plantillas con React Email.
- Estilos de gamepad, temas o tweaks del template.
- Tests automatizados, SEO avanzado e i18n.

Cada uno de estos puntos, si se aborda, va en su propio spec.
