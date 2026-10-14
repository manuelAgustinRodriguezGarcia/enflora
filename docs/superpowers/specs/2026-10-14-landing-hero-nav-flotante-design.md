# ENFLORA — Rediseño hero + navegación flotante

## Objetivo

Adaptar la landing existente al boceto de referencia (desktop) y a la especificación mobile, sin reescribir la app ni las rutas internas. Incorporar navegación flotante solo en mobile y header fijo con logo dark/light según sección.

## Enfoque

Evolucionar la landing actual (`componentes/landing/*`, `estilos/paginas/_landing.scss`, `lib/landing.js`). No crear una landing nueva ni tocar auth/DB/app interna.

## Identidad

- Colores: `#0B3D2A`, `#A4C85B`, `#5C402D`, `#D8C3A5`, `#E98A3D`, fondo `#F4F8EE`
- Tipografías: Fredoka (títulos) · Inter (UI/cuerpo) — ya en tokens
- Íconos reales (Lucide). Flora y phones: placeholders con `data-asset` listos para reemplazo

## Header

### Desktop
- `position: fixed`
- Logo izquierda · nav centrada · CTA “Empezar gratis” → `/registro`
- Links: Inicio `#inicio` · Para qué sirve `#que-es` · Flora `#flora` · Novedades `#novedades` · Planes `#planes` · Contacto `#contacto`
- Sin Blog ni páginas inexistentes

### Mobile
- `position: fixed`
- Solo logo centrado (sin links ni CTA de header)
- Navegación de secciones vía controles flotantes

### Logo dark/light (ambos breakpoints)
- Cada sección declara `data-logo="dark|light"`
- Header observa la sección activa (IntersectionObserver) y alterna SVGs oficiales

## Hero

### Copy
- Eyebrow: `TU CULTIVO, MÁS SIMPLE`
- Título: `Tu cultivo,` (dark) / `bajo control` (accent)
- Bajada: `Registrá, organizá y comprendé cada etapa de tu cultivo en un solo lugar.`
- Primario: Empezar gratis → `/registro`
- Secundario: Descubrir ENFLORA → `#que-es`
- Beneficios: Organizá tu cultivo · Conocé tu progreso · Tomá mejores decisiones

### Desktop
- Dos columnas: copy | composición visual (placeholders Flora + 1–2 phones + blobs/hojas/suelo)

### Mobile
- Orden: título → bajada → CTAs anchos → composición visual
- Sin overflow horizontal ni alturas rígidas

### Animación (GSAP)
- Timeline de entrada: header → título → bajada → botones → mockups → Flora → decoración
- Float suave; menos animaciones simultáneas en mobile
- Respetar `prefers-reduced-motion`

## Navegación flotante (solo mobile)

Aparece al salir de `#inicio` (IntersectionObserver). Oculta en desktop. Si el usuario vuelve al hero con el menú abierto, se cierra.

### Izquierda — Volver arriba
- Círculo ~52–56px, fondo `#0B3D2A`, flecha clara
- Scroll a `#inicio` (suave; inmediato si reduced-motion)

### Derecha — Menú morph (Motion)
- Cerrado: 4 puntos 2×2 · Abierto: morph a X (spring)
- 5 cápsulas: Para qué sirve · Flora · Novedades · Planes · Contacto
- Cierre: toggle, Escape, outside click, elegir opción
- A11y: `button`, `aria-label`, `aria-expanded`, `aria-controls`, focus, safe-area
- z-index bajo modales; fixed con `env(safe-area-inset-*)`

## Secciones nuevas (mínimas)

- `#novedades`: título + texto breve + placeholder visual opcional
- `#contacto`: título + texto breve + CTAs a `/registro` e `/ingreso`

Secciones existentes se mantienen; se les agrega `data-logo` según fondo.

## Stack de animación

| Tecnología | Uso |
|---|---|
| GSAP + ScrollTrigger | Hero, scroll, revelados grandes |
| Motion | Morph menú, cápsulas, microinteracciones flotantes |
| SCSS | Layout, responsive, estados |

Un solo motor por propiedad del mismo elemento. Sin dependencias nuevas.

## Archivos previstos

- Modificar: `hero.js`, `encabezado-publico.js`, `landing.js`, `_landing.scss`, `lib/landing.js`
- Crear: `navegacion-flotante.js` (+ estilos en `_landing.scss` o parcial dedicado)

## Fuera de alcance

- Redibujar Flora · nuevas páginas · auth/DB · rediseño app interna · librerías nuevas
