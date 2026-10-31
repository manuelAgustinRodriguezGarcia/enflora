const EVENTOS_ORDEN = new Set(["order", "orders", "orders_v2"]);
const EVENTOS_SUSCRIPCION = new Set([
  "subscription_preapproval",
  "subscription_authorized_payment",
  "preapproval",
]);

export function eventoOrdenWebhook({ type, topic } = {}) {
  const valor = String(type || topic || "").trim().toLowerCase();
  return EVENTOS_ORDEN.has(valor);
}

export function eventoSuscripcionWebhook({ type, topic } = {}) {
  const valor = String(type || topic || "").trim().toLowerCase();
  return EVENTOS_SUSCRIPCION.has(valor);
}

export function eventoPagoRecurrenteWebhook({ type, topic } = {}) {
  const valor = String(type || topic || "").trim().toLowerCase();
  return valor === "payment";
}

export function ambienteCompatibleConAviso(ambiente, liveMode) {
  if (typeof liveMode !== "boolean") return true;
  return liveMode === (ambiente === "produccion");
}
