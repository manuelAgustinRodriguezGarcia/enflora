import "server-only";

import { miniaturaFotoEnfloraSiPropia } from "@/lib/flora-imagen-servidor";

export async function enriquecerMensajesChatGuardado(supabase, mensajes) {
  const salida = [];
  for (const m of mensajes || []) {
    if (!m || typeof m !== "object") continue;
    const copia = { ...m };
    if (Array.isArray(m.adjuntos) && m.adjuntos.length) {
      const adjuntos = [];
      for (const adj of m.adjuntos) {
        if (adj?.tipo === "foto_enflora" && adj.registro_foto_id) {
          const vista = await miniaturaFotoEnfloraSiPropia(supabase, adj.registro_foto_id);
          adjuntos.push({
            ...adj,
            vistaUrl: vista.ok ? vista.url : "",
            etiqueta: vista.etiqueta || "",
            accesible: vista.ok,
          });
        } else {
          adjuntos.push(adj);
        }
      }
      copia.adjuntos = adjuntos;
    }
    salida.push(copia);
  }
  return salida;
}
