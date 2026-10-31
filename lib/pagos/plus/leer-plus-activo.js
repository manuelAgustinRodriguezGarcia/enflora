import "server-only";

import { leerAmbientePagos } from "@/lib/pagos/ambiente";
import { plusSuscripcionHabilita } from "@/lib/pagos/plus/cobertura";

function tablaPlusAusente(error) {
  return /plus_suscripciones|42P01|PGRST205/i.test(`${error?.message || ""}`);
}

function pagoRecurrenteVigente(pago, ahora) {
  if (!pago || pago.estado_interno !== "acreditado") return false;
  const hasta = pago.periodo_hasta ? new Date(pago.periodo_hasta) : null;
  if (!hasta || Number.isNaN(hasta.getTime())) return false;
  return hasta >= ahora;
}

/**
 * Resuelve si la cuenta tiene Plus comercial vigente (no checkout pendiente).
 * Requiere migración `supabase/plus-suscripciones.sql` aplicada en el proyecto Supabase.
 */
export async function consultarPlusActivo(supabase, usuarioId, env = process.env, ahora = new Date()) {
  if (!supabase || !usuarioId) {
    return { activo: false, dbDisponible: false };
  }

  const lectura = leerAmbientePagos(env);
  if (!lectura.ok) return { activo: false, dbDisponible: false };
  const ambiente = lectura.ambiente;

  const { data: suscripciones, error: errorSubs } = await supabase
    .from("plus_suscripciones")
    .select(
      "id, usuario_id, ambiente, estado_interno, periodo_vigente_hasta, vigente_hasta_fin_periodo, cancelada_en, actualizado_en",
    )
    .eq("usuario_id", usuarioId)
    .eq("ambiente", ambiente)
    .in("estado_interno", ["activa", "cancelada"])
    .order("actualizado_en", { ascending: false })
    .limit(5);

  if (errorSubs) {
    if (tablaPlusAusente(errorSubs)) return { activo: false, dbDisponible: false };
    return { activo: false, dbDisponible: true };
  }

  if (!suscripciones?.length) return { activo: false, dbDisponible: true };

  for (const suscripcion of suscripciones) {
    const { data: pagos, error: errorPagos } = await supabase
      .from("plus_pagos_recurrentes")
      .select("estado_interno, periodo_hasta")
      .eq("suscripcion_id", suscripcion.id)
      .eq("estado_interno", "acreditado")
      .order("periodo_hasta", { ascending: false })
      .limit(3);

    if (errorPagos && tablaPlusAusente(errorPagos)) {
      return { activo: false, dbDisponible: false };
    }

    const pagoVigenteAcreditado = (pagos || []).some((p) => pagoRecurrenteVigente(p, ahora));
    if (
      plusSuscripcionHabilita({
        suscripcion,
        ambiente,
        usuarioId,
        pagoVigenteAcreditado,
        ahora,
      })
    ) {
      return { activo: true, dbDisponible: true, suscripcionId: suscripcion.id };
    }
  }

  return { activo: false, dbDisponible: true };
}

export async function leerPlusActivo(supabase, usuarioId, env = process.env) {
  const resultado = await consultarPlusActivo(supabase, usuarioId, env);
  return resultado.activo;
}
