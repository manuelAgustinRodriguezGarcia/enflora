"use server";

import { revalidatePath } from "next/cache";
import { obtenerAdmin } from "@/lib/admin/autorizacion";
import { guardarFeedbackAdmin } from "@/lib/admin/feedback";
import { mensajeGestionFeedback, validarGestionFeedback } from "@/lib/admin/feedback-reglas";

function campos(formulario) {
  return {
    id: String(formulario.get("id") || ""),
    estado: String(formulario.get("estado") || ""),
    prioridad: String(formulario.get("prioridad") || ""),
    nota: String(formulario.get("nota_admin") ?? ""),
  };
}

export async function guardarGestionFeedback(_previo, formulario) {
  const entrada = campos(formulario);
  const autorizacion = await obtenerAdmin("feedback");
  if (!autorizacion.ok) {
    return { ok: false, error: mensajeGestionFeedback("denegado") };
  }

  const validado = validarGestionFeedback(entrada);
  if (!validado.ok) return { ok: false, error: validado.error };

  const resultado = await guardarFeedbackAdmin(autorizacion.credencial, validado);
  if (!resultado.ok || resultado.estado !== "listo") {
    const error =
      resultado.estado === "denegado" ? mensajeGestionFeedback("denegado") : resultado.error || mensajeGestionFeedback("error");
    return { ok: false, error };
  }

  revalidatePath("/admin/feedback");
  revalidatePath(`/admin/feedback/${validado.id}`);
  return { ok: true, cambio: resultado.cambio === true };
}
