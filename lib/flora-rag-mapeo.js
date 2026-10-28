import { LIMITES_FLORA } from "@/lib/flora-contrato";

function recortarFragmento(texto, limite = LIMITES_FLORA.maxCaracteresFragmento) {
  const limpio = String(texto || "").trim();
  if (limpio.length <= limite) return limpio;
  return `${limpio.slice(0, limite - 1)}…`;
}

/**
 * Mapea filas de flora_rag_buscar_hibrido (o respuesta Edge) al contrato de buscarEnGuiaCultivo.
 */
export function mapearFilasRagAFragmentosGuia(filas, { palabrasClaveDoc = [] } = {}) {
  const lista = Array.isArray(filas) ? filas : [];
  return lista.map((fila) => {
    const palabrasFragmento = Array.isArray(fila.palabras_clave) ? fila.palabras_clave : [];
    const publicado = fila.publicado_en
      ? String(fila.publicado_en).slice(0, 10)
      : null;
    const incorporado = fila.incorporado_en ? String(fila.incorporado_en).slice(0, 10) : null;

    return {
      documentoId: String(fila.documento_slug || ""),
      seccionId: String(fila.seccion_id || ""),
      titulo: String(fila.titulo_documento || ""),
      tema: fila.tema || null,
      subtema: fila.subtema || null,
      seccionTitulo: fila.seccion_titulo || null,
      fragmento: recortarFragmento(fila.contenido),
      palabrasClave: [...new Set([...palabrasClaveDoc, ...palabrasFragmento])],
      referencias: Array.isArray(fila.referencias) ? fila.referencias : [],
      bibliografia: {
        fuenteOriginal: fila.fuente_titulo || fila.fuente_procedencia || null,
        autor: fila.fuente_autor || null,
        urlOriginal: fila.fuente_url || null,
        publicado,
        incorporado,
        estado: "publicado",
        version: fila.version_documento || null,
        fuenteCodigo: fila.fuente_codigo || null,
        condicionesUso: fila.condiciones_uso || null,
      },
      puntaje: Number(fila.puntaje) || 0,
    };
  });
}
