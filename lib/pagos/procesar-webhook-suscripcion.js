import { leerRecepcionPagos } from "./ambiente.js";
import { clientePagos } from "./datos.js";
import { ambienteCompatibleConAviso, eventoSuscripcionWebhook } from "./evento-webhook.js";
import { firmaWebhookValida } from "./firma.js";
import {
  aplicarAuthorizedPaymentRemoto,
  aplicarPreapprovalRemoto,
  buscarSuscripcionPorPreapproval,
  notificacionYaProcesada,
} from "./plus/aplicar-webhook-suscripcion.js";
import { obtenerAuthorizedPayment, obtenerPreapproval } from "./plus/preapproval-api.js";

function tipoSuscripcionWebhook({ type, topic } = {}) {
  return String(type || topic || "")
    .trim()
    .toLowerCase();
}

/**
 * Webhooks Plus: firma → idempotencia → GET recurso MP → persistencia. No acredita solo por aviso.
 */
export async function procesarWebhookSuscripcionEntrada(
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

  if (!eventoSuscripcionWebhook({ type, topic })) {
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

  const tipo = tipoSuscripcionWebhook({ type, topic });
  const fetchPreapproval = deps.obtenerPreapproval || obtenerPreapproval;
  const fetchAuthorized = deps.obtenerAuthorizedPayment || obtenerAuthorizedPayment;

  if (tipo === "subscription_preapproval" || tipo === "preapproval") {
    let remoto;
    try {
      remoto = await fetchPreapproval(dataId);
    } catch {
      return { status: 503, body: { ok: false } };
    }

    const { suscripcion } = await buscarSuscripcionPorPreapproval(supabase, remoto?.id || dataId);
    if (!suscripcion) return { status: 200, body: { ok: true, ignorado: true } };

    const aplicar = deps.aplicarPreapprovalRemoto || aplicarPreapprovalRemoto;
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
    return { status: 200, body: { ok: true, plus: resultado.ok ? "preapproval" : "rechazado" } };
  }

  if (tipo === "subscription_authorized_payment") {
    let remoto;
    try {
      remoto = await fetchAuthorized(dataId);
    } catch {
      return { status: 503, body: { ok: false } };
    }

    const preapprovalId = remoto?.preapproval_id || remoto?.preapprovalId;
    const { suscripcion } = await buscarSuscripcionPorPreapproval(supabase, preapprovalId);
    if (!suscripcion) return { status: 200, body: { ok: true, ignorado: true } };

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

    try {
      const remotoPre = await fetchPreapproval(suscripcion.preapproval_id);
      await (deps.aplicarPreapprovalRemoto || aplicarPreapprovalRemoto)({
        supabase,
        suscripcion,
        remoto: remotoPre,
        clave: `${xRequestId}:sync-pre`,
        ambiente: ambiente.ambiente,
      });
    } catch {
      /* próxima renovación se reconcilia en cron o retorno */
    }

    return { status: 200, body: { ok: true, plus: resultado.ok ? "pago_recurrente" : "rechazado" } };
  }

  return { status: 200, body: { ok: true, ignorado: true } };
}
