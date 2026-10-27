import { firmarRutas } from "@/lib/fotos-servidor";

const LIMITE_REGISTROS_GALERIA = 24;

const CAMPOS_FOTO = "registro_fotos!inner (id, ruta, ruta_miniatura, ancho, alto, orden)";

function aplanar(registros) {
  const fotos = [];
  for (const registro of registros || []) {
    const compartida = (registro.plantas_afectadas?.length || 0) > 1;
    const ordenadas = [...(registro.registro_fotos || [])].sort(
      (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
    );
    for (const foto of ordenadas) {
      fotos.push({
        id: foto.id,
        ruta: foto.ruta,
        ruta_miniatura: foto.ruta_miniatura,
        ancho: foto.ancho,
        alto: foto.alto,
        registro_id: registro.id,
        fecha_evento: registro.fecha_evento,
        aplica_a: registro.aplica_a,
        compartida,
        cantidad_plantas: registro.plantas_afectadas?.length || 0,
      });
    }
  }
  return fotos;
}

async function conMiniaturas(supabase, registros) {
  const fotos = aplanar(registros);
  const urls = await firmarRutas(
    supabase,
    fotos.map((foto) => foto.ruta_miniatura)
  );
  return fotos.map((foto) => ({ ...foto, url_miniatura: urls.get(foto.ruta_miniatura) || "" }));
}

// Si el SQL de fotos todavía no se aplicó, no se rompe la ficha: la galería queda vacía.
function tablaAusente(error) {
  const texto = `${error?.message || ""} ${error?.details || ""}`;
  return /registro_fotos/i.test(texto) || ["PGRST200", "PGRST205", "42P01"].includes(error?.code);
}

// Fotos de los registros hechos en una unidad (incluye registros de Ambiente).
export async function cargarFotosDeUnidad(supabase, unidadId, { limite = LIMITE_REGISTROS_GALERIA } = {}) {
  const { data, error } = await supabase
    .from("registros")
    .select(`id, fecha_evento, aplica_a, plantas_afectadas:registro_plantas (id), ${CAMPOS_FOTO}`)
    .eq("unidad_cultivo_id", unidadId)
    .order("fecha_evento", { ascending: false })
    .limit(limite);

  if (error) return { error: !tablaAusente(error), fotos: [] };
  return { error: false, fotos: await conMiniaturas(supabase, data) };
}

// Fotos de los registros que afectaron a una planta. Las fotos pertenecen al registro:
// si el registro tocó varias plantas, la foto se marca como compartida.
export async function cargarFotosDePlanta(supabase, plantaId, { limite = LIMITE_REGISTROS_GALERIA } = {}) {
  const { data, error } = await supabase
    .from("registros")
    .select(
      `id, fecha_evento, aplica_a, filtro_planta:registro_plantas!inner (planta_id), plantas_afectadas:registro_plantas (id), ${CAMPOS_FOTO}`
    )
    .eq("filtro_planta.planta_id", plantaId)
    .order("fecha_evento", { ascending: false })
    .limit(limite);

  if (error) return { error: !tablaAusente(error), fotos: [] };
  return { error: false, fotos: await conMiniaturas(supabase, data) };
}

// Firma las portadas de una lista de unidades. Devuelve Map(unidadId -> { miniatura, portada }).
export async function firmarPortadas(supabase, unidades, { conOriginal = false } = {}) {
  const rutas = [];
  for (const unidad of unidades || []) {
    if (unidad?.portada_miniatura) rutas.push(unidad.portada_miniatura);
    if (conOriginal && unidad?.portada_ruta) rutas.push(unidad.portada_ruta);
  }
  const urls = await firmarRutas(supabase, rutas);
  const mapa = new Map();
  for (const unidad of unidades || []) {
    mapa.set(unidad.id, {
      miniatura: urls.get(unidad.portada_miniatura) || "",
      portada: conOriginal ? urls.get(unidad.portada_ruta) || "" : "",
    });
  }
  return mapa;
}
