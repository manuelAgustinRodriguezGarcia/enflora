import "server-only";

import {
  leerContextosGaleria,
  leerPaginaGaleria,
  leerRutaMiniaturaGaleria,
  publicarFotosGaleria,
} from "@/lib/galeria-flora";
import { SEGUNDOS_URL_MINIATURA, firmarRutas } from "@/lib/fotos-servidor";

export async function listarContextosGaleria(supabase) {
  return leerContextosGaleria(supabase);
}

export async function listarPaginaGaleria(supabase, usuarioId, entrada) {
  const pagina = await leerPaginaGaleria(supabase, usuarioId, entrada);
  if (!pagina.ok) {
    return {
      ok: false,
      error: pagina.error,
      fotos: [],
      hay_mas: false,
      cursor: null,
      total: null,
      unidad_invalida: false,
      sin_coincidencias: false,
    };
  }

  const urls = await firmarRutas(
    supabase,
    pagina.fotos.map((foto) => foto.ruta_miniatura),
    SEGUNDOS_URL_MINIATURA,
  );

  return {
    ok: true,
    fotos: publicarFotosGaleria(pagina.fotos, urls),
    hay_mas: pagina.hay_mas,
    cursor: pagina.cursor,
    total: pagina.total,
    unidad_invalida: Boolean(pagina.unidad_invalida),
    sin_coincidencias: Boolean(pagina.sin_coincidencias),
  };
}

export async function firmarMiniaturaGaleria(supabase, usuarioId, fotoId) {
  const leida = await leerRutaMiniaturaGaleria(supabase, usuarioId, fotoId);
  if (!leida.ok) return { ok: false, error: leida.error, url: "" };

  const urls = await firmarRutas(supabase, [leida.ruta], SEGUNDOS_URL_MINIATURA);
  const url = urls.get(leida.ruta) || "";
  return url
    ? { ok: true, url }
    : { ok: false, error: "No se pudo cargar la foto.", url: "" };
}
