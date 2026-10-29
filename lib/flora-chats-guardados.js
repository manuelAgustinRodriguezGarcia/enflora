import {
  sugerirTituloSolucion,
  validarTituloSolucion,
  uuidSolucionOpcional,
} from "@/lib/flora-biblioteca-compartido";

export const LIMITES_FLORA_CHATS = {
  maxPorUsuarioBiblioteca: 200,
  maxChats: 100,
  maxMensajesPorChat: 200,
  maxTextoMensaje: 50_000,
  maxPrimeraPregunta: 2000,
  maxTitulo: 120,
  maxClaveSesion: 80,
  paginaListado: 30,
  maxCaracteresContextoGemini: 12_000,
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PREGUNTA_IMAGEN = /^\[?(imagen|foto|adjunto)/i;

export function claveSesionChatValida(valor) {
  const s = String(valor ?? "").trim();
  if (!s || s.length > LIMITES_FLORA_CHATS.maxClaveSesion) {
    return { ok: false, error: "La sesión del chat no es válida.", valor: "" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) {
    return { ok: false, error: "La sesión del chat no es válida.", valor: "" };
  }
  return { ok: true, error: "", valor: s };
}

export function primeraPreguntaSignificativaDesdeMensajes(mensajes) {
  for (const m of mensajes || []) {
    if (m?.rol !== "usuario") continue;
    const t = String(m.texto ?? "").replace(/\s+/g, " ").trim();
    if (t && !PREGUNTA_IMAGEN.test(t)) return t;
  }
  for (const m of mensajes || []) {
    if (m?.rol !== "usuario") continue;
    const t = String(m.texto ?? "").replace(/\s+/g, " ").trim();
    if (t) return t;
    if (Array.isArray(m.adjuntos) && m.adjuntos.length) {
      return "Consulta con imagen adjunta";
    }
  }
  return "";
}

export function sugerirTituloChat(mensajes) {
  const pregunta = primeraPreguntaSignificativaDesdeMensajes(mensajes);
  return sugerirTituloSolucion(pregunta || "Consulta con Flora");
}

function normalizarAdjuntoGuardado(adj) {
  if (!adj || typeof adj !== "object") return null;
  if (adj.origen === "enflora" && adj.fotoId && UUID_RE.test(String(adj.fotoId))) {
    return { tipo: "foto_enflora", registro_foto_id: String(adj.fotoId) };
  }
  if (adj.origen === "transitoria" || adj.tipo === "transitoria") {
    return { tipo: "transitoria", persistida: false };
  }
  if (adj.tipo === "foto_enflora" && adj.registro_foto_id && UUID_RE.test(String(adj.registro_foto_id))) {
    return { tipo: "foto_enflora", registro_foto_id: String(adj.registro_foto_id) };
  }
  return null;
}

export function mensajesClienteParaPersistencia(mensajesEntrada) {
  const salida = [];
  for (const m of mensajesEntrada || []) {
    if (!m || typeof m !== "object") continue;
    if (m.id === "bienvenida") continue;
    const rol = m.rol === "flora" ? "flora" : "usuario";
    const texto = String(m.texto ?? "").trim();
    const adjuntosRaw = m.adjuntos?.length ? m.adjuntos : m.adjunto ? [m.adjunto] : [];
    const adjuntos = adjuntosRaw.map(normalizarAdjuntoGuardado).filter(Boolean);

    if (!texto && !adjuntos.length) continue;

    const fecha =
      m.fecha && !Number.isNaN(Date.parse(m.fecha))
        ? new Date(m.fecha).toISOString()
        : new Date().toISOString();

    const item = { rol, texto, fecha };
    if (adjuntos.length) item.adjuntos = adjuntos;
    salida.push(item);
  }
  return salida;
}

export function fusionarReferenciasDesdeMensajesChat(mensajes) {
  const refs = [];
  const claves = new Set();
  for (const m of mensajes || []) {
    const ref = m?.metaGuardado?.referencias;
    if (!ref || typeof ref !== "object") continue;
    const clave = JSON.stringify(ref);
    if (claves.has(clave)) continue;
    claves.add(clave);
    refs.push(ref);
  }
  if (!refs.length) return null;
  if (refs.length === 1) return refs[0];
  return { procedencia: "chat_flora", fragmentos: refs };
}

export function validarMensajesChatPersistidos(mensajes) {
  if (!Array.isArray(mensajes) || mensajes.length === 0) {
    return { ok: false, error: "No hay mensajes para guardar." };
  }
  if (mensajes.length > LIMITES_FLORA_CHATS.maxMensajesPorChat) {
    return {
      ok: false,
      error: `El chat supera el máximo de ${LIMITES_FLORA_CHATS.maxMensajesPorChat} mensajes.`,
    };
  }

  let tieneUsuario = false;
  let tieneFlora = false;

  for (const m of mensajes) {
    if (!m || typeof m !== "object") {
      return { ok: false, error: "Formato de mensajes inválido." };
    }
    if (m.rol !== "usuario" && m.rol !== "flora") {
      return { ok: false, error: "Rol de mensaje inválido." };
    }
    const texto = String(m.texto ?? "");
    if (texto.length > LIMITES_FLORA_CHATS.maxTextoMensaje) {
      return { ok: false, error: "Un mensaje es demasiado largo." };
    }
    if (m.rol === "usuario") tieneUsuario = true;
    if (m.rol === "flora") tieneFlora = true;

    if (Array.isArray(m.adjuntos)) {
      for (const adj of m.adjuntos) {
        if (!adj || typeof adj !== "object") continue;
        if (adj.tipo === "foto_enflora") {
          if (!UUID_RE.test(String(adj.registro_foto_id || ""))) {
            return { ok: false, error: "Referencia de foto inválida." };
          }
        } else if (adj.tipo !== "transitoria") {
          return { ok: false, error: "Adjunto no permitido en el chat guardado." };
        }
      }
    }
  }

  if (!tieneUsuario || !tieneFlora) {
    return { ok: false, error: "Guardá al menos una pregunta y una respuesta de Flora." };
  }

  const primera = primeraPreguntaSignificativaDesdeMensajes(mensajes);
  if (!primera || primera.length > LIMITES_FLORA_CHATS.maxPrimeraPregunta) {
    return { ok: false, error: "La primera pregunta no es válida." };
  }

  return { ok: true, error: "", mensajes, primeraPregunta: primera };
}

export function validarPayloadGuardarChat(body) {
  const tituloVal = validarTituloSolucion(body?.titulo);
  if (!tituloVal.ok) return { ok: false, error: tituloVal.error };

  const sesion = claveSesionChatValida(body?.claveSesion || body?.clave_sesion);
  if (!sesion.ok) return { ok: false, error: sesion.error };

  const crudos = mensajesClienteParaPersistencia(body?.mensajes);
  const mensajesVal = validarMensajesChatPersistidos(crudos);
  if (!mensajesVal.ok) return { ok: false, error: mensajesVal.error };

  let referencias = body?.referencias;
  if (referencias !== null && referencias !== undefined && typeof referencias !== "object") {
    referencias = null;
  }

  const chatGuardadoId = body?.chatGuardadoId || body?.chat_guardado_id || null;
  if (chatGuardadoId) {
    const idVal = uuidSolucionOpcional(chatGuardadoId, "id");
    if (!idVal.ok) return { ok: false, error: idVal.error };
  }

  return {
    ok: true,
    error: "",
    titulo: tituloVal.valor,
    claveSesion: sesion.valor,
    mensajes: mensajesVal.mensajes,
    primeraPregunta: mensajesVal.primeraPregunta,
    referencias: referencias || null,
    chatGuardadoId: chatGuardadoId ? String(chatGuardadoId).trim() : null,
  };
}

export function solucionLegacyComoItemListado(solucion) {
  return {
    id: solucion.id,
    titulo: solucion.titulo,
    pregunta: solucion.pregunta,
    extracto: solucion.pregunta,
    fecha: solucion.fecha_respuesta,
    cantidad_mensajes: 2,
    tipo: "solucion",
  };
}

export function chatComoItemListado(chat) {
  return {
    id: chat.id,
    titulo: chat.titulo,
    pregunta: chat.primera_pregunta,
    extracto: chat.primera_pregunta,
    fecha: chat.updated_at || chat.created_at,
    cantidad_mensajes: chat.cantidad_mensajes ?? 0,
    tipo: "chat",
  };
}
