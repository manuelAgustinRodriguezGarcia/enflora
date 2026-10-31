import "server-only";

import {
  aplicarAuthorizedPaymentRemoto,
  buscarSuscripcionPorPreapproval,
  buscarSuscripcionPorReferencia,
  notificacionYaProcesada,
} from "@/lib/pagos/plus/aplicar-webhook-suscripcion";
import {
  buscarAuthorizedPaymentsPreapproval,
  obtenerAuthorizedPayment,
  obtenerPagoMercadoPago,
} from "@/lib/pagos/plus/preapproval-api";

function esPagoSuscripcionMp(pago) {
  const poi = String(pago?.point_of_interaction?.type || "").toUpperCase();
  if (poi === "SUBSCRIPTIONS") return true;
  return Boolean(pago?.point_of_interaction?.transaction_data?.subscription_id);
}

function preapprovalIdDesdePago(pago) {
  return String(
    pago?.point_of_interaction?.transaction_data?.subscription_id ||
      pago?.preapproval_id ||
      "",
  ).trim();
}

function idPagoMp(pago) {
  return pago?.id != null ? String(pago.id) : "";
}

/**
 * Sincroniza pagos autorizados de un preapproval (GET search + GET detalle).
 */
export async function sincronizarAuthorizedPaymentsPreapproval({
  supabase,
  suscripcion,
  ambiente,
  fetchFn,
}) {
  if (!suscripcion?.preapproval_id) {
    return { ok: true, pagosSync: 0, motivo: "sin_preapproval" };
  }

  let pagosSync = 0;
  let ultimoError = null;

  try {
    const busqueda = await buscarAuthorizedPaymentsPreapproval(suscripcion.preapproval_id, { fetchFn });
    const resultados = busqueda?.results || busqueda?.data || [];
    for (const item of resultados) {
      const id = item?.id;
      if (!id) continue;
      let detalle = item;
      if (!detalle.status && !detalle.payment) {
        try {
          detalle = await obtenerAuthorizedPayment(id, { fetchFn });
        } catch {
          continue;
        }
      }
      const aplicado = await aplicarAuthorizedPaymentRemoto({
        supabase,
        suscripcion,
        remoto: detalle,
        clave: null,
        ambiente,
      });
      if (!aplicado.ok) {
        if (aplicado.codigo === "persistencia") return aplicado;
        ultimoError = aplicado.codigo;
        continue;
      }
      pagosSync += 1;
    }
  } catch {
    return { ok: false, codigo: "mp_no_disponible" };
  }

  return { ok: true, pagosSync, ultimoError };
}

/**
 * Resuelve authorized_payment a partir de un payment.id de suscripción.
 */
export async function authorizedPaymentDesdePagoMp({ preapprovalId, paymentId, fetchFn }) {
  const busqueda = await buscarAuthorizedPaymentsPreapproval(preapprovalId, { fetchFn });
  const resultados = busqueda?.results || busqueda?.data || [];
  const coincidencia = resultados.find((item) => {
    const pid = item?.payment?.id ?? item?.payment_id;
    return pid != null && String(pid) === String(paymentId);
  });
  if (coincidencia?.id) {
    if (coincidencia.status || coincidencia.payment) return coincidencia;
    return obtenerAuthorizedPayment(coincidencia.id, { fetchFn });
  }
  for (const item of resultados) {
    if (!item?.id) continue;
    const detalle = await obtenerAuthorizedPayment(item.id, { fetchFn });
    const pid = detalle?.payment?.id ?? detalle?.payment_id;
    if (pid != null && String(pid) === String(paymentId)) return detalle;
  }
  return null;
}

export { esPagoSuscripcionMp, preapprovalIdDesdePago, idPagoMp, buscarSuscripcionPorPreapproval, buscarSuscripcionPorReferencia, notificacionYaProcesada, obtenerPagoMercadoPago };
