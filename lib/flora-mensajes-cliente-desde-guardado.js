import { MENSAJE_BIENVENIDA_FLORA } from "@/lib/flora-chat-etiquetas";

function adjuntosUiDesdeGuardado(adjuntos) {
  if (!Array.isArray(adjuntos) || !adjuntos.length) return undefined;
  const ui = [];
  for (const adj of adjuntos) {
    if (adj?.tipo === "foto_enflora" && adj.registro_foto_id) {
      ui.push({
        origen: "enflora",
        fotoId: adj.registro_foto_id,
        vista: adj.vistaUrl || "",
        etiqueta: adj.etiqueta || "",
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
