import { centavosADecimal, importeUsdEnArsCentavos, mismosImportes } from "@/lib/pagos/dinero";
import { PRECIO_PLUS_USD, PRECIO_PLUS_USD_CENTAVOS } from "@/lib/pagos/plus/constantes";

export function importePlusCentavos(escalaVenta) {
  return importeUsdEnArsCentavos(PRECIO_PLUS_USD_CENTAVOS, escalaVenta);
}

/** Importe ARS para MP y UI: pesos con dos decimales (misma regla que pago único). */
export function importePlusDecimalOrden(escalaVenta) {
  const centavos = importePlusCentavos(escalaVenta);
  if (!Number.isFinite(centavos) || centavos <= 0) return null;
  return centavosADecimal(centavos);
}

/**
 * Bloquea checkout si el importe no coincide con US$4,20 × cotización BNA (escala 4).
 */
export function validarCoherenciaImportePlus({ importeDecimal, escalaVenta }) {
  if (!Number.isInteger(escalaVenta) || escalaVenta <= 0) {
    return { ok: false, codigo: "cotizacion_invalida" };
  }
  const esperado = importePlusDecimalOrden(escalaVenta);
  if (!esperado) return { ok: false, codigo: "importe_invalido" };
  if (!importeDecimal || !mismosImportes(esperado, importeDecimal)) {
    return {
      ok: false,
      codigo: "importe_incoherente",
      esperado,
      recibido: importeDecimal,
      precioUsd: PRECIO_PLUS_USD,
    };
  }
  return { ok: true, importeDecimal: esperado };
}
