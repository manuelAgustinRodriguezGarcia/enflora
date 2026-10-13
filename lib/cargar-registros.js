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
