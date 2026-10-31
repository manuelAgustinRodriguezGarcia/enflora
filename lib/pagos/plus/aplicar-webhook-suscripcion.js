import "server-only";

import { estadoInternoDesdePreapprovalMp, estadoPagoRecurrenteDesdeRemotoMp } from "@/lib/pagos/plus/estados";
import { persistirPagoRecurrentePlus } from "@/lib/pagos/plus/persistencia-pago";

function referenciaSuscripcion(remoto) {
  return String(remoto?.external_reference || remoto?.externalReference || "").trim();
}

function sumarMes(isoFecha) {
  const base = isoFecha ? new Date(isoFecha) : new Date();
  if (Number.isNaN(base.getTime())) return new Date().toISOString();
  const copia = new Date(base.getTime());
  copia.setUTCMonth(copia.getUTCMonth() + 1);
  return copia.toISOString();
}

async function notificacionYaProcesada(supabase, clave) {
  if (!clave) return false;
  const { data } = await supabase
    .from("plus_notificaciones")
    .select("id, aplicada")
    .eq("clave", clave)
    .maybeSingle();
  return Boolean(data?.aplicada);
}

async function marcarNotificacion(supabase, { clave, tipo, recursoId, suscripcionId }) {
  if (!clave) return;
  await supabase.from("plus_notificaciones").upsert(
    {
      clave,
      tipo,
      recurso_id: recursoId,
      suscripcion_id: suscripcionId || null,
      aplicada: true,
    },
    { onConflict: "clave" },
  );
}

/**
 * Sincroniza fila local desde GET /preapproval/{id}. No habilita beneficios sin pago acreditado.
 */
export async function aplicarPreapprovalRemoto({
  supabase,
  suscripcion,
  remoto,
  clave = null,
  ambiente,
}) {
  if (!supabase || !suscripcion?.id || !remoto?.id) {
    return { ok: false, codigo: "datos_incompletos" };
  }
  if (suscripcion.ambiente !== ambiente) return { ok: false, codigo: "ambiente_distinto" };
  if (String(remoto.id) !== String(suscripcion.preapproval_id || "")) {
    return { ok: false, codigo: "titularidad_preapproval" };
  }

  const estadoInterno = estadoInternoDesdePreapprovalMp(remoto.status) || suscripcion.estado_interno;
  const canceladaMp = estadoInterno === "cancelada";
  const actualizacion = {
    estado_mp: remoto.status || null,
    estado_interno: estadoInterno,
    proxima_renovacion: remoto.next_payment_date || suscripcion.proxima_renovacion || null,
    init_point: remoto.init_point || suscripcion.init_point || null,
    actualizado_en: new Date().toISOString(),
  };

  if (canceladaMp && !suscripcion.cancelada_en) {
    actualizacion.cancelada_en = new Date().toISOString();
    actualizacion.vigente_hasta_fin_periodo = Boolean(suscripcion.periodo_vigente_hasta);
  }

  const importeMp = remoto?.auto_recurring?.transaction_amount;
  if (importeMp != null) {
    actualizacion.importe_ars = String(importeMp);
  }

  const { error } = await supabase.from("plus_suscripciones").update(actualizacion).eq("id", suscripcion.id);
  if (error) return { ok: false, codigo: "persistencia" };

  await marcarNotificacion(supabase, {
    clave,
    tipo: "subscription_preapproval",
    recursoId: String(remoto.id),
    suscripcionId: suscripcion.id,
  });

  return { ok: true, estadoInterno };
}

/**
 * Registra pago recurrente autorizado. Solo extiende vigencia si el pago queda acreditado en MP.
 */
export async function aplicarAuthorizedPaymentRemoto({
  supabase,
  suscripcion,
  remoto,
  clave = null,
  ambiente,
}) {
  if (!supabase || !suscripcion?.id || !remoto?.id) {
    return { ok: false, codigo: "datos_incompletos" };
  }
  if (suscripcion.ambiente !== ambiente) return { ok: false, codigo: "ambiente_distinto" };

  const preapprovalId = String(remoto.preapproval_id || remoto.preapprovalId || "").trim();
  if (preapprovalId && suscripcion.preapproval_id && preapprovalId !== suscripcion.preapproval_id) {
    return { ok: false, codigo: "titularidad_preapproval" };
  }

  const estadoInternoPago = estadoPagoRecurrenteDesdeRemotoMp(remoto);
  const importe = remoto.transaction_amount ?? remoto.amount ?? suscripcion.importe_ars;
  const periodoDesde =
    remoto.payment?.date_approved ||
    remoto.debit_date ||
    remoto.date_created ||
    new Date().toISOString();
  const periodoHasta = sumarMes(periodoDesde);
  const acreditadoEn =
    estadoInternoPago === "acreditado"
      ? remoto.payment?.date_approved || remoto.debit_date || new Date().toISOString()
      : null;

  const filaPago = {
    suscripcion_id: suscripcion.id,
    usuario_id: suscripcion.usuario_id,
    ambiente,
    authorized_payment_id: String(remoto.id),
    payment_id: remoto.payment?.id ? String(remoto.payment.id) : remoto.payment_id || null,
    estado_mp: remoto.payment?.status || remoto.status || null,
    estado_interno: estadoInternoPago,
    importe_ars: importe != null ? String(importe) : "0",
    importe_cobrado_ars:
      estadoInternoPago === "acreditado" && importe != null ? String(importe) : null,
    periodo_desde: periodoDesde,
    periodo_hasta: periodoHasta,
    acreditado_en: acreditadoEn,
    actualizado_en: new Date().toISOString(),
  };

  const persistido = await persistirPagoRecurrentePlus(supabase, filaPago);
  if (!persistido.ok) return persistido;

  if (estadoInternoPago === "acreditado") {
    const { error: errorSub } = await supabase
      .from("plus_suscripciones")
      .update({
        estado_interno: "activa",
        estado_mp: "authorized",
        periodo_vigente_desde: periodoDesde,
        periodo_vigente_hasta: periodoHasta,
        proxima_renovacion: remoto.next_payment_date || periodoHasta,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", suscripcion.id);
    if (errorSub) return { ok: false, codigo: "persistencia" };
  } else if (estadoInternoPago === "rechazado") {
    await supabase
      .from("plus_suscripciones")
      .update({
        estado_interno: "past_due",
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", suscripcion.id);
  }

  await marcarNotificacion(supabase, {
    clave,
    tipo: "subscription_authorized_payment",
    recursoId: String(remoto.id),
    suscripcionId: suscripcion.id,
  });

  return { ok: true, estadoInternoPago };
}

export async function buscarSuscripcionPorPreapproval(supabase, preapprovalId) {
  const id = String(preapprovalId || "").trim();
  if (!id) return { suscripcion: null, error: null };
  const { data, error } = await supabase
    .from("plus_suscripciones")
    .select("*")
    .eq("preapproval_id", id)
    .maybeSingle();
  return { suscripcion: data, error };
}

export async function buscarSuscripcionPorReferencia(supabase, referencia) {
  const ref = String(referencia || "").trim();
  if (!ref) return { suscripcion: null, error: null };
  const { data, error } = await supabase
    .from("plus_suscripciones")
    .select("*")
    .eq("external_reference", ref)
    .maybeSingle();
  return { suscripcion: data, error };
}

export { referenciaSuscripcion, notificacionYaProcesada };
