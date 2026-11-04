import "server-only";

import { fechaHoy } from "@/lib/etapas";
import { arbolCultivo, fechaMasDias, horaCorta, mesValido, normalizarConsulta, rangoMes } from "@/lib/calendario/modelo";

const SELECT_TAREA = `
  id,
  espacio_id,
  unidad_cultivo_id,
  tipo,
  descripcion,
  fecha_programada,
  hora_programada,
  estado,
  aviso_push,
  aviso_enviado_en,
  tarea_plantas (planta_id)
`;

function detalleError(error) {
  return `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
}

function noDisponible(error) {
  const texto = detalleError(error);
  if (/tareas_programadas/i.test(texto) && /estado|hora_programada|espacio_id|tipo/i.test(texto)) return true;
  return ["PGRST200", "PGRST204", "PGRST205", "42P01", "42703"].includes(error?.code);
}

function mapearTarea(fila) {
  return {
    id: fila.id,
    espacioId: fila.espacio_id,
    unidadId: fila.unidad_cultivo_id,
    tipo: fila.tipo || "personalizada",
    descripcion: String(fila.descripcion || "").trim(),
    fecha: String(fila.fecha_programada || "").slice(0, 10),
    hora: horaCorta(fila.hora_programada),
    estado: fila.estado || "pendiente",
    avisoPush: fila.aviso_push !== false,
    avisoEnviadoEn: fila.aviso_enviado_en || null,
    plantaIds: (fila.tarea_plantas || []).map((item) => item.planta_id).filter(Boolean),
  };
}

function ordenar(consulta) {
  return consulta.order("fecha_programada", { ascending: true }).order("hora_programada", { ascending: true });
}

export async function cargarCalendario(supabase, usuarioId, params, hoy = fechaHoy()) {
  let filtros = normalizarConsulta(params, hoy);
  const vacio = {
    disponible: true,
    error: false,
    filtros,
    espacios: [],
    tareasMes: [],
    tareasDia: [],
    proximas: [],
    enfocada: null,
  };

  const enfocadaId = filtros.editar || filtros.tarea;
  if (enfocadaId && !params?.mes) {
    const { data, error } = await supabase
      .from("tareas_programadas")
      .select("fecha_programada")
      .eq("usuario_id", usuarioId)
      .eq("id", enfocadaId)
      .maybeSingle();
    if (error && noDisponible(error)) return { ...vacio, disponible: false };
    const mesTarea = String(data?.fecha_programada || "").slice(0, 7);
    if (mesValido(mesTarea)) filtros = { ...filtros, mes: mesTarea };
  }

  const { desde, hasta } = rangoMes(filtros.mes);
  let consultaMes = supabase
    .from("tareas_programadas")
    .select(SELECT_TAREA)
    .eq("usuario_id", usuarioId)
    .gte("fecha_programada", desde)
    .lte("fecha_programada", hasta);
  if (filtros.unidad) consultaMes = consultaMes.eq("unidad_cultivo_id", filtros.unidad);
  if (filtros.estado !== "todas") consultaMes = consultaMes.eq("estado", filtros.estado);

  let consultaProximas = supabase
    .from("tareas_programadas")
    .select(SELECT_TAREA)
    .eq("usuario_id", usuarioId)
    .eq("estado", "pendiente")
    .gte("fecha_programada", fechaMasDias(filtros.hoy || hoy, -14));
  if (filtros.unidad) consultaProximas = consultaProximas.eq("unidad_cultivo_id", filtros.unidad);

  let consultaDia = Promise.resolve({ data: [], error: null });
  if (filtros.fecha) {
    let dia = supabase
      .from("tareas_programadas")
      .select(SELECT_TAREA)
      .eq("usuario_id", usuarioId)
      .eq("fecha_programada", filtros.fecha);
    if (filtros.unidad) dia = dia.eq("unidad_cultivo_id", filtros.unidad);
    if (filtros.estado !== "todas") dia = dia.eq("estado", filtros.estado);
    consultaDia = dia.order("hora_programada", { ascending: true }).limit(100);
  }

  const [espaciosRes, unidadesRes, plantasRes, mesRes, proximasRes, diaRes] = await Promise.all([
    supabase.from("espacios").select("id, nombre").order("nombre"),
    supabase.from("unidades_cultivo").select("id, espacio_id, nombre, numero").order("numero"),
    supabase.from("plantas").select("id, nombre, unidad_cultivo_id, estado").eq("estado", "activa").order("numero"),
    ordenar(consultaMes).limit(500),
    ordenar(consultaProximas).limit(20),
    consultaDia,
  ]);

  const errorTareas = mesRes.error || proximasRes.error || diaRes.error;
  if (errorTareas && noDisponible(errorTareas)) return { ...vacio, filtros, disponible: false };
  if (espaciosRes.error || unidadesRes.error || plantasRes.error || errorTareas) {
    return { ...vacio, filtros, error: true };
  }

  const tareasMes = (mesRes.data || []).map(mapearTarea);
  const proximas = (proximasRes.data || []).map(mapearTarea);
  const tareasDia = (diaRes.data || []).map(mapearTarea);
  let enfocada = [...tareasMes, ...proximas, ...tareasDia].find((tarea) => tarea.id === enfocadaId) || null;
  if (enfocadaId && !enfocada) {
    const { data } = await supabase
      .from("tareas_programadas")
      .select(SELECT_TAREA)
      .eq("usuario_id", usuarioId)
      .eq("id", enfocadaId)
      .maybeSingle();
    if (data) enfocada = mapearTarea(data);
  }

  return {
    disponible: true,
    error: false,
    filtros,
    espacios: arbolCultivo(espaciosRes.data, unidadesRes.data, plantasRes.data),
    tareasMes,
    tareasDia,
    proximas,
    enfocada,
  };
}
