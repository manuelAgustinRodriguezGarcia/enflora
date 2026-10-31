import { createHash } from "node:crypto";
import { urlPublica } from "./ambiente.js";
import { textoImporteOrden } from "./dinero.js";

/** Texto en resumen de tarjeta (máx. 13 caracteres según Orders API). */
const DESCRIPTOR_ESTADO_CUENTA = "ENFLORA";

/** Descripción comercial del ítem (industria aplicaciones / servicios digitales). */
const DESCRIPCION_ITEM_LICENCIA =
  "Licencia de seguimiento ENFLORA para un ciclo de cultivo";

/** Categoría MP documentada para servicios digitales (industry data). */
const CATEGORIA_ITEM_LICENCIA = "services";

export function claveIdempotenciaOrden(pagoId, email) {
  const correo = String(email || "").trim().toLowerCase();
  if (!correo) return String(pagoId);
  const marca = createHash("sha256").update(correo).digest("hex").slice(0, 12);
  return `${pagoId}:${marca}`;
}

function textoPagador(valor) {
  const limpio = String(valor ?? "").trim();
  return limpio || null;
}

/** Fecha real de registro; null si falta o no es parseable (no se inventa). */
export function fechaRegistroPagadorIso8601(valor) {
  if (valor == null || valor === "") return null;
  const ms = Date.parse(String(valor));
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function agregarDatosPagador(cuerpo, { email, nombre, apellido, fechaRegistro }) {
  const correo = String(email || "").trim();
  const firstName = textoPagador(nombre);
  const lastName = textoPagador(apellido);
  const registro = fechaRegistroPagadorIso8601(fechaRegistro);

  if (correo || firstName || lastName) {
    cuerpo.payer = {};
    if (correo) cuerpo.payer.email = correo;
    if (firstName) cuerpo.payer.first_name = firstName;
    if (lastName) cuerpo.payer.last_name = lastName;
  }

  if (registro) {
    cuerpo.additional_info = {
      "payer.registration_date": registro,
    };
  }
}

export function cuerpoOrdenLicencia({
  pagoId,
  importeDecimal,
  email,
  nombre,
  apellido,
  fechaRegistro,
}) {
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
        description: DESCRIPCION_ITEM_LICENCIA,
        category_id: CATEGORIA_ITEM_LICENCIA,
        unit_price: importe,
        quantity: 1,
        external_code: "licencia-cultivo",
      },
    ],
    config: {
      statement_descriptor: DESCRIPTOR_ESTADO_CUENTA,
      online: {
        success_url: retorno,
        pending_url: retorno,
        failure_url: retorno,
        callback_url: `${base}/api/mercadopago/webhook`,
        auto_return: "all",
      },
    },
  };
  agregarDatosPagador(cuerpo, { email, nombre, apellido, fechaRegistro });
  return cuerpo;
}
