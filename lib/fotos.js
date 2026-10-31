// Reglas compartidas de fotografías (cliente y servidor). Sin dependencias del navegador.

export const BUCKET_FOTOS = "enflora-fotos";

export const MAX_FOTOS_POR_REGISTRO = 3;
// Foto original que se acepta leer del dispositivo (se reduce antes de subir).
export const MAX_BYTES_ORIGINAL = 25 * 1024 * 1024;
// Máximo que admite el bucket y la tabla por archivo ya procesado.
export const MAX_BYTES_SUBIDA = 5 * 1024 * 1024;
export const LADO_MAXIMO = 1600;
export const LADO_MINIATURA = 480;
export const CALIDAD_FOTO = 0.82;
export const CALIDAD_MINIATURA = 0.74;
export const MAX_DESCRIPCION_FOTO = 200;

export const TIPOS_FOTO_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
export const ACEPTAR_FOTOS = TIPOS_FOTO_PERMITIDOS.join(",");

export const MENSAJE_HEIC =
  "Las fotos HEIC no se pueden usar todavía. En el iPhone, elegí \"Más compatible\" en Ajustes > Cámara > Formatos, o sacá la foto desde el selector del navegador.";

const EXTENSIONES = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuidFoto(valor) {
  return UUID.test(String(valor || ""));
}

export function extensionDeTipo(tipo) {
  return EXTENSIONES[tipo] || "";
}

function esHeic(archivo) {
  const tipo = String(archivo?.type || "").toLowerCase();
  const nombre = String(archivo?.name || "").toLowerCase();
  return (
    tipo === "image/heic" ||
    tipo === "image/heif" ||
    nombre.endsWith(".heic") ||
    nombre.endsWith(".heif")
  );
}

// Valida tipo declarado y tamaño antes de procesar. La firma real se comprueba con tipoPorFirma.
export function validarArchivoFoto(archivo) {
  if (!archivo || typeof archivo.size !== "number") {
    return { error: "No se pudo leer el archivo." };
  }
  if (esHeic(archivo)) return { error: MENSAJE_HEIC };
  if (!TIPOS_FOTO_PERMITIDOS.includes(String(archivo.type || "").toLowerCase())) {
    return { error: "Solo se aceptan fotos JPG, PNG o WEBP." };
  }
  if (archivo.size < 1) return { error: "El archivo está vacío." };
  if (archivo.size > MAX_BYTES_ORIGINAL) {
    return { error: "La foto es demasiado pesada (máximo 25 MB)." };
  }
  return { error: "" };
}

// Detecta el formato real por los primeros bytes. Evita SVG u otros contenidos con tipo falso.
export function tipoPorFirma(bytes) {
  if (!bytes || bytes.length < 12) return "";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return "";
}

// Escala manteniendo la proporción, sin agrandar nunca.
export function dimensionesEscaladas(ancho, alto, ladoMaximo) {
  const w = Math.max(1, Math.round(Number(ancho) || 0));
  const h = Math.max(1, Math.round(Number(alto) || 0));
  const mayor = Math.max(w, h);
  if (mayor <= ladoMaximo) return { ancho: w, alto: h };
  const factor = ladoMaximo / mayor;
  return {
    ancho: Math.max(1, Math.round(w * factor)),
    alto: Math.max(1, Math.round(h * factor)),
  };
}

export function rutaFotoRegistro(usuarioId, fotoId, extension, miniatura = false) {
  return `${usuarioId}/registros/${fotoId}${miniatura ? "_m" : ""}.${extension}`;
}

export function rutaPortadaUnidad(usuarioId, unidadId, archivoId, extension, miniatura = false) {
  return `${usuarioId}/portadas/${unidadId}/${archivoId}${miniatura ? "_m" : ""}.${extension}`;
}

/** Foto enviada en un chat de Flora. Vive en el bucket privado, bajo la carpeta del usuario. */
export function rutaFotoFloraChat(usuarioId, archivoId, extension) {
  return `${usuarioId}/flora/${archivoId}.${extension}`;
}

