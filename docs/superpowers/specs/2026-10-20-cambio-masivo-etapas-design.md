# Cambio masivo de etapas — Design

## Objetivo

Permitir seleccionar varias plantas en el detalle de una unidad y asignarles una nueva etapa en una sola operación, conservando el historial individual de cada planta. Cierra el pendiente de Sprint 2 antes de Iteración 4 de registros.

## Decisiones acordadas

| Tema | Decisión |
|---|---|
| Enfoque | RPC batch nueva + UI en detalle de unidad (enfoque 1) |
| Misma etapa ya actual | Omitir esa planta (sin tocar historial ni avisar por planta) |
| Si todas se omiten | Error: ninguna planta necesita cambio (rollback / sin efecto) |
| Atomicidad | Una RPC PL/pgSQL; fallo en cualquiera → rollback total |
| UI modo selección | Barra fija inferior + chips compactos (Unidad / Genética / Limpiar) |
| Acciones masivas | Solo “Cambiar etapa” |
| Etapas | Las 6 oficiales; sin secuencia obligatoria; sin “Floración” |
| RPC unitaria | No se modifica |
| SQL | Archivo incremental; **no ejecutar** sin aprobación explícita |
| Registros | Reusar `agruparPlantasPorGenetica`; no extraer selector compartido en este sprint |

## Arquitectura

```
Detalle unidad (page)
  → ModoSeleccionPlantas (cliente)
       chips Unidad | Genética | Limpiar
       lista con toggle (no Link)
       barra: conteo · Cambiar etapa · Salir
  → Form compacto (SelectorEtapa + SelectorFecha)
  → ModalConfirmacion
  → Server Action cambiarEtapaMasiva
  → rpc cambiar_etapa_plantas(p_planta_ids, p_etapa, p_fecha)
  → historial_etapas + plantas (por cada ID no omitido)
```

### Archivos previstos

| Acción | Archivo |
|---|---|
| Crear | `supabase/etapas-masivo.sql` |
| Crear | `componentes/seleccion-plantas-unidad.js` (modo selección + chips + barra + form/modal de cambio masivo) |
| Modificar | `app/espacios/[id]/unidades/[unidadId]/page.js` |
| Modificar | `app/espacios/[id]/acciones.js` (`cambiarEtapaMasiva`) |
| Modificar | estilos de espacios/controles según haga falta (SCSS existente; sin tema nuevo) |
| Reusar | `lib/registros.js` (`agruparPlantasPorGenetica`, helpers genética) |
| Reusar | `lib/etapas.js`, `SelectorEtapa`, `SelectorFecha`, `ModalConfirmacion`, `Boton` |
| Actualizar | `GUIA_ESTUDIO.md` (local; gitignored) |
| No tocar | `cambiar_etapa_planta`, cards de planta fuera de modo selección, Iteración 4 registros |

## Flujo UI

1. Cabecera del detalle de unidad: acción **Seleccionar plantas**.
2. Al activar el modo:
   - Las cards dejan de ser `Link`; el tap alterna selección.
   - Aparecen chips compactos: **Toda la unidad** / **Por genética** / **Limpiar**.
   - Por genética: pills de grupos vía `agruparPlantasPorGenetica`; elegir un grupo marca esas plantas; desmarcar una pasa a selección manual.
   - Barra inferior (sobre bottom nav): “N plantas seleccionadas”, **Cambiar etapa** (disabled si N=0), **Salir**.
3. **Cambiar etapa**: panel/form compacto con nueva etapa, fecha efectiva, cantidad afectada.
4. Confirmación con `ModalConfirmacion`, p. ej. “Vas a cambiar 3 plantas a Vegetativo desde el 20/10/2026.” → Cancelar | Confirmar.
5. Loading + anti double-submit. Éxito solo tras respuesta OK de Supabase → salir del modo selección y refrescar lista. Error → mensaje + selección intacta.

Identidad: Mobile First, colores/iconos/motion existentes, `focus-visible`, sin rediseñar tarjetas ni Bottom Navigation.

## Datos y RPC

