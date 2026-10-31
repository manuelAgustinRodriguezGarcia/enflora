import { leerRecepcionPagos } from "./ambiente.js";
import { clientePagos } from "./datos.js";
import { ambienteCompatibleConAviso, eventoPagoRecurrenteWebhook } from "./evento-webhook.js";
import { firmaWebhookValida } from "./firma.js";
import { aplicarAuthorizedPaymentRemoto } from "./plus/aplicar-webhook-suscripcion.js";
import {
  authorizedPaymentDesdePagoMp,
  buscarSuscripcionPorPreapproval,
  buscarSuscripcionPorReferencia,
  esPagoSuscripcionMp,
  idPagoMp,
  notificacionYaProcesada,
  obtenerPagoMercadoPago,
  preapprovalIdDesdePago,
} from "./plus/sincronizar-pagos.js";

/**
 * Webhook `payment`: solo pagos de suscripción (SUBSCRIPTIONS). Orders / pago único no pasan por acá.
 */
export async function procesarWebhookPagoRecurrenteEntrada(
  {
    dataId,
    type,
    topic,
    xSignature,
    xRequestId,
    aviso = null,
    secret,
    env = process.env,
  },
  deps = {},
) {
  const firma = firmaWebhookValida({ xSignature, xRequestId, dataId, secret });
  if (!firma.ok) {
    return { status: firma.codigo === "sin_secreto" ? 503 : 401, body: { ok: false } };
  }

  if (!eventoPagoRecurrenteWebhook({ type, topic })) {
    return { status: 200, body: { ok: true, ignorado: true } };
  }

  if (!dataId || !xRequestId) {
    return { status: 400, body: { ok: false } };
  }

  const idAviso = aviso?.data?.id;
  if (idAviso && String(idAviso) !== String(dataId)) {
    return { status: 400, body: { ok: false } };
  }

  const leerRecepcion = deps.leerRecepcionPagos || ((e) => leerRecepcionPagos(e ?? env));
  const ambiente = leerRecepcion(env);
  if (!ambiente.ok) {
    return { status: 503, body: { ok: false } };
  }

  if (!ambienteCompatibleConAviso(ambiente.ambiente, aviso?.live_mode)) {
    return { status: 200, body: { ok: true, ignorado: true } };
  }

  const supabase = deps.clientePagos ? deps.clientePagos() : clientePagos();
  if (!supabase) return { status: 503, body: { ok: false } };

  if (await notificacionYaProcesada(supabase, xRequestId)) {
    return { status: 200, body: { ok: true, duplicada: true } };
  }

  const fetchPago = deps.obtenerPagoMercadoPago || obtenerPagoMercadoPago;
  let pago;
  try {
    pago = await fetchPago(dataId, { fetchFn: deps.fetchFn });
  } catch {
    return { status: 503, body: { ok: false } };
  }

  if (!esPagoSuscripcionMp(pago)) {
    return { status: 200, body: { ok: true, ignorado: true, motivo: "no_suscripcion" } };
  }

  const referencia = String(pago.external_reference || "").trim();
  const preapprovalId = preapprovalIdDesdePago(pago);
  let suscripcion = null;

  if (referencia) {
    const busquedaRef = await buscarSuscripcionPorReferencia(supabase, referencia);
    suscripcion = busquedaRef.suscripcion;
  }
  if (!suscripcion && preapprovalId) {
    const busquedaPre = await buscarSuscripcionPorPreapproval(supabase, preapprovalId);
    suscripcion = busquedaPre.suscripcion;
  }

  if (!suscripcion) return { status: 200, body: { ok: true, ignorado: true } };
  if (suscripcion.ambiente !== ambiente.ambiente) {
    return { status: 200, body: { ok: true, ignorado: true } };
  }

  const paymentId = idPagoMp(pago);
  let remoto = null;
  try {
    remoto = await authorizedPaymentDesdePagoMp({
      preapprovalId: suscripcion.preapproval_id || preapprovalId,
      paymentId,
      fetchFn: deps.fetchFn,
    });
  } catch {
    return { status: 503, body: { ok: false } };
  }

  if (!remoto) {
    return { status: 200, body: { ok: true, ignorado: true, motivo: "sin_authorized_payment" } };
  }

  const aplicar = deps.aplicarAuthorizedPaymentRemoto || aplicarAuthorizedPaymentRemoto;
  const resultado = await aplicar({
    supabase,
    suscripcion,
    remoto,
    clave: xRequestId,
    ambiente: ambiente.ambiente,
  });

  if (!resultado.ok && resultado.codigo === "persistencia") {
    return { status: 503, body: { ok: false } };
  }

  return {
    status: 200,
    body: { ok: true, plus: resultado.ok ? "pago_recurrente" : "rechazado" },
  };
}
