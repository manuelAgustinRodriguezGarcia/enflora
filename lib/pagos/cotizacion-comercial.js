import {
  DIAS_ALERTA_COTIZACION,
  DIAS_VIGENCIA_COTIZACION,
  FUENTE_BNA,
  URL_BNA,
  obtenerCotizacionBilleteVendedor,
} from "./cotizacion-bna.js";
import { importeUsdEnArsCentavos } from "./dinero.js";

export { DIAS_ALERTA_COTIZACION, DIAS_VIGENCIA_COTIZACION, FUENTE_BNA, URL_BNA };

export const ENLACE_FUENTE_COTIZACION = {
  href: URL_BNA,
  etiqueta: "Banco Nación — dólar billete vendedor",
};

export function mapearCotizacionComercial(lectura) {
  if (!lectura?.ok) {
    return { ok: false, codigo: lectura?.codigo || "cotizacion_no_disponible" };
  }
  const { cotizacion, vigenteHasta, edadDias, advertenciaAntigua } = lectura;
  return {
    ok: true,
    fecha: cotizacion.publicadaEn,
    ventaEscala4: cotizacion.venta,
    vigenteHasta,
    edadDias,
    advertenciaAntigua: Boolean(advertenciaAntigua),
    fuente: cotizacion.fuente,
    tipo: cotizacion.tipo,
  };
}

export async function obtenerCotizacionComercial(ahora = new Date()) {
  const lectura = await obtenerCotizacionBilleteVendedor(ahora);
  return mapearCotizacionComercial(lectura);
}

/** Convierte USD a pesos ARS con la misma regla que el checkout (half-up a centavos). */
export function convertirUsdAArs(usd, cotizacion) {
  if (!cotizacion?.ok || !Number.isInteger(cotizacion.ventaEscala4)) return null;
  const centavosUsd = Math.round(Number(usd) * 100);
  if (!Number.isFinite(centavosUsd) || centavosUsd < 0) return null;
  const arsCentavos = importeUsdEnArsCentavos(centavosUsd, cotizacion.ventaEscala4);
  return arsCentavos / 100;
}

export function textoReferenciaCotizacion(cotizacion) {
  if (!cotizacion?.ok) {
    return "La referencia en pesos se confirma al pagar, con el billete vendedor del Banco Nación vigente en ese momento.";
  }
  const alerta = cotizacion.advertenciaAntigua
    ? " La publicación del Banco Nación tiene más de unos días; el importe final se confirma al pagar."
    : "";
  return `Referencia en ARS según dólar billete vendedor del Banco Nación (incluye fines de semana y feriados con la última publicación). Vigencia máxima ${DIAS_VIGENCIA_COTIZACION} días desde esa publicación. El importe del checkout se congela al confirmar la compra.${alerta}`;
}
