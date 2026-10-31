import "server-only";

import { rutaFotoFloraChatValida } from "@/lib/fotos";
import { firmarRutas } from "@/lib/fotos-servidor";
import { miniaturaFotoEnfloraSiPropia } from "@/lib/flora-imagen-servidor";

export async function enriquecerMensajesChatGuardado(supabase, mensajes) {
  const rutasFlora = [];
  for (const m of mensajes || []) {
    for (const adj of m?.adjuntos || []) {
      if (adj?.tipo === "foto_flora" && rutaFotoFloraChatValida(adj.ruta)) rutasFlora.push(adj.ruta);
    }
  }
  const firmasFlora = await firmarRutas(supabase, rutasFlora);

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
        } else if (adj?.tipo === "foto_flora" && rutaFotoFloraChatValida(adj.ruta)) {
          const vistaUrl = firmasFlora.get(adj.ruta) || "";
          adjuntos.push({
            tipo: "foto_flora",
            ruta: adj.ruta,
            vistaUrl,
            accesible: Boolean(vistaUrl),
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
