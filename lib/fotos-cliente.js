// Procesamiento y subida de fotos en el navegador. Sin dependencias externas.
import {
  BUCKET_FOTOS,
  CALIDAD_FOTO,
  CALIDAD_MINIATURA,
  LADO_MAXIMO,
  LADO_MINIATURA,
  MAX_BYTES_SUBIDA,
  dimensionesEscaladas,
  extensionDeTipo,
  rutaFotoRegistro,
  rutaPortadaUnidad,
  tipoPorFirma,
  validarArchivoFoto,
} from "@/lib/fotos";

const MENSAJE_DECODIFICAR = "No se pudo leer la imagen. Probá con otra foto.";

async function leerFirma(archivo) {
  const buffer = await archivo.slice(0, 16).arrayBuffer();
  return new Uint8Array(buffer);
}

async function abrirImagen(archivo) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(archivo, { imageOrientation: "from-image" });
    } catch {
      // Cae al método con <img> para navegadores sin esta opción.
    }
  }

  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    imagen.decoding = "async";
    imagen.src = url;
    await imagen.decode();
    return imagen;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBlob(canvas, tipo, calidad) {
  return new Promise((resolver) => canvas.toBlob(resolver, tipo, calidad));
}

// Prefiere WEBP; si el navegador no lo codifica (Safari antiguo) usa JPEG. Nunca PNG: pesa mucho.
async function codificar(canvas, calidad) {
  const webp = await canvasBlob(canvas, "image/webp", calidad);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await canvasBlob(canvas, "image/jpeg", calidad);
  return jpeg && jpeg.type === "image/jpeg" ? jpeg : null;
}

async function redimensionar(imagen, ladoMaximo, calidad) {
  const origenAncho = imagen.naturalWidth || imagen.width;
  const origenAlto = imagen.naturalHeight || imagen.height;
  const { ancho, alto } = dimensionesEscaladas(origenAncho, origenAlto, ladoMaximo);
  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const contexto = canvas.getContext("2d");
  if (!contexto) return null;
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(imagen, 0, 0, ancho, alto);
  const blob = await codificar(canvas, calidad);
  canvas.width = 0;
  canvas.height = 0;
  return blob ? { blob, ancho, alto } : null;
}

// Valida, corrige orientación EXIF, reduce y genera miniatura. Al volver a dibujar la imagen
// se descartan los metadatos (incluida la ubicación GPS) y cualquier contenido no gráfico.
export async function procesarFoto(archivo) {
  const validacion = validarArchivoFoto(archivo);
  if (validacion.error) return { error: validacion.error };

  const firma = tipoPorFirma(await leerFirma(archivo));
  if (!firma) return { error: "El archivo no es una imagen JPG, PNG o WEBP válida." };

  let imagen;
  try {
    imagen = await abrirImagen(archivo);
  } catch {
    return { error: MENSAJE_DECODIFICAR };
  }

  try {
    const principal = await redimensionar(imagen, LADO_MAXIMO, CALIDAD_FOTO);
    const miniatura = await redimensionar(imagen, LADO_MINIATURA, CALIDAD_MINIATURA);
    if (!principal || !miniatura) return { error: MENSAJE_DECODIFICAR };
    if (principal.blob.size > MAX_BYTES_SUBIDA) {
      return { error: "La foto sigue siendo demasiado pesada después de optimizarla." };
    }

    return {
      error: "",
      foto: {
        blob: principal.blob,
        miniaturaBlob: miniatura.blob,
        tipo_mime: principal.blob.type,
        tipo_mime_miniatura: miniatura.blob.type,
        ancho: principal.ancho,
        alto: principal.alto,
        tamano_bytes: principal.blob.size,
        vista: URL.createObjectURL(miniatura.blob),
      },
    };
  } finally {
    if (typeof imagen.close === "function") imagen.close();
  }
}

export function liberarVista(foto) {
  if (foto?.vista) URL.revokeObjectURL(foto.vista);
}
