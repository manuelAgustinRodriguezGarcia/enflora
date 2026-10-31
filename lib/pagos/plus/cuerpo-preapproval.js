import { urlPublica } from "@/lib/pagos/ambiente";
import { PRECIO_PLUS_USD } from "@/lib/pagos/plus/constantes";

/**
 * Alta Plus sin plan MP: status pending → init_point (checkout suscripción).
 * Monto en ARS fijado en servidor; MP no convierte USD/BNA automáticamente.
 */
export function cuerpoPreapprovalPlusPendiente({
  externalReference,
  payerEmail,
  importeDecimalArs,
  backUrl,
  razon = "PLAN 420 Enflora",
}) {
  const importe = Number(importeDecimalArs);
  if (!externalReference || !payerEmail || !Number.isFinite(importe) || importe <= 0) {
    return { ok: false, codigo: "datos_invalidos" };
  }

  const base = urlPublica().replace(/\/$/, "");
  const back = (backUrl || `${base}/pagos/plus/resultado`).replace(/\/$/, "");

  return {
    ok: true,
    body: {
      reason: razon,
      external_reference: externalReference,
      payer_email: payerEmail,
      back_url: back,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: importe,
        currency_id: "ARS",
      },
      metadata: {
        producto: "plus_enflora",
        precio_usd: String(PRECIO_PLUS_USD),
      },
    },
  };
}

export function cuerpoActualizarImportePreapproval(importeDecimalArs) {
  const importe = Number(importeDecimalArs);
  if (!Number.isFinite(importe) || importe <= 0) return { ok: false, codigo: "importe_invalido" };
  return {
    ok: true,
    body: {
      auto_recurring: {
        transaction_amount: importe,
        currency_id: "ARS",
      },
    },
  };
}
