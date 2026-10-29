import { firmaMensajesChat } from "@/lib/flora-firma-mensajes-chat";

export const ESTADOS_PERSISTENCIA_CHAT = {
  NUEVO: "nuevo",
  SINCRONIZADO: "sincronizado",
  PENDIENTE: "pendiente",
  GUARDANDO: "guardando",
  ERROR: "error",
};

/**
 * @param {object} opts
 * @param {string|null} opts.chatGuardadoId — id confirmado por el servidor
 * @param {string} opts.firmaActual
 * @param {string} opts.firmaSincronizada
 * @param {boolean} opts.guardando
 * @param {boolean} opts.hayError
 */
export function derivarEstadoPersistenciaChat({
  chatGuardadoId = null,
  firmaActual = "",
  firmaSincronizada = "",
  guardando = false,
  hayError = false,
}) {
  if (guardando) return ESTADOS_PERSISTENCIA_CHAT.GUARDANDO;
  if (hayError && chatGuardadoId && firmaActual !== firmaSincronizada) {
    return ESTADOS_PERSISTENCIA_CHAT.ERROR;
  }
  if (!chatGuardadoId) return ESTADOS_PERSISTENCIA_CHAT.NUEVO;
  if (firmaActual !== firmaSincronizada) return ESTADOS_PERSISTENCIA_CHAT.PENDIENTE;
  return ESTADOS_PERSISTENCIA_CHAT.SINCRONIZADO;
}

export function chatFloraTieneContenidoPerdible({
  mensajes = [],
  bannerContinuar = null,
  entrada = "",
  adjuntos = [],
  cargando = false,
}) {
  if (cargando) return true;
  if (bannerContinuar) return true;
  if (String(entrada || "").trim()) return true;
  if (adjuntos?.length) return true;
  return mensajes.some((m) => m.id !== "bienvenida");
}

/** Chat nuevo con contenido que se pierde si salís sin guardar en Supabase. */
export function requiereModalSalidaChatFlora(opciones) {
  if (opciones.chatGuardadoId) return false;
  return chatFloraTieneContenidoPerdible(opciones);
}

export function tieneCambiosPendientesSync({
  chatGuardadoId = null,
  mensajes = [],
  firmaSincronizada = "",
}) {
  if (!chatGuardadoId) return false;
  const firma = firmaMensajesChat(mensajes);
  return firma !== firmaSincronizada;
}

/** Solo chats nuevos sin guardar; no usar beforeunload como mecanismo principal de sync. */
export function requiereAdvertenciaBeforeUnloadFlora(opciones) {
  return requiereModalSalidaChatFlora(opciones);
}
