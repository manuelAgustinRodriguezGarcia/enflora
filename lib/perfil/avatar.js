// Reglas de la foto de perfil. Compartidas por el navegador y el servidor.
import { tipoPorFirma } from "@/lib/fotos";

export const BUCKET_AVATARS = "avatars";
export const EVENTO_AVATAR = "enflora-avatar";
export const LADO_AVATAR = 512;
export const CALIDAD_AVATAR = 0.85;
export const SEGUNDOS_URL_AVATAR = 60 * 60;
export const MARGEN_RENOVACION_AVATAR_MS = 2 * 60 * 1000;
export const MAX_BYTES_ORIGINAL_AVATAR = 8 * 1024 * 1024;
export const MAX_BYTES_AVATAR = 1024 * 1024;
export const ACEPTAR_AVATAR = "image/jpeg,image/png,image/webp";

const TIPOS_ORIGEN = ["image/jpeg", "image/png", "image/webp"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuidAvatar(valor) {
  return UUID.test(String(valor || ""));
}

function esHeic(archivo) {
  const tipo = String(archivo?.type || "").toLowerCase();
  const nombre = String(archivo?.name || "").toLowerCase();
  return tipo === "image/heic" || tipo === "image/heif" || nombre.endsWith(".heic") || nombre.endsWith(".heif");
}

export function validarArchivoAvatar(archivo) {
  if (!archivo || typeof archivo.size !== "number") {
    return { error: "No se pudo leer el archivo." };
  }
  if (esHeic(archivo)) {
    return { error: "Ese formato no es compatible. Elegí una foto JPG, PNG o WEBP." };
  }
  if (!TIPOS_ORIGEN.includes(String(archivo.type || "").toLowerCase())) {
    return { error: "Solo se aceptan fotos JPG, PNG o WEBP." };
  }
  if (archivo.size < 1) return { error: "El archivo está vacío." };
  if (archivo.size > MAX_BYTES_ORIGINAL_AVATAR) {
    return { error: "La foto es demasiado pesada. El máximo es 8 MB." };
  }
  return { error: "" };
}

export function validarBytesSubidaAvatar(bytes) {
  if (!bytes || typeof bytes.length !== "number" || bytes.length < 12) {
    return { error: "No se pudo leer la foto." };
  }
  if (bytes.length > MAX_BYTES_AVATAR) {
    return { error: "La foto procesada es demasiado pesada." };
  }
  const tipo = tipoPorFirma(bytes);
  if (tipo !== "image/webp" && tipo !== "image/jpeg") {
    return { error: "La foto procesada no es válida." };
  }
  return { error: "", tipo, extension: tipo === "image/webp" ? "webp" : "jpg" };
}

export function rutaAvatar(usuarioId, archivoId, extension) {
  return `${String(usuarioId).toLowerCase()}/${String(archivoId).toLowerCase()}.${extension}`;
}

/** La ruta pertenece a ese usuario y no es una URL ni una ruta de otro archivo. */
export function rutaAvatarValida(ruta, usuarioId) {
  const texto = String(ruta || "");
  const usuario = String(usuarioId || "").toLowerCase();
  if (!esUuidAvatar(usuario)) return false;
  if (/^https?:/i.test(texto) || texto.includes("..") || texto.includes("\\") || texto.includes("//")) {
    return false;
  }
  const partes = texto.match(/^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(webp|jpg)$/i);
  if (!partes) return false;
  return partes[1].toLowerCase() === usuario && esUuidAvatar(partes[1]) && esUuidAvatar(partes[2]);
}

export function debeRenovarAvatar(expira, ahora = Date.now(), margen = MARGEN_RENOVACION_AVATAR_MS) {
  const limite = Number(expira);
  if (!Number.isFinite(limite) || limite <= 0) return true;
  return ahora >= limite - margen;
}

export function cajaRotada(ancho, alto, rotacion) {
  const rad = ((Number(rotacion) || 0) * Math.PI) / 180;
  const seno = Math.abs(Math.sin(rad));
  const coseno = Math.abs(Math.cos(rad));
  return {
    ancho: Math.abs(coseno * ancho) + Math.abs(seno * alto),
    alto: Math.abs(seno * ancho) + Math.abs(coseno * alto),
  };
}

export function limitarRecorte(area, ancho, alto) {
  const limiteAncho = Math.max(1, Math.floor(Number(ancho) || 0));
  const limiteAlto = Math.max(1, Math.floor(Number(alto) || 0));
  const x = Math.min(limiteAncho - 1, Math.max(0, Math.round(Number(area?.x) || 0)));
  const y = Math.min(limiteAlto - 1, Math.max(0, Math.round(Number(area?.y) || 0)));
  const width = Math.min(limiteAncho - x, Math.max(1, Math.round(Number(area?.width) || 0)));
  const height = Math.min(limiteAlto - y, Math.max(1, Math.round(Number(area?.height) || 0)));
  return { x, y, width, height };
}
