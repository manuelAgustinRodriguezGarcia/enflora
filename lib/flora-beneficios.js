export const TANDA_GALERIA_GRATUITO = 12;
export const TANDA_GALERIA_PLUS = 36;

export function evaluarNivelBeneficiosFlora({ plusActivo, licenciaEnUnidad }) {
  if (plusActivo || licenciaEnUnidad) return "plus";
  return "gratuito";
}

export function tandaGaleriaFlora(nivel) {
  return nivel === "plus" ? TANDA_GALERIA_PLUS : TANDA_GALERIA_GRATUITO;
}

export function acotarLimiteTandaGaleria(limiteSolicitado, tandaPermitida) {
  const tanda = Math.min(36, Math.max(1, tandaPermitida || TANDA_GALERIA_GRATUITO));
  const pedido = Number(limiteSolicitado);
  if (!Number.isFinite(pedido) || pedido <= 0) return tanda;
  return Math.min(tanda, Math.max(1, Math.trunc(pedido)));
}
