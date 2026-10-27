import {
  citaFiltro,
  fusionarPaginaHistorial,
  limitesFechaHistorial,
  patronExacto,
  ramasDeContenido,
  ramasDeGenetica,
  TAMANO_PAGINA_HISTORIAL,
} from "@/lib/historial-registros";

const SELECT_REGISTRO = `
  id,
  usuario_id,
  alcance,
  aplica_a,
  espacio_id,
  unidad_cultivo_id,
  genetica_clave,
  genetica_etiqueta,
  observacion,
  fecha_evento,
  fecha_creacion,
  fecha_actualizacion,
  registro_plantas (
    id,
    planta_id,
    nombre_planta,
    numero_planta,
    genetica_planta,
    unidad_cultivo_id,
    nombre_unidad
  ),
  registro_acciones (
    id,
    origen,
    clave_nativa,
    opcion_id,
    nombre
  ),
  registro_parametros (
    id,
    origen,
    clave_nativa,
    opcion_id,
    nombre,
    tipo_valor,
    valor_numero,
    valor_texto,
    unidad
  )
`;

function ordenarPorEvento(filas) {
  return [...(filas || [])].sort(
    (a, b) => new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime()
  );
}

export async function cargarRegistroPorId(supabase, registroId) {
  const { data, error } = await supabase
    .from("registros")
    .select(SELECT_REGISTRO)
    .eq("id", registroId)
    .maybeSingle();

  if (error) return { error: true, registro: null };
  return { error: false, registro: data };
}

export async function cargarRegistrosUsuario(supabase, { desde, hasta, limite = 100 } = {}) {
  let consulta = supabase
    .from("registros")
    .select(SELECT_REGISTRO)
    .order("fecha_evento", { ascending: false })
    .limit(limite);

  if (desde) consulta = consulta.gte("fecha_evento", desde);
  if (hasta) consulta = consulta.lte("fecha_evento", hasta);

  const { data, error } = await consulta;
  if (error) return { error: true, registros: [] };
  return { error: false, registros: data || [] };
}

export async function cargarRegistrosDeUnidad(supabase, unidadId, { limite = 100 } = {}) {
  const { data, error } = await supabase
    .from("registros")
    .select(SELECT_REGISTRO)
    .eq("unidad_cultivo_id", unidadId)
    .order("fecha_evento", { ascending: false })
    .limit(limite);

  if (error) return { error: true, registros: [] };
  return { error: false, registros: data || [] };
}

export async function cargarRegistrosDePlanta(supabase, plantaId, { limite = 100 } = {}) {
  const { data: enlaces, error: errorEnlaces } = await supabase
    .from("registro_plantas")
    .select("registro_id")
    .eq("planta_id", plantaId)
    .limit(limite);

  if (errorEnlaces) return { error: true, registros: [] };

  const ids = [...new Set((enlaces || []).map((fila) => fila.registro_id).filter(Boolean))];
  if (ids.length === 0) return { error: false, registros: [] };

  const { data, error } = await supabase
    .from("registros")
    .select(SELECT_REGISTRO)
    .in("id", ids)
    .order("fecha_evento", { ascending: false });

  if (error) return { error: true, registros: [] };
  return { error: false, registros: ordenarPorEvento(data || []) };
}

export async function cargarRegistrosDeGenetica(supabase, genetica, { limite = 100 } = {}) {
  const clave = String(genetica || "").trim().toLowerCase();
  if (!clave) return { error: false, registros: [] };

  const { data, error } = await supabase
    .from("registros")
    .select(SELECT_REGISTRO)
    .eq("genetica_clave", clave)
    .order("fecha_evento", { ascending: false })
    .limit(limite);

  if (error) return { error: true, registros: [] };
  return { error: false, registros: data || [] };
}

function aplicarCursor(consulta, cursor) {
  if (!cursor?.fecha || !cursor?.id) return consulta;
  const fecha = citaFiltro(cursor.fecha);
  const id = citaFiltro(cursor.id);
  return consulta.or(
    `fecha_evento.lt.${fecha},and(fecha_evento.eq.${fecha},id.lt.${id})`
  );
}

function selectDeRama({ plantaId, genetica, varianteGenetica, contenido }) {
  const partes = ["id", "fecha_evento"];
  if (plantaId) partes.push("filtro_planta:registro_plantas!inner(planta_id)");
  if (genetica && varianteGenetica === "snapshot") {
    partes.push("filtro_genetica:registro_plantas!inner(genetica_planta)");
  }
  if (contenido === "acciones") partes.push("filtro_acciones:registro_acciones!inner(id)");
  if (contenido === "parametros") partes.push("filtro_parametros:registro_parametros!inner(id)");
  return partes.join(", ");
}

function necesitaHidratacion(select) {
  return select.includes("!inner");
}

