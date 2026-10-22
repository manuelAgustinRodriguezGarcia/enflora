const EVENTOS_ORDEN = new Set(["order", "orders", "orders_v2"]);

export function eventoOrdenWebhook({ type, topic } = {}) {
  const valor = String(type || topic || "").trim().toLowerCase();
  return EVENTOS_ORDEN.has(valor);
}

export function ambienteCompatibleConAviso(ambiente, liveMode) {
  if (typeof liveMode !== "boolean") return true;
  return liveMode === (ambiente === "produccion");
}
