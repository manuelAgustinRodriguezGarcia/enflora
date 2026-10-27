const SELECT_TAREA = `
  id,
  descripcion,
  fecha_programada,
  fecha_creacion,
  tarea_plantas (planta_id)
`;

function tablaAusente(error) {
  const texto = `${error?.message || ""} ${error?.details || ""}`;
  return /tareas_programadas/i.test(texto) || ["PGRST200", "PGRST205", "42P01"].includes(error?.code);
}

export async function cargarTareasPendientesUnidad(supabase, unidadId, { limite = 30 } = {}) {
  const { data, error } = await supabase
    .from("tareas_programadas")
    .select(SELECT_TAREA)
    .eq("unidad_cultivo_id", unidadId)
    .eq("completada", false)
    .order("fecha_programada", { ascending: true })
    .order("fecha_creacion", { ascending: true })
    .limit(limite);

  if (error) return { error: !tablaAusente(error), tareas: [] };

  const tareas = (data || []).map((fila) => ({
    id: fila.id,
    descripcion: fila.descripcion,
    fecha_programada: fila.fecha_programada,
    planta_ids: (fila.tarea_plantas || []).map((item) => item.planta_id).filter(Boolean),
  }));

  return { error: false, tareas };
}
