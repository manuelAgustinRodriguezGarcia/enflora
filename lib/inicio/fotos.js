import "server-only";

import { compararFotosGaleria } from "@/lib/flora-galeria-fotos";
import { SEGUNDOS_URL_MINIATURA, firmarRutas } from "@/lib/fotos-servidor";
import { mapearFilaGaleria, textoFechaGaleria } from "@/lib/galeria-flora";

export const LIMITE_FOTOS_INICIO = 3;

const SELECT_FOTOS_INICIO = `
  id,
  fecha_evento,
  unidad:unidades_cultivo ( id, nombre ),
  fotos:registro_fotos!inner ( id, ruta_miniatura )
`;

function fotosDeRegistro(registro) {
  if (Array.isArray(registro?.fotos)) return registro.fotos;
  return registro?.fotos ? [registro.fotos] : [];
}

export function filasFotosInicio(registros) {
  const filas = [];
  for (const registro of registros || []) {
    for (const foto of fotosDeRegistro(registro)) {
      if (!foto?.id) continue;
      filas.push({
        id: foto.id,
        ruta_miniatura: foto.ruta_miniatura || "",
        registro: {
          id: registro.id,
          fecha_evento: registro.fecha_evento,
          unidad: registro.unidad,
        },
      });
    }
  }
  return filas;
}

export function presentarFotosInicio(filas, urls = new Map()) {
  const mapa = urls instanceof Map ? urls : new Map();
  const fotos = (filas || [])
    .map(mapearFilaGaleria)
    .filter((foto) => foto.id)
    .sort(compararFotosGaleria)
    .slice(0, LIMITE_FOTOS_INICIO);

  return fotos.map((foto) => {
    const unidad = String(foto.unidad_nombre || "").trim();
    const fecha = textoFechaGaleria(foto.fecha_evento);
    const etiqueta = [unidad, fecha].filter(Boolean).join(", ");
    return {
      id: foto.id,
      url: mapa.get(foto.ruta_miniatura) || "",
      unidad,
      fecha,
      etiqueta: etiqueta || "Foto de la galería",
    };
  });
}

export async function cargarFotosInicio(supabase, usuarioId) {
  if (!usuarioId) return [];

  const { data, error } = await supabase
    .from("registros")
    .select(SELECT_FOTOS_INICIO)
    .eq("usuario_id", usuarioId)
    .order("fecha_evento", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMITE_FOTOS_INICIO);

  if (error) return [];

  const filas = filasFotosInicio(data);
  const urls = await firmarRutas(
    supabase,
    filas.map((fila) => fila?.ruta_miniatura),
    SEGUNDOS_URL_MINIATURA,
  );
  return presentarFotosInicio(filas, urls);
}