async function leerRama(supabase, filtros, contenido, varianteGenetica) {
  const limites = limitesFechaHistorial(filtros.desde, filtros.hasta);
  if (!limites) return { error: true, filas: [], hayMas: false };

  const select = selectDeRama({
    plantaId: filtros.plantaId,
    genetica: filtros.genetica,
    varianteGenetica,
    contenido,
  });
  const pedido = TAMANO_PAGINA_HISTORIAL + 1;
  const hidratar = necesitaHidratacion(select);
  let consulta = supabase.from("registros").select(hidratar ? select : SELECT_REGISTRO);

  if (filtros.unidadId) consulta = consulta.eq("unidad_cultivo_id", filtros.unidadId);
  if (filtros.plantaId) consulta = consulta.eq("filtro_planta.planta_id", filtros.plantaId);
  if (filtros.genetica && varianteGenetica === "clave") {
    consulta = consulta.eq("genetica_clave", filtros.genetica);
  }
  if (filtros.genetica && varianteGenetica === "snapshot") {
    consulta = consulta.ilike("filtro_genetica.genetica_planta", patronExacto(filtros.genetica));
  }
  if (limites.desde) consulta = consulta.gte("fecha_evento", limites.desde);
  if (limites.hasta) consulta = consulta.lte("fecha_evento", limites.hasta);
  if (contenido === "observaciones") consulta = consulta.not("observacion", "is", null);
  consulta = aplicarCursor(consulta, filtros.cursor);
  consulta = consulta
    .order("fecha_evento", { ascending: false })
    .order("id", { ascending: false })
    .limit(pedido);

  const { data, error } = await consulta;
  if (error) return { error: true, filas: [], hayMas: false, hidratar };

  const vistos = new Set();
  const unicos = [];
  for (const fila of data || []) {
    if (!fila?.id || vistos.has(fila.id)) continue;
    vistos.add(fila.id);
    unicos.push(fila);
  }

  const bufferLleno = (data || []).length >= pedido;
  return {
    error: false,
    filas: unicos.slice(0, pedido),
    hayMas: unicos.length > TAMANO_PAGINA_HISTORIAL || (bufferLleno && unicos.length <= TAMANO_PAGINA_HISTORIAL),
    hidratar,
  };
}

async function hidratarRegistros(supabase, filas) {
  const ids = filas.map((fila) => fila.id).filter(Boolean);
  if (ids.length === 0) return { error: false, registros: [] };

  const { data, error } = await supabase.from("registros").select(SELECT_REGISTRO).in("id", ids);
  if (error) return { error: true, registros: [] };

  const mapa = new Map((data || []).map((fila) => [fila.id, fila]));
  return {
    error: false,
    registros: ids.map((id) => mapa.get(id)).filter(Boolean),
  };
}

export async function afirmarFiltrosHistorial(supabase, filtros) {
  if (filtros.unidadId) {
    const { data, error } = await supabase
      .from("unidades_cultivo")
      .select("id")
      .eq("id", filtros.unidadId)
      .maybeSingle();
    if (error) return { error: "No se pudieron validar los filtros." };
    if (!data) return { error: "No se encontró la unidad." };
  }

  if (filtros.plantaId) {
    const { data, error } = await supabase
      .from("plantas")
      .select("id, nombre, unidad_cultivo_id")
      .eq("id", filtros.plantaId)
      .maybeSingle();
    if (error) return { error: "No se pudieron validar los filtros." };
    if (!data) return { error: "No se encontró la planta." };
    if (filtros.unidadId && data.unidad_cultivo_id !== filtros.unidadId) {
      return { error: "La planta no pertenece a esa unidad." };
    }
    return { error: "", planta: data };
  }

  return { error: "", planta: null };
}

export async function cargarHistorialRegistros(supabase, filtros) {
  if (filtros?.sinContenido) {
    return { error: false, registros: [], hayMas: false };
  }

  const contenidos = ramasDeContenido(filtros.contenidos);
  const geneticas = ramasDeGenetica(filtros.genetica);
  const ramas = [];

  for (const contenido of contenidos) {
    for (const variante of geneticas) {
      const rama = await leerRama(supabase, filtros, contenido, variante);
      if (rama.error) return { error: true, registros: [], hayMas: false };
      ramas.push(rama);
    }
  }

  const fusion = fusionarPaginaHistorial(ramas, TAMANO_PAGINA_HISTORIAL);
  if (!ramas.some((rama) => rama.hidratar)) {
    return { error: false, registros: fusion.registros, hayMas: fusion.hayMas };
  }

  const completos = await hidratarRegistros(supabase, fusion.registros);
  if (completos.error) return { error: true, registros: [], hayMas: false };
  return { error: false, registros: completos.registros, hayMas: fusion.hayMas };
}
