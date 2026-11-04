"use server";

import { redirect } from "next/navigation";
import { enviarFeedbackUsuario } from "@/lib/feedback/envio";
import { conservarEntradaFeedback } from "@/lib/feedback/reglas";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerUsuario } from "@/lib/supabase/servidor";

export async function enviarFeedback(_previo, formulario) {
  const entrada = conservarEntradaFeedback({
    categoria: String(formulario.get("categoria") || ""),
    mensaje: String(formulario.get("mensaje") || ""),
  });

  if (!configuracionLista()) {
    return {
      ok: false,
      codigo: "error",
      error: "Falta la configuración de Supabase.",
      ...entrada,
    };
  }

  const user = await obtenerUsuario();
  if (!user) redirect("/ingreso");

  const supabase = await crearClienteServidor();
  return enviarFeedbackUsuario({
    sesion: { id: user.id, esAnonimo: user.is_anonymous === true },
    entrada,
    persistir: ({ categoria, mensaje }) =>
      supabase.rpc("enviar_feedback_usuario", {
        p_categoria: categoria,
        p_mensaje: mensaje,
      }),
  });
}
