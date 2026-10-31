import { ESTADOS_PLUS_INTERNO } from "@/lib/pagos/plus/constantes";

const MAPA_ESTADO_MP_A_INTERNO = {
  pending: ESTADOS_PLUS_INTERNO.pendienteCheckout,
  authorized: ESTADOS_PLUS_INTERNO.activa,
  paused: ESTADOS_PLUS_INTERNO.pausada,
  cancelled: ESTADOS_PLUS_INTERNO.cancelada,
  canceled: ESTADOS_PLUS_INTERNO.cancelada,
};

export function estadoInternoDesdePreapprovalMp(estadoMp) {
  const clave = String(estadoMp || "")
    .trim()
    .toLowerCase();
  return MAPA_ESTADO_MP_A_INTERNO[clave] || null;
}

export function estadoPagoRecurrenteDesdeMp(estadoMp, detalle = "") {
  const estado = String(estadoMp || "")
    .trim()
    .toLowerCase();
  const det = String(detalle || "").toLowerCase();
  if (estado === "approved" || estado === "processed" || det === "accredited") {
    return "acreditado";
  }
  if (estado === "rejected" || estado === "cancelled" || estado === "canceled") {
    return "rechazado";
  }
  if (det.includes("refund") || estado === "refunded") return "reembolsado";
  if (det.includes("chargeback") || det.includes("contracargo")) return "contracargo";
  return "pendiente";
}

/** Prioriza el objeto payment anidado del authorized_payment o del GET /v1/payments. */
export function estadoPagoRecurrenteDesdeRemotoMp(remoto) {
  if (!remoto) return "pendiente";
  const anidado = remoto.payment;
  if (anidado && (anidado.status || anidado.status_detail)) {
    const desdeAnidado = estadoPagoRecurrenteDesdeMp(anidado.status, anidado.status_detail);
    if (desdeAnidado !== "pendiente") return desdeAnidado;
  }
  return estadoPagoRecurrenteDesdeMp(remoto.status, remoto.status_detail);
}

export function transicionEstadoInternoPermitida(desde, hacia) {
  if (!desde || !hacia || desde === hacia) return true;
  const orden = [
    ESTADOS_PLUS_INTERNO.borrador,
    ESTADOS_PLUS_INTERNO.pendienteCheckout,
    ESTADOS_PLUS_INTERNO.activa,
    ESTADOS_PLUS_INTERNO.pastDue,
    ESTADOS_PLUS_INTERNO.pausada,
    ESTADOS_PLUS_INTERNO.cancelada,
    ESTADOS_PLUS_INTERNO.vencida,
  ];
  const iDesde = orden.indexOf(desde);
  const iHacia = orden.indexOf(hacia);
  if (iDesde < 0 || iHacia < 0) return false;
  if (desde === ESTADOS_PLUS_INTERNO.cancelada && hacia === ESTADOS_PLUS_INTERNO.activa) return false;
  return true;
}
