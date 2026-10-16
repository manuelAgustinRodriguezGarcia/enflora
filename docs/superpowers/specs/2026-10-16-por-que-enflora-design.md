# ¿Por qué cultivar con ENFLORA? — Design

## Objetivo
Rediseñar completamente `#para-que-sirve` para explicar, con cuatro tarjetas grandes, por qué conviene registrar y seguir un cultivo con ENFLORA. La composición sigue la imagen de referencia (grilla 2×2, texto a la izquierda, ilustración a la derecha). Las ilustraciones finales se entregarán después; por ahora solo placeholders de código.

## Decisiones
- Misma sección: `id="para-que-sirve"`, `data-logo="dark"`. No crear otra sección ni otra ancla.
- Sigue montada dentro de `EscenaSolar` (no sacar del wrapper).
- Enfoque A: reescribir `para-que-sirve.js` + limpiar estilos `.para-que-sirve` en `_landing.scss`.
- Copy de tarjetas: textos cortos de la imagen de referencia (no los largos del brief inicial).
- Sin etiqueta “Próximamente” en ninguna card (incluido Flora / card 03).
- Sin generar, descargar ni inventar ilustraciones. Sin stock. Sin usar la imagen de referencia como fondo.
- No tocar: Hero, tarjetas flotantes, header, GooeyNav, ConEnflora, funcionalidades, Conocé a Flora, precios, contacto, ticket, footer, lógica de scroll/anclas.
- No eliminar archivos de imagen existentes en `public/` (pueden usarse en otras secciones).
- No afirmar que ENFLORA garantiza mayor cosecha; el tono de card 04 es orden + mejores decisiones.

## Arquitectura de archivos

### Modificados
- `componentes/landing/para-que-sirve.js` — reescritura completa: encabezado + grilla + `CardPorQueEnflora`.
- `lib/landing.js` — reemplazar `textos.queEs` (título, subtítulo, array de 4 cards + config de ilustración).
- `estilos/paginas/_landing.scss` — reemplazar bloque `.para-que-sirve` (eliminar tilt, flip, carrusel, flora del teléfono, keyframes asociados solo a esta sección).

### Sin cambios
- `componentes/landing/landing.js` — sigue importando `ParaQueSirve` igual.
- Imágenes en `public/images/` usadas hoy por la sección vieja (se dejan en el repo).
- GSAP del hero / ConEnflora.

### Componentes internos
- `CardPorQueEnflora` vive en el mismo archivo `para-que-sirve.js` (enfoque A: sin archivos nuevos salvo necesidad real).
- Props: número, título, descripción, config de ilustración/placeholder.
- Array centralizado en `lib/landing.js`: no duplicar JSX cuatro veces.

## Estructura visual

### Encabezado (centrado)
- Título: “¿Por qué cultivar con” en `#0B3D2A` + “ENFLORA?” en `#E98A3D`.
- Tipografía: Fredoka Semibold (`--font-identidad`).
- Tamaño: `clamp()` ~48–56px en desktop; sin overflow en notebooks.
- Subtítulo (Inter / `--font-funcional`): “Porque registrar lo que pasa hoy te ayuda a entender mejor tu cultivo mañana.”
- Color gris verdoso; ~17–19px desktop; ancho máximo limitado; centrado.
- Espaciado holgado entre título, subtítulo y grilla.

### Fondo
- Base visual de `EscenaSolar` (`#F4F8EE` / `--landing-bg` + rays).
- Sobre la sección: radial rosa suave `#F0B4B4` (baja opacidad) hacia arriba-derecha + toque verdoso leve.
- Sin colores saturados de fondo.

### Grilla de cards
- Desktop / notebook: CSS Grid 2×2, gap ~20–24px, cards de altura similar por fila, radio ~24–28px, fondo `#FFFFFF`, sombra difusa suave, padding generoso.
- Interior desktop: texto izquierda | placeholder ~40–50% derecha.
- Mobile: una columna (01 → 04); stack vertical por card (número → título → descripción → placeholder).
- Cards rectangulares; no forzar las cuatro en un solo viewport.

### Contenido de cada card

| # | Título | Descripción |
|---|--------|-------------|
| 01 | Registrás a diario | Guardás riegos, mediciones, observaciones y fotos. |
| 02 | Resolvés problemas | Cuando algo cambia, tenés historial y contexto para actuar mejor. |
| 03 | Flora conoce a tus plantas | Con tus registros, Flora va entendiendo mejor tu cultivo. |
| 04 | Mejorás tu producción | Más orden y mejores decisiones te ayudan a cultivar con más control. |

- Numeración `01`–`04` en pastilla verde clara, texto verde oscuro, Fredoka Semibold.
- Títulos HTML reales (no dentro de imágenes). Descripciones editables y accesibles.

### Placeholders de ilustración
- Contenedor por card con fondo verde o rosa muy suave, bordes redondeados/orgánicos, ícono SVG discreto, texto auxiliar:
  - “Ilustración 01 — Flora registrando”
  - “Ilustración 02 — Flora investigando”
  - “Ilustración 03 — Flora y tus plantas”
  - “Ilustración 04 — Flora y el progreso”
- Decoración mínima vía CSS/SVG (óvalo suave, 1–2 destellos); sin saturar.
- Sin rutas a archivos inexistentes (evita 404).

### Config de ilustración (centralizada)
Cada card incluye algo equivalente a:

```js
ilustracion: {
  src: null,
  alt: "...",
  aspectRatio: "1 / 1",
  objectFit: "contain",
  placeholder: {
    tono: "verde" | "rosa",
    etiqueta: "Ilustración 0N — …",
    icono: "libreta" | "lupa" | "fichas" | "progreso",
  },
}
```

- `src: null` → placeholder.
- Con `src` → `next/image` con `alt`, `object-fit` y `aspect-ratio` configurables (proporciones pueden diferir entre cards).

## Motion
- Aparición suave (opacidad + ~12px) reutilizando `Revelar` / `data-revelar` o Motion ya presente.
- Hover: leve elevación de card.
- Respetar `prefers-reduced-motion`.
- No: rotaciones fuertes, 3D, parallax, animaciones constantes, nuevas dependencias, GSAP nuevo en esta sección.

## Qué se elimina de la sección actual
- Imagen de Flora con el teléfono (`flora-landing2.png` en esta sección).
- Título “Todo tu cultivo, en un solo lugar.”
- Bajada y tres tilt-cards actuales.
- Carrusel móvil, flip, estilos y keyframes solo usados por esa UI.
- No borrar los PNG del repo.

## Criterios de éxito
1. Composición cercana a la referencia (encabezado + 2×2).
2. Estética ENFLORA (Fredoka, verdes, naranja de marca, fondo claro).
3. Legible en desktop, 1366×768 y mobile ≥320px sin overflow horizontal.
4. Placeholders sólidos y swap simple a imágenes finales.
5. Ancla `#para-que-sirve` y navegación intactas.
6. Sin cambios visuales/funcionales en el resto de la landing.

## Verificación
- Revisar visualmente en dev (`pnpm dev`).
- Ejecutar el check/build disponible del proyecto al cerrar la implementación.
