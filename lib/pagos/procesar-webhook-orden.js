import { leerRecepcionPagos } from "./ambiente.js";
import { aplicarEvaluacion } from "./aplicar.js";
import { clientePagos } from "./datos.js";
import { ambienteCompatibleConAviso, eventoOrdenWebhook } from "./evento-webhook.js";
import { firmaWebhookValida } from "./firma.js";
import { obtenerOrden } from "./orden.js";

/**
 * Procesa un aviso webhook de Orders. Pensado para route handler y tests con deps inyectadas.
 */
export async function procesarWebhookOrdenEntrada(
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

  if (!eventoOrdenWebhook({ type, topic })) {
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

  const fetchOrden = deps.obtenerOrden || obtenerOrden;
  let orden;
  try {
    orden = await fetchOrden(dataId);
  } catch {
    return { status: 503, body: { ok: false } };
  }

  const referencia = String(orden?.external_reference || "");
  if (!referencia) return { status: 200, body: { ok: true, ignorado: true } };

  const { data: pago, error } = await supabase
    .from("pagos")
    .select("*")
    .eq("id", referencia)
    .maybeSingle();

  if (error || !pago) return { status: 200, body: { ok: true, ignorado: true } };
  if (pago.ambiente !== ambiente.ambiente) return { status: 200, body: { ok: true, ignorado: true } };

  const aplicar = deps.aplicarEvaluacion || aplicarEvaluacion;
  const resultado = await aplicar({
    pago,
    orden,
    clave: xRequestId,
  });

  if (!resultado?.ok && resultado?.codigo === "persistencia") {
    return { status: 503, body: { ok: false } };
  }

  return { status: 200, body: { ok: true, duplicada: Boolean(resultado?.duplicada) } };
}
