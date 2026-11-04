// Utilidades de servidor para fotos privadas. Reciben el cliente Supabase del usuario (con RLS).
import { BUCKET_FOTOS } from "@/lib/fotos";

export const SEGUNDOS_URL_MINIATURA = 60 * 60;
export const SEGUNDOS_URL_ORIGINAL = 10 * 60;

/**
 * Arma el mapa ruta -> URL firmada.
 * Alinea por índice con las rutas pedidas: Storage a veces devuelve `path` distinto
 * o solo `signedURL`, y si no coincidía la clave la miniatura quedaba vacía.
 */
export function indexarFirmasStorage(rutas, data) {
  const mapa = new Map();
  const pedidas = Array.isArray(rutas) ? rutas : [];
  const filas = Array.isArray(data) ? data : [];
  for (let i = 0; i < filas.length; i += 1) {
    const fila = filas[i];
    if (!fila || fila.error) continue;
    const url = String(fila.signedUrl || fila.signedURL || "");
    if (!url) continue;
    const pedida = pedidas[i];
    if (pedida) mapa.set(pedida, url);
    if (fila.path) mapa.set(fila.path, url);
  }
  return mapa;
}

// Firma muchas rutas en una sola llamada. Devuelve Map(ruta -> url firmada).
// Las URLs son temporales: nunca se guardan en la base, solo la ruta estable.
export async function firmarRutas(supabase, rutas, segundos = SEGUNDOS_URL_MINIATURA) {
  const unicas = [...new Set((rutas || []).filter(Boolean))];
  if (unicas.length === 0) return new Map();

  const { data, error } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrls(unicas, segundos);
  if (error || !data) return new Map();

  return indexarFirmasStorage(unicas, data);
}

// Agrega url_miniatura a cada foto de cada registro (registro_fotos).
export async function adjuntarMiniaturas(supabase, registros) {
  const rutas = [];
  for (const registro of registros || []) {
    for (const foto of registro?.registro_fotos || []) rutas.push(foto.ruta_miniatura);
  }
  const urls = await firmarRutas(supabase, rutas);

  return (registros || []).map((registro) => ({
    ...registro,
    registro_fotos: [...(registro?.registro_fotos || [])]
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((foto) => ({ ...foto, url_miniatura: urls.get(foto.ruta_miniatura) || "" })),
  }));
}

export async function borrarArchivos(supabase, rutas) {
  const lista = [...new Set((rutas || []).filter(Boolean))];
  if (lista.length === 0) return { error: "" };
  const { error } = await supabase.storage.from(BUCKET_FOTOS).remove(lista);
  return { error: error ? "No se pudieron borrar algunos archivos." : "" };
}

export function rutasDeFotos(fotos) {
  return (fotos || []).flatMap((foto) => [foto.ruta, foto.ruta_miniatura]).filter(Boolean);
}
