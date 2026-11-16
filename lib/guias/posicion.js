const MARGEN = 8;

export function ajustarPopover(caja, limites) {
  const ancho = Math.max(0, caja.width);
  const alto = Math.max(0, caja.height);
  const maxLeft = Math.max(MARGEN, limites.ancho - ancho - MARGEN);
  const maxTop = Math.max(limites.safeTop, limites.techoNav - alto - MARGEN);
  const left = Math.min(Math.max(caja.left, MARGEN), maxLeft);
  const top = Math.min(Math.max(caja.top, limites.safeTop), maxTop);
  return {
    left,
    top,
    cabe: left === caja.left && top === caja.top,
  };
}

export function ladoPreferido(paso, rect, limites) {
  if (paso?.lado === "top" || paso?.lado === "bottom" || paso?.lado === "left" || paso?.lado === "right") {
    return paso.lado;
  }
  if (!rect) return "bottom";
  const espacioAbajo = limites.techoNav - rect.bottom;
  const espacioArriba = rect.top - limites.safeTop;
  if (espacioAbajo < 180 && espacioArriba > espacioAbajo) return "top";
  return "bottom";
}

export function limitesDesdeMedidas({
  ancho,
  alto,
  techoNav,
  safeTop = 12,
}) {
  return {
    ancho,
    alto,
    techoNav: Math.min(techoNav, alto),
    safeTop,
  };
}
