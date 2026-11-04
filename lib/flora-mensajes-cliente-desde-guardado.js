import { MENSAJE_BIENVENIDA_FLORA } from "@/lib/flora-chat-etiquetas";
import { ordenarAdjuntosGuardados } from "@/lib/flora-chats-guardados";
import {
  AVISO_IMAGEN_CHAT_NO_DISPONIBLE,
  AVISO_IMAGEN_CHAT_NO_GUARDADA,
} from "@/lib/flora-imagen-chat";

/** Adjuntos del JSON guardado → forma que pinta el chat. No son fotos pendientes de envío. */
export function adjuntosUiDesdeGuardado(adjuntos) {
  const ordenados = ordenarAdjuntosGuardados(adjuntos);
  if (!ordenados.length) return undefined;
  const ui = [];
  for (const adj of ordenados) {
    if (adj?.tipo === "foto_enflora" && adj.registro_foto_id) {
      ui.push({
        origen: "enflora",
        fotoId: adj.registro_foto_id,
        vista: adj.vistaUrl || "",
        etiqueta: adj.etiqueta || "",
        mimeType: adj.mime || "",
        historica: true,
        noDisponible: !adj.vistaUrl,
        aviso: adj.vistaUrl ? "" : "Foto de tu galería ENFLORA (no disponible o sin acceso).",
      });
      continue;
    }
    if (adj?.tipo === "foto_flora" && adj.ruta) {
      ui.push({
        origen: "flora",
        ruta: adj.ruta,
        vista: adj.vistaUrl || "",
        mimeType: adj.mime || "",
        historica: true,
        noDisponible: !adj.vistaUrl,
        aviso: adj.vistaUrl ? "" : AVISO_IMAGEN_CHAT_NO_DISPONIBLE,
      });
      continue;
    }
    if (adj?.tipo === "transitoria") {
      ui.push({
        origen: "transitoria",
        historica: true,
        noDisponible: true,
        aviso: AVISO_IMAGEN_CHAT_NO_GUARDADA,
      });
    }
  }
  return ui.length ? ui : undefined;
}

/** Reconstruye el estado del chat en cliente a partir del JSON guardado en Supabase. */
export function mensajesClienteDesdeGuardados(mensajesGuardados) {
  const lista = [
    {
      id: "bienvenida",
      rol: "flora",
      texto: MENSAJE_BIENVENIDA_FLORA,
      animar: false,
    },
  ];

  for (let i = 0; i < (mensajesGuardados || []).length; i += 1) {
    const m = mensajesGuardados[i];
    if (!m || (m.rol !== "usuario" && m.rol !== "flora")) continue;
    lista.push({
      id: `guardado-${i}-${m.fecha || i}`,
      rol: m.rol,
      texto: String(m.texto ?? ""),
      fecha: m.fecha,
      animar: false,
      adjuntos: adjuntosUiDesdeGuardado(m.adjuntos),
    });
  }

  return lista;
}
