import { createHash } from "node:crypto";
import { urlPublica } from "./ambiente.js";
import { textoImporteOrden } from "./dinero.js";

export function claveIdempotenciaOrden(pagoId, email) {
  const correo = String(email || "").trim().toLowerCase();
  if (!correo) return String(pagoId);
  const marca = createHash("sha256").update(correo).digest("hex").slice(0, 12);
  return `${pagoId}:${marca}`;
}

export function cuerpoOrdenLicencia({ pagoId, importeDecimal, email }) {
  const importe = textoImporteOrden(importeDecimal);
  if (!importe) {
    const error = new Error("importe");
    error.codigo = "orden";
    throw error;
  }
  const base = urlPublica();
  const retorno = `${base}/pagos/resultado/${pagoId}`;
  const cuerpo = {
    type: "online",
    processing_mode: "manual",
    external_reference: pagoId,
    total_amount: importe,
    currency: "ARS",
    description: "Enflora licencia de un ciclo de cultivo",
    items: [
      {
        title: "Enflora - Licencia de un ciclo de cultivo",
        unit_price: importe,
        quantity: 1,
        external_code: "licencia-cultivo",
      },
    ],
    config: {
      online: {
        success_url: retorno,
        pending_url: retorno,
        failure_url: retorno,
        callback_url: `${base}/api/mercadopago/webhook`,
        auto_return: "all",
      },
    },
  };
  const correo = String(email || "").trim();
  if (correo) cuerpo.payer = { email: correo };
  return cuerpo;
}
