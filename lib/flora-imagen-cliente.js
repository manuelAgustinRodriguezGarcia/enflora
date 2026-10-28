import {
  FLORA_CHAT_LADO_MAXIMO,
  FLORA_CHAT_MAX_BYTES_IMAGEN,
} from "@/lib/flora-imagen-chat";
import { liberarVista, procesarFoto } from "@/lib/fotos-cliente";

export function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = String(lector.result || "");
      const coma = resultado.indexOf(",");
      resolve(coma >= 0 ? resultado.slice(coma + 1) : resultado);
    };
    lector.onerror = () => reject(new Error("lectura"));
    lector.readAsDataURL(blob);
  });
}

/** Prepara una foto del dispositivo para enviar a Flora (transitoria, sin subir a Storage). */
export async function prepararImagenDispositivoParaFlora(archivo) {
  const resultado = await procesarFoto(archivo, {
    ladoMaximo: FLORA_CHAT_LADO_MAXIMO,
    maxBytes: FLORA_CHAT_MAX_BYTES_IMAGEN,
    generarMiniatura: true,
  });
  if (resultado.error) return { error: resultado.error, adjunto: null };

  try {
    const datosBase64 = await blobABase64(resultado.foto.blob);
    return {
      error: "",
      adjunto: {
        origen: "transitoria",
        mimeType: resultado.foto.tipo_mime,
        datosBase64,
        vista: resultado.foto.vista,
        ancho: resultado.foto.ancho,
        alto: resultado.foto.alto,
        tamano_bytes: resultado.foto.tamano_bytes,
        liberar: () => liberarVista(resultado.foto),
      },
    };
  } catch {
    liberarVista(resultado.foto);
    return { error: "No se pudo preparar la imagen.", adjunto: null };
  }
}

export function liberarAdjuntoFlora(adjunto) {
  adjunto?.liberar?.();
}
