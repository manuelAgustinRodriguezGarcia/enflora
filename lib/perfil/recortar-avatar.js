import { dimensionesEscaladas, tipoPorFirma } from "@/lib/fotos";
import {
  CALIDAD_AVATAR,
  LADO_AVATAR,
  MAX_BYTES_AVATAR,
  cajaRotada,
  limitarRecorte,
  validarArchivoAvatar,
} from "@/lib/perfil/avatar";

const LADO_FUENTE = 2048;
const TOPE_CUERPO = 900 * 1024;
const FONDO = "#F9FFEB";
const MENSAJE_LECTURA = "No se pudo leer la imagen. Probá con otra foto.";

function blobDeCanvas(canvas, tipo, calidad) {
  return new Promise((resolver) => canvas.toBlob(resolver, tipo, calidad));
}

async function codificar(canvas, calidad) {
  const webp = await blobDeCanvas(canvas, "image/webp", calidad);
  if (webp && webp.type === "image/webp" && webp.size > 0) return webp;
  const jpeg = await blobDeCanvas(canvas, "image/jpeg", calidad);
  return jpeg && jpeg.type === "image/jpeg" && jpeg.size > 0 ? jpeg : null;
}

async function decodificar(archivo) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(archivo, { imageOrientation: "from-image" });
    } catch {
      // Sigue con <img>, que también respeta la orientación en los navegadores actuales.
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

function cargarImagen(url) {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.decoding = "async";
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error("imagen"));
    imagen.src = url;
  });
}

function liberarCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

/** Valida la firma real, corrige EXIF y deja una imagen liviana para el editor. */
export async function prepararFotoAvatar(archivo) {
  const validacion = validarArchivoAvatar(archivo);
  if (validacion.error) return { error: validacion.error };

  const firma = tipoPorFirma(new Uint8Array(await archivo.slice(0, 16).arrayBuffer()));
  if (!firma) return { error: "El archivo no es una imagen JPG, PNG o WEBP válida." };

  let imagen;
  try {
    imagen = await decodificar(archivo);
  } catch {
    return { error: MENSAJE_LECTURA };
  }

  try {
    const origenAncho = imagen.naturalWidth || imagen.width;
    const origenAlto = imagen.naturalHeight || imagen.height;
    if (!origenAncho || !origenAlto) return { error: MENSAJE_LECTURA };

    const { ancho, alto } = dimensionesEscaladas(origenAncho, origenAlto, LADO_FUENTE);
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const contexto = canvas.getContext("2d");
    if (!contexto) return { error: MENSAJE_LECTURA };
    contexto.fillStyle = FONDO;
    contexto.fillRect(0, 0, ancho, alto);
    contexto.drawImage(imagen, 0, 0, ancho, alto);
    const blob = await blobDeCanvas(canvas, "image/jpeg", 0.92);
    liberarCanvas(canvas);
    if (!blob) return { error: MENSAJE_LECTURA };
    return { error: "", url: URL.createObjectURL(blob) };
  } finally {
    if (typeof imagen.close === "function") imagen.close();
  }
}

/**
 * Exporta un cuadrado. El círculo del editor es solo visual:
 * el archivo queda rectangular para poder reutilizarlo.
 */
export async function exportarRecorteAvatar(url, areaPixeles, rotacion = 0, opciones = {}) {
  if (!url || !areaPixeles) return { error: MENSAJE_LECTURA };

  const lado = opciones.lado || LADO_AVATAR;
  const calidadInicial = opciones.calidad || CALIDAD_AVATAR;
  const tope = Math.min(opciones.tope || TOPE_CUERPO, MAX_BYTES_AVATAR);

  let imagen;
  try {
    imagen = await cargarImagen(url);
  } catch {
    return { error: MENSAJE_LECTURA };
  }

  const rad = ((Number(rotacion) || 0) * Math.PI) / 180;
  const caja = cajaRotada(imagen.width, imagen.height, rotacion);
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(caja.ancho));
  lienzo.height = Math.max(1, Math.round(caja.alto));
  const contexto = lienzo.getContext("2d");
  if (!contexto) return { error: MENSAJE_LECTURA };

  contexto.fillStyle = FONDO;
  contexto.fillRect(0, 0, lienzo.width, lienzo.height);
  contexto.translate(lienzo.width / 2, lienzo.height / 2);
  contexto.rotate(rad);
  contexto.translate(-imagen.width / 2, -imagen.height / 2);
  contexto.drawImage(imagen, 0, 0);

  const recorte = limitarRecorte(areaPixeles, lienzo.width, lienzo.height);
  const salida = document.createElement("canvas");
  salida.width = lado;
  salida.height = lado;
  const destino = salida.getContext("2d");
  if (!destino) {
    liberarCanvas(lienzo);
    return { error: MENSAJE_LECTURA };
  }
  destino.imageSmoothingQuality = "high";
  destino.fillStyle = FONDO;
  destino.fillRect(0, 0, lado, lado);
  destino.drawImage(
    lienzo,
    recorte.x,
    recorte.y,
    recorte.width,
    recorte.height,
    0,
    0,
    lado,
    lado,
  );
  liberarCanvas(lienzo);

  let calidad = calidadInicial;
  let blob = null;
  for (let intento = 0; intento < 5; intento += 1) {
    blob = await codificar(salida, calidad);
    if (!blob) break;
    if (blob.size <= tope) break;
    calidad = Math.max(0.6, calidad - 0.08);
  }
  liberarCanvas(salida);

  if (!blob || blob.size > MAX_BYTES_AVATAR) {
    return { error: "No se pudo optimizar la foto. Probá con otra." };
  }
  return { error: "", blob };
}
