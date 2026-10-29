import { MENSAJE_BIENVENIDA_FLORA } from "@/lib/flora-chat-etiquetas";
import { mensajesClienteDesdeGuardados } from "@/lib/flora-mensajes-cliente-desde-guardado";

/** Hay un id en la URL (?continuar=) pendiente de hidratar desde la API. */
export function debeRecuperarChatGuardado(continuarSolucionId) {
  return Boolean(String(continuarSolucionId || "").trim());
}

/** Mensaje de error legible según respuesta HTTP de GET /api/flora/soluciones/[id]. */
export function mensajeErrorRecuperacionChat(res, data = {}) {
  if (res?.status === 401) return "Tenés que iniciar sesión para abrir este chat.";
  if (res?.status === 404) return data.error || "No encontramos este chat guardado.";
  if (res?.status === 503) return data.error || "El servicio no está disponible ahora.";
  if (!res?.ok) return data.error || "No pudimos cargar la conversación.";
  if (!data?.ok) return data.error || "No pudimos cargar la conversación.";
  return "No pudimos cargar la conversación.";
}

function mensajesClienteDesdeSolucionLegacy(solucion) {
  const lista = [
    {
      id: "bienvenida",
      rol: "flora",
      texto: MENSAJE_BIENVENIDA_FLORA,
      animar: false,
    },
  ];
  const fecha = solucion?.fecha_respuesta || solucion?.created_at || null;
  const pregunta = String(solucion?.pregunta ?? "").trim();
  const respuesta = String(solucion?.respuesta ?? "").trim();
  if (pregunta) {
    lista.push({
      id: "legacy-usuario",
      rol: "usuario",
      texto: pregunta,
      fecha,
      animar: false,
    });
  }
  if (respuesta) {
    lista.push({
      id: "legacy-flora",
      rol: "flora",
      texto: respuesta,
      fecha,
      animar: false,
    });
  }
  return lista;
}

/**
 * Normaliza la respuesta OK del GET de soluciones/chats para el cliente.
 * @returns {{ ok: true, mensajes, chatGuardadoId, claveSesion, tituloBiblioteca, bannerContinuar } | { ok: false, error: string }}
 */
export function resultadoRecuperacionChatDesdeApi(data) {
  if (data?.chat) {
    const mensajesRaw = data.chat.mensajes;
    if (!Array.isArray(mensajesRaw) || mensajesRaw.length === 0) {
      return { ok: false, error: "Este chat guardado no tiene mensajes." };
    }
    const mensajes = mensajesClienteDesdeGuardados(mensajesRaw);
    return {
      ok: true,
      mensajes,
      chatGuardadoId: data.chat.id,
      claveSesion: data.chat.clave_sesion || "",
      tituloBiblioteca: data.chat.titulo || "",
      bannerContinuar: {
        titulo: data.chat.titulo,
        pregunta: data.chat.primera_pregunta,
      },
    };
  }

  if (data?.solucion) {
    const mensajes = mensajesClienteDesdeSolucionLegacy(data.solucion);
    if (mensajes.length <= 1) {
      return { ok: false, error: "Esta solución guardada no tiene contenido para mostrar." };
    }
    return {
      ok: true,
      mensajes,
      chatGuardadoId: null,
      claveSesion: "",
      tituloBiblioteca: data.solucion.titulo || "",
      bannerContinuar: {
        titulo: data.solucion.titulo,
        pregunta: data.solucion.pregunta,
      },
    };
  }

  return { ok: false, error: "No encontramos este chat guardado." };
}
