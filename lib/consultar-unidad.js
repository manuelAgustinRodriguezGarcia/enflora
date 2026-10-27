const SELECT_BASE = "id, nombre, tipo, tipo_personalizado, numero, espacio_id";
const SELECT_CON_PORTADA = `${SELECT_BASE}, portada_ruta, portada_miniatura`;

function falloPorPortada(error) {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return /portada_(ruta|miniatura)/i.test(texto) || error?.code === "42703";
}

function normalizar(unidad) {
  if (!unidad) return unidad;
  return {
    ...unidad,
    portada_ruta: unidad.portada_ruta ?? null,
    portada_miniatura: unidad.portada_miniatura ?? null,
  };
}

// Lee una unidad del usuario. Si las columnas de portada aún no existen, reintenta sin ellas.
export async function consultarUnidad(supabase, { unidadId, espacioId }) {
  let consulta = supabase.from("unidades_cultivo").select(SELECT_CON_PORTADA).eq("id", unidadId);
  if (espacioId) consulta = consulta.eq("espacio_id", espacioId);

  const primera = await consulta.maybeSingle();
  if (!primera.error) return { error: false, unidad: normalizar(primera.data) };
  if (!falloPorPortada(primera.error)) return { error: true, unidad: null };

  let basica = supabase.from("unidades_cultivo").select(SELECT_BASE).eq("id", unidadId);
  if (espacioId) basica = basica.eq("espacio_id", espacioId);
  const segunda = await basica.maybeSingle();
  if (segunda.error) return { error: true, unidad: null };
  return { error: false, unidad: normalizar(segunda.data) };
}

// Lista unidades de un espacio con portada cuando el esquema lo permite.
export async function listarUnidadesConPortada(supabase, espacioId) {
  const primera = await supabase
    .from("unidades_cultivo")
    .select(SELECT_CON_PORTADA)
    .eq("espacio_id", espacioId)
    .order("numero", { ascending: true });

  if (!primera.error) {
    return { error: false, unidades: (primera.data || []).map(normalizar) };
  }
  if (!falloPorPortada(primera.error)) return { error: true, unidades: [] };

  const segunda = await supabase
    .from("unidades_cultivo")
    .select(SELECT_BASE)
    .eq("espacio_id", espacioId)
    .order("numero", { ascending: true });

  if (segunda.error) return { error: true, unidades: [] };
  return { error: false, unidades: (segunda.data || []).map(normalizar) };
}
