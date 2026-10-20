# Plan — Cambio masivo de etapas

Spec: `2026-10-20-cambio-masivo-etapas-design.md`

1. SQL incremental `supabase/etapas-masivo.sql` (no ejecutar sin OK).
2. Server Action `cambiarEtapaMasiva` en `acciones.js`.
3. Componente `seleccion-plantas-unidad.js` + estilos.
4. Integrar en `unidades/[unidadId]/page.js`.
5. Actualizar `GUIA_ESTUDIO.md` (local).
6. `pnpm build` + informe; SQL pendiente de aplicar en Supabase.
