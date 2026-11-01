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

/** MP puede notificar el primer cobro antes de que GET /authorized_payments/{id} exista. */
const ESPERAS_AUTHORIZED_PAYMENT_MS = [200, 400];

function tipoSuscripcionWebhook({ type, topic } = {}) {
  return String(type || topic || "")
    .trim()
    .toLowerCase();
}

function httpDeError(error) {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : null;
}

function consultaAuthorizedTransitoria(error) {
  const http = httpDeError(error);
  if (http == null) return true;
  if (http === 404 || http === 408 || http === 409 || http === 425 || http === 429) return true;
  return http >= 500;
}

function tokenLog(valor, fallback) {
  const texto = String(valor || "");
  return /^[a-z0-9_.:-]{1,40}$/i.test(texto) ? texto : fallback;
}

function codigoConsulta(error) {
  const propio = tokenLog(error?.codigo, "");
  if (propio) return propio;
  const http = httpDeError(error);
  if (http == null) return "red";
  if (http === 404) return "no_encontrado";
  if (http === 429) return "limite";
  if (http >= 500) return "mp_5xx";
  return "mp_http";
}

function registrarFalloWebhookSuscripcion({ fase, codigo, http, tipo, intentos }) {
  const partes = [
    "fase=" + tokenLog(fase, "desconocida"),
    "codigo=" + tokenLog(codigo, "error"),
    "http=" + (http == null ? "-" : String(http)),
    "tipo=" + tokenLog(tipo, "-"),
  ];
  if (intentos != null) partes.push("intentos=" + String(intentos));
  console.error(`[mercadopago] webhook_suscripcion ${partes.join(" ")}`);
}

function falloServicio(detalle) {
  registrarFalloWebhookSuscripcion(detalle);
  return { status: 503, body: { ok: false } };
}

async function consultarAuthorizedPayment(fetchAuthorized, dataId, esperar) {
  const intentosMax = ESPERAS_AUTHORIZED_PAYMENT_MS.length + 1;
  let ultimo = null;
  let intentos = 0;
  for (let i = 0; i < intentosMax; i += 1) {
    intentos = i + 1;
    try {
      const remoto = await fetchAuthorized(dataId);
      if (remoto?.id) return { ok: true, remoto, intentos };
      ultimo = Object.assign(new Error("recurso_incompleto"), {
        status: 404,
        codigo: "recurso_incompleto",
      });
    } catch (error) {
      ultimo = error;
      if (!consultaAuthorizedTransitoria(error)) break;
    }
    if (i < ESPERAS_AUTHORIZED_PAYMENT_MS.length && consultaAuthorizedTransitoria(ultimo)) {
      await esperar(ESPERAS_AUTHORIZED_PAYMENT_MS[i]);
    }
  }
  return { ok: false, error: ultimo, intentos };
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
  const tipo = tipoSuscripcionWebhook({ type, topic });
  const firma = firmaWebhookValida({ xSignature, xRequestId, dataId, secret });
  if (!firma.ok) {
    if (firma.codigo === "sin_secreto") {
      return falloServicio({ fase: "firma", codigo: "sin_secreto", http: null, tipo });
    }
    return { status: 401, body: { ok: false } };
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
    return falloServicio({ fase: "ambiente", codigo: ambiente.codigo || "ambiente", http: null, tipo });
  }

  if (!ambienteCompatibleConAviso(ambiente.ambiente, aviso?.live_mode)) {
    return { status: 200, body: { ok: true, ignorado: true } };
  }

  const supabase = deps.clientePagos ? deps.clientePagos() : clientePagos();
  if (!supabase) {
    return falloServicio({ fase: "supabase", codigo: "sin_cliente", http: null, tipo });
  }

  if (await notificacionYaProcesada(supabase, xRequestId)) {
    return { status: 200, body: { ok: true, duplicada: true } };
  }

  const fetchPreapproval = deps.obtenerPreapproval || obtenerPreapproval;
  const fetchAuthorized = deps.obtenerAuthorizedPayment || obtenerAuthorizedPayment;
  const esperar = deps.esperar || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  if (tipo === "subscription_preapproval" || tipo === "preapproval") {
    let remoto;
    try {
      remoto = await fetchPreapproval(dataId);
    } catch (error) {
      return falloServicio({
        fase: "consulta_preapproval",
        codigo: codigoConsulta(error),
        http: httpDeError(error),
        tipo,
      });
    }

    const { suscripcion, error: errorBusqueda } = await buscarSuscripcionPorPreapproval(
      supabase,
      remoto?.id || dataId,
    );
    if (errorBusqueda) {
      return falloServicio({
        fase: "lectura_suscripcion",
        codigo: tokenLog(errorBusqueda.code, "lectura"),
        http: null,
        tipo,
      });
    }
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
      return falloServicio({
        fase: "persistencia_preapproval",
        codigo: resultado.codigoDb || "persistencia",
        http: null,
        tipo,
      });
    }
    return { status: 200, body: { ok: true, plus: resultado.ok ? "preapproval" : "rechazado" } };
  }

  if (tipo === "subscription_authorized_payment") {
    const consulta = await consultarAuthorizedPayment(fetchAuthorized, dataId, esperar);
    if (!consulta.ok) {
      return falloServicio({
        fase: "consulta_authorized_payment",
        codigo: codigoConsulta(consulta.error),
        http: httpDeError(consulta.error),
        tipo,
        intentos: consulta.intentos,
      });
    }

    const remoto = consulta.remoto;
    const preapprovalId = remoto?.preapproval_id || remoto?.preapprovalId;
    const { suscripcion, error: errorBusqueda } = await buscarSuscripcionPorPreapproval(
      supabase,
      preapprovalId,
    );
    if (errorBusqueda) {
      return falloServicio({
        fase: "lectura_suscripcion",
        codigo: tokenLog(errorBusqueda.code, "lectura"),
        http: null,
        tipo,
      });
    }
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
      return falloServicio({
        fase: "persistencia_authorized_payment",
        codigo: resultado.codigoDb || "persistencia",
        http: null,
        tipo,
      });
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
