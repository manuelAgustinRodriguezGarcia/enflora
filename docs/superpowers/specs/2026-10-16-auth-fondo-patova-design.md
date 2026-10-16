# Auth — Fondo Patova desktop — Design

## Objetivo
Usar `public/images/flora-landing-patova-buena.png` como fondo de las pantallas de autenticación en desktop, con el formulario a la derecha simulando que está sobre la entrada del club. Mobile mantiene las imágenes actuales hasta que exista un asset mobile dedicado.

## Decisiones
- Alcance: `/ingreso` (`marco-auth--entrar`) y `/registro` (`marco-auth--registro`).
- Enfoque: fondo CSS en desktop + `<img>` de `.marco-auth__flora` solo en mobile.
- Desktop (≥1024px): Patova full-bleed (`background-size: cover`), panel crema a la derecha sobre la entrada.
- Mobile (<1024px): sin cambio visual; siguen `login-mobile.png` y `register-mobile.png`.
- Cuando exista imagen mobile nueva: solo cambiar paths en `imagenesFlora` dentro de `componentes/marco-auth.js`.
- No rediseñar formularios, copy ni flujo de auth.
- No glass / panel transparente: panel `#fafbf7` opaco como hoy.
- Registro desktop conserva `max-width: 600px` del panel; mismo fondo Patova.

## Arquitectura

### Modificados
- `estilos/paginas/_auth.scss`
  - En media `min-width: 1024px`, aplicar Patova a `.marco-auth--entrar` y `.marco-auth--registro`.
  - Ajustar o anular el `::before` de color plano (`--auth-fondo`) para que no tape la imagen.
  - Afinar `background-position` para que la puerta quede bajo el panel derecho.
  - Revisar contraste del encabezado (`body:has(.marco-auth)`) solo si hace falta.

### Sin cambios de API
- `componentes/marco-auth.js` — misma prop `fondo`; mapa mobile intacto.
- `app/ingreso/page.js`, `app/registro/page.js` — sin cambios.

## Layout

### Desktop
- Escena Patova edge-to-edge detrás del marco.
- Panel a la derecha (`justify-content: flex-end`, padding horizontal existente ~7vw).
- Flora (personaje) visible a la izquierda; la entrada queda detrás / bajo el panel.

### Mobile
- Sheet inferior + imagen Flora arriba, comportamiento actual.

## Criterio de listo
- Desktop ingreso: fondo Patova + form derecha.
- Desktop registro: mismo fondo + panel ancho actual.
- Mobile ingreso y registro: idénticos a hoy.
- Header legible sobre la escena nocturna.

## Fuera de scope
- Nueva imagen mobile.
- Cambios de tipografía, campos o validación del form.
- Animaciones nuevas.
- Aplicar Patova a otras rutas (landing, onboarding, etc.).

## Riesgos
- Crop: pantallas muy anchas o muy angostas pueden desalinear puerta/panel; se corrige con `background-position`.
- Registro con mucho contenido: el panel ya maneja altura; no cambiar ese contrato en este trabajo.
