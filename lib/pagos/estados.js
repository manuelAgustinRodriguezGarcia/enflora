const TERMINALES = new Set(["reembolsado", "contracargo"]);

export function estadoSiguiente(actual, propuesto) {
  if (!propuesto) return actual;
  if (actual === propuesto) return actual;
  if (TERMINALES.has(actual)) return actual;
  if (actual === "acreditado" && propuesto !== "reembolsado" && propuesto !== "contracargo") {
    return actual;
  }
  return propuesto;
}

const REEMBOLSO_CONFIRMADO = new Set(["approved", "refunded", "accredited"]);

export function operacionDeOrden(orden) {
  const pagos = orden?.transactions?.payments || [];
  const pago = pagos.find((item) => item?.reference_id || item?.reference?.id);
  const referencia = pago?.reference_id || pago?.reference?.id || "";
  return String(referencia || "").trim();
}

export function reembolsoConfirmado(orden) {
  const reembolsos = orden?.transactions?.refunds || [];
  return reembolsos.some((item) => REEMBOLSO_CONFIRMADO.has(item?.status));
}

export function resolverEstadoOrden(orden) {
  const pagos = orden?.transactions?.payments || [];
  const contracargos = orden?.transactions?.chargebacks || [];
  const estadosPago = pagos.map((pago) => pago.status);
  const contracargoActivo = contracargos.some(
    (item) => item.status && !["rejected", "cancelled", "canceled"].includes(item.status),
  );
  const acreditada =
    (orden?.status === "processed" && orden?.status_detail === "accredited") ||
    pagos.some(
      (pago) =>
        (pago.status === "approved" || pago.status === "processed") &&
        pago.status_detail === "accredited",
    );

  if (contracargoActivo || estadosPago.includes("charged_back")) return "contracargo";
  if (reembolsoConfirmado(orden) || estadosPago.includes("refunded")) return "reembolsado";
  if (acreditada) return "acreditado";
  if (
    estadosPago.includes("pending") ||
    estadosPago.includes("in_process") ||
    estadosPago.includes("action_required") ||
    orden?.status === "action_required"
  ) {
    return "pendiente";
  }
  if (
    orden?.status === "canceled" ||
    orden?.status === "cancelled" ||
    estadosPago.includes("cancelled") ||
    estadosPago.includes("canceled")
  ) {
    return "cancelado";
  }
  if (estadosPago.includes("rejected") || orden?.status === "rejected") return "rechazado";
  if (orden?.status === "created" || orden?.status === "processed") return "pendiente";
  return "pendiente";
}

export function evaluarOrdenRemota(pago, orden) {
  if (!orden?.id) return { ok: false, codigo: "orden_ausente" };
  if (pago.order_id && orden.id !== pago.order_id) return { ok: false, codigo: "orden_distinta" };
  if (String(orden.external_reference || "") !== String(pago.id)) {
    return { ok: false, codigo: "referencia" };
  }
  if (orden.currency && orden.currency !== "ARS") return { ok: false, codigo: "moneda" };
  if (pago.vendedor_mp && orden.user_id && String(pago.vendedor_mp) !== String(orden.user_id)) {
    return { ok: false, codigo: "vendedor" };
  }
  const propuesto = resolverEstadoOrden(orden);
  return {
    ok: true,
    estado: estadoSiguiente(pago.estado, propuesto),
    mpEstado: orden.status || null,
    detalle: orden.status_detail || null,
    vendedor: orden.user_id ? String(orden.user_id) : null,
    orderId: orden.id,
    importe: orden.total_amount || null,
    moneda: orden.currency || null,
  };
}
