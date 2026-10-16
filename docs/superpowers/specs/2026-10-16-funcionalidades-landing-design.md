# Funcionalidades de ENFLORA — Design

## Decisiones
- Transformar `#producto` (mismo id). No tocar ConEnflora ni SeccionRegalo.
- Mock UI HTML/CSS estático al estilo ENFLORA para las 9 previews.
- MagicBento (React Bits JS+CSS) solo para las 3 cards de beneficios.
- Íconos: Lucide en menú y beneficios.
- Motion + AnimatePresence para cambio de categoría.
- Datos centralizados en `lib/funcionalidades-landing.js`.

## Arquitectura
- `producto.js` → monta `SeccionFuncionalidades` (client).
- `MenuFuncionalidades` · `PanelFuncionalidad` · `VistaPreviaFuncionalidad` · `BeneficiosFuncionalidad`.
- `magic-bento.js` + `magic-bento.css` adaptados; items custom sin visuals SaaS.
- Estilos en `_landing.scss` bajo `.producto`.

## Disponibilidad (auditoría app)
- Disponible: espacios, plantas, registros, personalización.
- Próximamente: galería, historial/resultados (visión completa), esquejes, ADN, calendario.

## Motion
- Panel: opacity 0→1, y 12→0, 250–350ms.
- MagicBento: intro staggered; key por funcionalidad activa.
- Respetar prefers-reduced-motion.
