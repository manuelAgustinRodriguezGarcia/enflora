const SELECT_TAREA = `
  id,
  descripcion,
  fecha_programada,
  hora_programada,
  tipo,
  estado,
  fecha_creacion,
  tarea_plantas (planta_id)
`;

const SELECT_LEGADO = `
  id,
  descripcion,
  fecha_programada,
  fecha_creacion,
  tarea_plantas (planta_id)
`;

function textoError(error) {
  return `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
}

function tablaAusente(error) {
  const texto = textoError(error);
  return /tareas_programadas/i.test(texto) || ["PGRST200", "PGRST205", "42P01"].includes(error?.code);
}

function columnaNuevaAusente(error) {
  return /estado|hora_programada|tipo/i.test(textoError(error));
}

function mapear(fila) {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    fecha_programada: fila.fecha_programada,
    hora_programada: fila.hora_programada || "",
    tipo: fila.tipo || "",
    planta_ids: (fila.tarea_plantas || []).map((item) => item.planta_id).filter(Boolean),
  };
}

export async function cargarTareasPendientesUnidad(supabase, unidadId, { limite = 30 } = {}) {
  const moderna = await supabase
    .from("tareas_programadas")
    .select(SELECT_TAREA)
    .eq("unidad_cultivo_id", unidadId)
    .eq("estado", "pendiente")
    .order("fecha_programada", { ascending: true })
    .order("hora_programada", { ascending: true })
    .order("fecha_creacion", { ascending: true })
    .limit(limite);

  const respuesta =
    moderna.error && columnaNuevaAusente(moderna.error)
      ? await supabase
          .from("tareas_programadas")
          .select(SELECT_LEGADO)
          .eq("unidad_cultivo_id", unidadId)
          .eq("completada", false)
          .order("fecha_programada", { ascending: true })
          .order("fecha_creacion", { ascending: true })
          .limit(limite)
      : moderna;

  if (respuesta.error) return { error: !tablaAusente(respuesta.error), tareas: [] };
  return { error: false, tareas: (respuesta.data || []).map(mapear) };
}
