import { eventoPagoRecurrenteWebhook, eventoSuscripcionWebhook } from "./evento-webhook.js";
import { procesarWebhookOrdenEntrada } from "./procesar-webhook-orden.js";
import { procesarWebhookPagoRecurrenteEntrada } from "./procesar-webhook-pago-recurrente.js";
import { procesarWebhookSuscripcionEntrada } from "./procesar-webhook-suscripcion.js";

/**
 * Punto único del route `/api/mercadopago/webhook`: Plus y Orders con firma e idempotencia propias.
 */
export async function procesarWebhookMercadoPagoEntrada(params, deps = {}) {
  if (eventoSuscripcionWebhook(params)) {
    return procesarWebhookSuscripcionEntrada(params, deps);
  }
  if (eventoPagoRecurrenteWebhook(params)) {
    return procesarWebhookPagoRecurrenteEntrada(params, deps);
  }
  return procesarWebhookOrdenEntrada(params, deps);
}
