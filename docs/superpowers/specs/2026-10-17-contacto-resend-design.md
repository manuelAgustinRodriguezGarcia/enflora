# Contacto Resend — Design

## Objetivo

Reemplazar el `mailto:` del formulario de contacto de la landing por envío real vía Resend, con Route Handler en Next.js App Router. Sin rediseñar el formulario ni tocar estilos/animaciones.

## Decisiones

- Enfoque: Route Handler `POST /api/contacto` + `fetch` desde el cliente.
- Paquete: `resend` (pnpm).
- Rate limit: honeypot + validaciones ahora; Upstash Redis (tier gratuito) documentado como paso opcional, sin instalar hasta tener keys.
- No enviar correos reales hasta que existan credenciales y el usuario autorice una prueba.
- Remitente definitivo solo con dominio verificado: `ENFLORA <contacto@enflorar.com.ar>`.
- No usar `NEXT_PUBLIC_` para credenciales.

## Arquitectura

```
FormularioContacto (cliente)
  → POST /api/contacto  { nombre, correo, mensaje, empresa? }
  → lib/contacto (validar + escapar + plantilla)
  → Resend SDK (servidor)
  → CONTACT_EMAIL
```

### Archivos

| Acción | Archivo |
|---|---|
| Crear | `app/api/contacto/route.js` |
| Crear | `lib/contacto.js` |
| Crear/actualizar | `.env.example` |
| Modificar | `componentes/landing/formulario-contacto.js` |
| Modificar | `package.json` / `pnpm-lock.yaml` |
| Actualizar | `GUIA_ESTUDIO.md` (local) |
| No tocar | estilos, `seccion-contacto.js`, DNS, config Vercel |

## Contrato API

- Método: solo `POST`. Otros → `405` + JSON.
- Body JSON:
  - `nombre` (string)
  - `correo` (string)
  - `mensaje` (string)
  - `empresa` (honeypot opcional; si tiene valor → `200` `{ ok: true }` sin enviar)

### Respuestas

| Caso | Status | Body |
|---|---|---|
| Éxito / honeypot | 200 | `{ ok: true }` |
| Validación | 400 | `{ ok: false, error: "..." }` genérico |
| Método no permitido | 405 | `{ ok: false, error: "..." }` |
| Error Resend | 502 | `{ ok: false, error: "..." }` |
| Credenciales faltantes | 503 | `{ ok: false, error: "..." }` |

Al cliente nunca se exponen detalles internos de Resend ni API keys. Errores técnicos solo en logs del servidor (sin API key ni mensaje completo).

## Validaciones (cliente y servidor)

- Trim en todos los campos.
- Nombre: obligatorio, 2–100 caracteres.
- Correo: obligatorio, formato válido, máx. 254.
- Mensaje: obligatorio, 10–3000 caracteres.
- Rechazar tipos no string.
- Escape HTML en plantilla.
- Sanitizar saltos/CRLF en nombre y correo para evitar inyección de headers.
- Destinatario, remitente y asunto fijos en servidor (el cliente no los elige).

## Email

- **To:** `process.env.CONTACT_EMAIL` (ej. `enflora.420@gmail.com`)
- **From:** `process.env.RESEND_FROM_EMAIL`
- **Reply-To:** correo del visitante (ya validado)
- **Asunto:** `[ENFLORA] Nueva consulta de {nombre}`
- HTML sencillo + texto plano.
- Colores: `#0B3D2A`, `#A4C85B`, `#FDF1D7`.
- El `from` nunca es el correo del usuario.

## Formulario (UX, sin rediseño)

Estados:

1. **Inicial** — campos vacíos, botón «Enviar consulta».
2. **Enviando** — botón disabled, texto «Enviando...», indicador discreto; sin doble envío.
3. **Éxito** — «¡Tu consulta fue enviada! Te responderemos lo antes posible»; limpiar campos solo tras éxito.
4. **Error** — «No pudimos enviar tu consulta. Intentá nuevamente»; conservar datos; permitir reintento.

- Reutilizar clases existentes (`contacto__form`, `contacto__enviar`, `contacto__error`, `contacto__exito`, etc.).
- Mensajes con `role="status"` / `role="alert"` para accesibilidad.
- Honeypot: campo `empresa` off-screen, `aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`.
- Renombrar el input de email a `name="correo"` (el valor visible/placeholder no cambia de diseño).

## Variables de entorno

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=ENFLORA <contacto@enflorar.com.ar>
CONTACT_EMAIL=enflora.420@gmail.com
```

- `.env.local` ya ignorado vía `.env*` en `.gitignore` (con excepción `!.env.example`).
- En Vercel: configurar las tres variables en el proyecto.
- Sin inventar API keys ni remitentes no verificados.
- Si faltan `RESEND_API_KEY` o `RESEND_FROM_EMAIL`, el endpoint responde `503` y no intenta enviar.

## Rate limiting (opcional, documentado)

No se instala Upstash en esta entrega.

Cuando se quiera activar (tier gratuito):

1. Crear cuenta en Upstash y una base Redis.
2. Instalar `@upstash/ratelimit` y `@upstash/redis`.
3. Agregar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` a `.env.local` y Vercel.
4. Limitar por IP (header `x-forwarded-for` / `x-real-ip`) en el Route Handler, p. ej. 5 req / 10 min.
5. Responder `429` si se excede.

Hasta entonces: honeypot + validación + rechazo de métodos inválidos.

## Preparación Resend + DNS + Vercel

Pasos manuales (no automatizados):

1. Crear API key en Resend → `RESEND_API_KEY`.
2. Verificar dominio `enflorar.com.ar` en Resend (registros DNS que indique el panel: típicamente SPF, DKIM, y opcional DMARC).
3. Usar `RESEND_FROM_EMAIL=ENFLORA <contacto@enflorar.com.ar>` solo tras verificación.
4. En Vercel → Project → Settings → Environment Variables: las tres variables de arriba.
5. Redeploy tras guardar env vars.
6. Autorizar una prueba real de envío antes de usarla en producción.

## Pruebas

Ejecutables sin credenciales:

- Validación cliente (vacíos, email inválido, longitudes).
- Validación servidor (tipos, honeypot → 200 sin Resend).
- `503` si faltan env vars.
- `405` en GET u otros métodos.
- Botón disabled en estado enviando (sin doble submit).
- Diseño visual intacto.
- Build/`pnpm` sin errores.
- API key no aparece en bundle cliente.

Pendientes tras configurar Resend:

- Envío real a `enflora.420@gmail.com`.
- Reply-To funciona al responder desde Gmail.
- HTML/texto se leen bien en clientes de correo.

## Fuera de alcance

- Rediseño visual del formulario.
- Refactors ajenos al contacto.
- Instalación de Upstash.
- Cambios DNS o de infraestructura.
- Envíos reales sin autorización.
