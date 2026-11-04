import "server-only";

import { ordenarAdjuntosGuardados } from "@/lib/flora-chats-guardados";
import { mimeImagenFloraPermitido } from "@/lib/flora-imagen-chat";
import { miniaturasFotosEnfloraPorIds } from "@/lib/flora-imagen-servidor";
import { rutaFotoFloraChatValida, rutaPerteneceAUsuario } from "@/lib/fotos";
import { firmarRutas } from "@/lib/fotos-servidor";

function mimeSiPermitido(valor) {
  const mime = String(valor || "").toLowerCase();
  return mimeImagenFloraPermitido(mime) ? mime : "";
}

/**
 * Regenera vistas firmadas de las fotos ya guardadas.
 * No descarga ni vuelve a subir los archivos: solo firma la ruta persistida.
 */
export async function enriquecerMensajesChatGuardado(supabase, mensajes) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const usuarioId = user?.id || "";

  const rutasFlora = [];
  const idsEnflora = [];
  for (const m of mensajes || []) {
    for (const adj of ordenarAdjuntosGuardados(m?.adjuntos)) {
      if (adj?.tipo === "foto_enflora" && adj.registro_foto_id) idsEnflora.push(adj.registro_foto_id);
      if (
        adj?.tipo === "foto_flora" &&
        rutaFotoFloraChatValida(adj.ruta) &&
        rutaPerteneceAUsuario(adj.ruta, usuarioId)
      ) {
        rutasFlora.push(adj.ruta);
      }
    }
  }

  const [firmasFlora, miniaturas] = await Promise.all([
    firmarRutas(supabase, rutasFlora),
    miniaturasFotosEnfloraPorIds(supabase, idsEnflora),
  ]);

  const salida = [];
  for (const m of mensajes || []) {
    if (!m || typeof m !== "object") continue;
    const copia = { ...m };
    if (Array.isArray(m.adjuntos) && m.adjuntos.length) {
      const adjuntos = [];
      for (const adj of ordenarAdjuntosGuardados(m.adjuntos)) {
        if (adj?.tipo === "foto_enflora" && adj.registro_foto_id) {
          const vista = miniaturas.get(String(adj.registro_foto_id)) || {
            ok: false,
            url: "",
            etiqueta: "",
          };
          const mime = mimeSiPermitido(adj.mime);
          adjuntos.push({
            tipo: "foto_enflora",
            registro_foto_id: adj.registro_foto_id,
            orden: adj.orden,
            ...(mime ? { mime } : {}),
            vistaUrl: vista.ok ? vista.url : "",
            etiqueta: vista.etiqueta || "",
            accesible: vista.ok,
          });
        } else if (
          adj?.tipo === "foto_flora" &&
          rutaFotoFloraChatValida(adj.ruta) &&
          rutaPerteneceAUsuario(adj.ruta, usuarioId)
        ) {
          const vistaUrl = firmasFlora.get(adj.ruta) || "";
          const mime = mimeSiPermitido(adj.mime);
          adjuntos.push({
            tipo: "foto_flora",
            ruta: adj.ruta,
            orden: adj.orden,
            ...(mime ? { mime } : {}),
            vistaUrl,
            accesible: Boolean(vistaUrl),
          });
        } else if (adj?.tipo === "foto_flora" || adj?.tipo === "foto_enflora") {
          adjuntos.push({
            ...adj,
            vistaUrl: "",
            accesible: false,
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
