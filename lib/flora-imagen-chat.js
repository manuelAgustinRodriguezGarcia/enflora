/** Límites compartidos del adjunto visual en el chat Flora (cliente y servidor). */

import { LADO_MAXIMO, TIPOS_FOTO_PERMITIDOS } from "@/lib/fotos";

/** Tamaño objetivo tras comprimir (antes de base64). */
export const FLORA_CHAT_MAX_BYTES_IMAGEN = 2 * 1024 * 1024;

/** Lado mayor al redimensionar fotos nuevas del dispositivo (configurable vía env en build). */
export const FLORA_CHAT_LADO_MAXIMO =
  Number(process.env.NEXT_PUBLIC_FLORA_IMAGEN_LADO_MAX) > 0
    ? Number(process.env.NEXT_PUBLIC_FLORA_IMAGEN_LADO_MAX)
    : LADO_MAXIMO;

/** Longitud máxima del string base64 aceptado en el API (≈2 MB binarios + margen). */
export const FLORA_CHAT_MAX_BASE64 = 2_900_000;

/** Máximo de fotografías por mensaje en el chat. */
export const FLORA_CHAT_MAX_IMAGENES = 5;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUuidFotoFlora(valor) {
  return UUID_RE.test(String(valor || "").trim());
}

export function mimeImagenFloraPermitido(mime) {
  return TIPOS_FOTO_PERMITIDOS.includes(String(mime || "").toLowerCase());
}

/** Fotos de dispositivo enviadas antes de persistirlas en Storage. */
export const AVISO_IMAGEN_CHAT_NO_GUARDADA =
  "Esta fotografía se envió antes de guardarse en la conversación y ya no se puede recuperar.";

/** Texto de pregunta cuando el usuario envía solo la foto. */
export const FLORA_PREGUNTA_SOLO_IMAGEN =
  "¿Qué observás en esta fotografía y qué me recomendás?";

export function normalizarPreguntaConImagen(texto) {
  const limpio = String(texto ?? "").trim();
  return limpio || FLORA_PREGUNTA_SOLO_IMAGEN;
}

function parsearUnAdjuntoImagen(imagen) {
  if (!imagen || typeof imagen !== "object") {
    return { ok: false, adjunto: null, error: "El adjunto de imagen no es válido." };
  }

  const origen = String(imagen.origen || "").trim();
  if (origen === "enflora") {
    const fotoId = String(imagen.fotoId || "").trim();
    if (!esUuidFotoFlora(fotoId)) {
      return { ok: false, adjunto: null, error: "La foto seleccionada no es válida." };
    }
    return { ok: true, adjunto: { origen: "enflora", fotoId }, error: "" };
  }

  if (origen === "transitoria") {
    const mimeType = String(imagen.mimeType || "").toLowerCase();
    const datosBase64 = String(imagen.datosBase64 || "").replace(/\s/g, "");
    if (!mimeImagenFloraPermitido(mimeType)) {
      return { ok: false, adjunto: null, error: "Formato de imagen no permitido." };
    }
    if (!datosBase64 || datosBase64.length > FLORA_CHAT_MAX_BASE64) {
      return {
        ok: false,
        adjunto: null,
        error: "La imagen es demasiado pesada. Probá con otra o más comprimida.",
      };
    }
    return {
      ok: true,
      adjunto: { origen: "transitoria", mimeType, datosBase64 },
      error: "",
    };
  }

  return { ok: false, adjunto: null, error: "El adjunto de imagen no es válido." };
}

/** Parsea adjuntos enviados por el cliente (sin confiar en rutas de storage). */
export function parsearAdjuntoImagenCliente(body) {
  const crudo = Array.isArray(body?.imagenes)
    ? body.imagenes
    : body?.imagen
      ? [body.imagen]
      : [];

  if (crudo.length === 0) {
    return { ok: true, adjuntos: [], error: "" };
  }
  if (crudo.length > FLORA_CHAT_MAX_IMAGENES) {
    return {
      ok: false,
      adjuntos: [],
      error: `Podés enviar hasta ${FLORA_CHAT_MAX_IMAGENES} fotos por mensaje.`,
    };
  }

  const adjuntos = [];
  for (const item of crudo) {
    const parsed = parsearUnAdjuntoImagen(item);
    if (!parsed.ok) return { ok: false, adjuntos: [], error: parsed.error };
    adjuntos.push(parsed.adjunto);
  }

  return { ok: true, adjuntos, error: "" };
}
