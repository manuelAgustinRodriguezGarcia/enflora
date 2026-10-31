/** PLAN 420 — precio comercial fijo (USD). */
export const PRECIO_PLUS_USD = 4.2;
export const PRECIO_PLUS_USD_CENTAVOS = 420;

export const ESTADOS_PLUS_INTERNO = {
  borrador: "borrador",
  pendienteCheckout: "pendiente_checkout",
  activa: "activa",
  pausada: "pausada",
  cancelada: "cancelada",
  vencida: "vencida",
  pastDue: "past_due",
};

/** Estados MP PreApproval frecuentes (consultar recurso remoto; no confiar solo en webhook). */
export const ESTADOS_MP_PREAPPROVAL = new Set([
  "pending",
  "authorized",
  "paused",
  "cancelled",
  "canceled",
]);
