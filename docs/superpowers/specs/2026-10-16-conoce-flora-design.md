# Conocé a Flora — Design

## Objetivo
Reemplazar el placeholder de `#flora` por un primer prototipo donde el visitante conoce a Flora como personaje y entiende su rol como asistente inteligente de ENFLORA, sin sobrecargar ni afirmar capacidades de IA como ya disponibles.

## Decisiones
- Misma sección: `id="flora"`, `data-logo="dark"`. No crear otra sección.
- No tocar Hero, ConEnflora, Producto, Regalo, Precios, Instalación, Contacto, Lanzamiento.
- Componentización por bloque (enfoque 2).
- Layout desktop bloque 1: editorial 3 zonas (texto | Flora | ficha+IG apiladas).
- Protagonista: `public/images/flora-en-la-ofi.png`.
- Galería (3): `flora-landing-registros.png`, `flora-landing-compartir.png`, `flora-landing.png`.
- Instagram: SpotlightCard (React Bits JS+CSS) con `theme="dark"`, `spotlightColor="#A4C85B"`, surface vía CSS `#0B3D2A`.
- Avatar IG: isotipo oficial (`enflora-isotipo-light.svg` o equivalente legible sobre fondo oscuro).
- Sin badges “Próximamente”. Textos de beneficios en tono aspiracional (“está pensada para…”).
- Sin métricas inventadas ni posts falsos de Instagram.
- Galería estática (sin modal) en este prototipo.
- Datos editables centralizados en `lib/flora-landing.js`.

## Arquitectura de archivos

### Nuevos
- `componentes/landing/seccion-conoce-flora.js` — orquesta `#flora`
- `componentes/landing/presentacion-flora.js` — título, copy, tags, ilustración, burbuja
- `componentes/landing/ficha-flora.js`
- `componentes/landing/perfil-social-flora.js` — contenido dentro de SpotlightCard
- `componentes/landing/beneficios-flora.js`
- `componentes/landing/galeria-flora.js`
- `componentes/landing/spotlight-card.js` + `spotlight-card.css` — port React Bits (mismo patrón que `magic-bento`)
- Surface dark override a `#0B3D2A` vía prop `style` / CSS variables del componente
- `lib/flora-landing.js` — textos, ficha, tags, beneficios, galería, URL Instagram
- Estilos de sección `.flora` en `_landing.scss` (reemplazo del placeholder)

### Modificados
- `componentes/landing/landing.js` — montar `SeccionConoceFlora` en lugar del placeholder
- `estilos/paginas/_landing.scss` — reemplazar estilos `.flora` actuales
- `lib/landing.js` — delegar o reemplazar el objeto `flora` mínimo actual

## Estructura visual (una sola sección)

### Bloque 1 — Presentación
- Izquierda: “Conocé a Flora.” (Flora en verde claro), subtítulo, descripción en primera persona, 3 tags.
- Centro: ilustración protagonista, forma orgánica verde, burbuja “¡Holaa, soy Flora!”, decoración mínima (corazón / líneas).
- Derecha: Ficha de Flora (crema/blanca) + SpotlightCard Instagram apilados.

### Bloque 2 — Así te ayuda Flora
- Título corto, sin párrafo largo.
- Tres tarjetas: registrar / entender / acompañar.
- Íconos Lucide o SVG simples; fondos verdes suaves + una variación rosa suave.
- No clicables.

### Bloque 3 — Momentos de Flora
- Título + bajada: “Porque trabajar en ENFLORA no es lo único que hago.”
- Tres imágenes con captions cortos.
- Hover zoom suave en desktop.

## Contenido clave

### Presentación
- Sub: “La cara de ENFLORA y tu asistente personal de cultivo.”
- Copy: Hola, soy Flora… (brief).
- Tags: Asistente IA · Buena onda · Fan de los registros.

### Ficha (lore editable)
Nombre, Ocupación, Edad, Cumpleaños (20 de abril), Genética, Lugar de nacimiento, Especialidad, Frase favorita.

### Instagram
- Nombre: Flora · Usuario: @enflora420
- Descripción: La cara de ENFLORA.
- Tags: ENFLORA · Cultivos · Buena onda
- Bio corta sin números.
- Micro-tags: Mis aventuras · Novedades · Detrás de escena
- CTA: Seguime en Instagram → `https://www.instagram.com/enflora420/` (`target="_blank"`, `rel="noopener noreferrer"`)

### Beneficios
Textos del brief. Sin “Próximamente”.

## Responsive
Orden mobile: título → copy → Flora → ficha → IG → beneficios → galería.
Sin overflow horizontal. Galería puede ser scroll horizontal suave.
En touch: SpotlightCard con `ambient` o intensidad baja; no depender del mouse.

## Motion
- Entradas: opacity 0→1, y 12–20px, ~300–450ms.
- Flora: entrada + flotación leve (sin rotaciones exageradas).
- Beneficios: stagger + hover elevación.
- Respetar `prefers-reduced-motion` vía `useReducedMotion`.
- No pelear con GSAP de otras secciones (esta sección usa Motion local).

## Estética
- Colores: `#0B3D2A`, `#A4C85B`, `#F4F8EE`, `#F0B4B4` (acento), blanco/crema superficies.
- Tipografía: Fredoka títulos, Inter cuerpo (tokens existentes de la landing).
- Contenedor max-width alineado al resto de la landing.

## Fuera de alcance
- No usar la imagen de referencia como fondo.
- No generar ilustraciones nuevas.
- No modificar el diseño del personaje.
- No modal de galería en v1.
- No cambiar otras secciones.