### Existente (referencia; no cambiar)

- Tabla `historial_etapas`: una fila abierta por planta (`fecha_fin is null`).
- RPC `cambiar_etapa_planta(p_planta_id, p_etapa, p_fecha)`: cierra abierta, inserta nueva, actualiza `plantas.etapa` y `estado` (`finalizado` → `finalizada`, else `activa`). **No** omite si la etapa ya es la misma (comportamiento individual distinto al masivo).

### Nueva RPC

```
cambiar_etapa_plantas(
  p_planta_ids uuid[],
  p_etapa text,
  p_fecha date
) returns jsonb
-- ejemplo: {"actualizadas": 3, "omitidas": 2}
```

Reglas:

1. `security invoker`, `search_path = public`, `grant execute` a `authenticated`.
2. Validar etapa ∈ germinacion | plantula | vegetativo | enflora | secado | finalizado.
3. Validar `p_fecha` not null.
4. Deduplicar IDs; rechazar array vacío.
5. Todas las plantas deben existir y pertenecer al usuario autenticado (vía `plantas` → `unidades_cultivo` → `espacios.usuario_id = auth.uid()`). Cualquier ID inválido/ajeno → `raise` (rollback).
6. Por cada ID único:
   - Si `plantas.etapa = p_etapa` → omitir (contar en omitidas).
   - Si no → misma secuencia que la RPC unitaria (fecha no anterior al inicio abierto; cerrar; insertar; update planta/estado).
7. Si `actualizadas = 0` → raise `Ninguna planta necesita cambio.`
8. Un error de fecha/historial en cualquier planta aborta toda la operación.

Duración: solo por fechas; no persistir duración duplicada.

## Server Action

`cambiarEtapaMasiva` en `app/espacios/[id]/acciones.js`:

- Sesión obligatoria.
- Form/payload: `espacio_id`, `unidad_id`, lista de `planta_id`, `etapa`, `fecha_inicio`.
- `validarEtapaInicial`.
- Verificar que todos los IDs pertenecen a esa `unidad_id` (y la unidad al espacio del usuario).
- Llamar `rpc("cambiar_etapa_plantas", …)`.
- Mapear errores a mensajes en español coherentes con `cambiarEtapa`.
- `revalidatePath` del detalle de unidad (y rutas relacionadas si ya lo hace el individual); **no** redirect al detalle de una sola planta.

## Seguridad

- Usuario autenticado.
- Ownership de unidad y de todas las plantas.
- IDs duplicados normalizados en servidor/RPC.
- RLS vigente; sin service role desde el cliente.
- No aplicar cambios a plantas no seleccionadas.

## Documentación

- Spec versionada: este archivo.
- `GUIA_ESTUDIO.md`: sección acumulativa (selección múltiple, genética, cambio masivo, historial, RPC, seguridad, decisiones, ejemplos, preguntas de defensa). No borrar secciones existentes. Nota: el archivo está en `.gitignore`; update local como en specs previos.

## Pruebas (criterios)

Estáticas: `pnpm build`, lint disponible.

Contra Supabase (tras aplicar SQL con OK del usuario): selección 1/N/toda/genética; desmarcar tras “toda”; cambio de 3; historial individual; no seleccionadas intactas; fecha efectiva; omitir misma etapa; Finalizado + corrección posterior; IDs ajenos rechazados; error sin parciales; anti double-submit; mobile.

## Fuera de alcance

- Eliminación / movimiento / edición masiva de campos.
- Refactor de `formulario-crear-registro` a componente compartido.
- Iteración 4 de registros.
- Cambiar el comportamiento del cambio de etapa **individual** respecto a re-guardar la misma etapa.

## Riesgos y limitaciones

- La omisión silenciosa en masivo difiere del individual (que sí reabre la misma etapa). Documentado y deliberado.
- Hasta aplicar `etapas-masivo.sql` en el proyecto Supabase, la UI/action no puede confirmarse end-to-end.
- `GUIA_ESTUDIO.md` no viaja en git; el conocimiento durable queda en este spec + código.