export function rutaPerteneceAUsuario(ruta, usuarioId) {
  const texto = String(ruta || "");
  return (
    esUuidFoto(usuarioId) &&
    texto.startsWith(`${usuarioId}/`) &&
    !texto.includes("..") &&
    !texto.includes("//")
  );
}

const PATRON_RUTA_FOTO = /^[0-9a-f-]{36}\/registros\/[0-9a-f-]{36}(_m)?\.(webp|jpg|png)$/i;
const PATRON_RUTA_PORTADA = /^[0-9a-f-]{36}\/portadas\/[0-9a-f-]{36}\/[0-9a-f-]{36}(_m)?\.(webp|jpg|png)$/i;
const PATRON_RUTA_FLORA = /^[0-9a-f-]{36}\/flora\/[0-9a-f-]{36}\.(webp|jpg|png)$/i;

export function rutaFotoFloraChatValida(ruta) {
  return PATRON_RUTA_FLORA.test(String(ruta || ""));
}

export function rutaFotoValida(ruta) {
  const texto = String(ruta || "");
  return PATRON_RUTA_FOTO.test(texto) || PATRON_RUTA_PORTADA.test(texto) || PATRON_RUTA_FLORA.test(texto);
}

// Valida y normaliza las fotos NUEVAS que llegan desde el cliente (ya subidas a Storage).
export function normalizarFotosNuevas(fotos) {
  if (fotos === undefined || fotos === null) return { fotos: [] };
  if (!Array.isArray(fotos)) return { error: "Las fotos del registro no son válidas." };
  if (fotos.length > MAX_FOTOS_POR_REGISTRO) {
    return { error: `Un registro admite hasta ${MAX_FOTOS_POR_REGISTRO} fotos.` };
  }

  const lista = [];
  const ids = new Set();

  for (const item of fotos) {
    const id = String(item?.id || "").trim();
    const ruta = String(item?.ruta || "").trim();
    const miniatura = String(item?.ruta_miniatura || "").trim();
    const tipo = String(item?.tipo_mime || "").trim();
    const tamano = Number(item?.tamano_bytes);

    if (!esUuidFoto(id) || ids.has(id)) {
      return { error: "Hay una foto con identificador inválido." };
    }
    ids.add(id);

    if (!rutaFotoValida(ruta) || !rutaFotoValida(miniatura)) {
      return { error: "La ruta de una foto no es válida." };
    }
    if (!TIPOS_FOTO_PERMITIDOS.includes(tipo)) {
      return { error: "Hay una foto con un formato no permitido." };
    }
    if (!Number.isInteger(tamano) || tamano < 1 || tamano > MAX_BYTES_SUBIDA) {
      return { error: "Hay una foto que supera el tamaño permitido." };
    }

    const ancho = Number.isInteger(Number(item?.ancho)) && Number(item.ancho) > 0 ? Number(item.ancho) : null;
    const alto = Number.isInteger(Number(item?.alto)) && Number(item.alto) > 0 ? Number(item.alto) : null;
    const descripcion = String(item?.descripcion || "").trim().slice(0, MAX_DESCRIPCION_FOTO);

    lista.push({
      id,
      ruta,
      ruta_miniatura: miniatura,
      tipo_mime: tipo,
      tamano_bytes: tamano,
      ancho,
      alto,
      descripcion: descripcion || null,
    });
  }

  return { fotos: lista };
}

export function normalizarFotosQuitar(ids) {
  if (ids === undefined || ids === null) return { ids: [] };
  if (!Array.isArray(ids)) return { error: "Las fotos a quitar no son válidas." };
  const limpios = [...new Set(ids.map((id) => String(id || "").trim()))];
  if (limpios.some((id) => !esUuidFoto(id))) {
    return { error: "Las fotos a quitar no son válidas." };
  }
  return { ids: limpios };
}
