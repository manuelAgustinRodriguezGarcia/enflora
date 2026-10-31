/** Detección del teclado virtual a partir del viewport, sin tocar el DOM. */

const TIPOS_SIN_TECLADO = new Set([
  "hidden",
  "checkbox",
  "radio",
  "file",
  "button",
  "submit",
  "reset",
  "image",
  "range",
  "color",
]);

/** Por debajo de esto no es un teclado: barra de URL o chrome del navegador. */
export const UMBRAL_TECLADO_ABRIR_PX = 150;

/** Histéresis para no reabrir la barra mientras el teclado todavía se está cerrando. */
export const UMBRAL_TECLADO_CERRAR_PX = 80;

export function entradaEditableActiva(activeElement) {
  if (!activeElement || typeof activeElement.tagName !== "string") {
    return false;
  }
  const tag = activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    if (tag === "INPUT" && TIPOS_SIN_TECLADO.has(activeElement.type)) {
      return false;
    }
    return !activeElement.readOnly && !activeElement.disabled;
  }
  return Boolean(activeElement.isContentEditable);
}

/**
 * Cuánto tapa el teclado el layout viewport.
 * Queda en 0 cuando `interactive-widget: resizes-content` ya encogió el layout,
 * para no desplazar dos veces los elementos fijos.
 */
export function solapeTecladoLayout({ innerHeight, visualViewport }) {
  if (!visualViewport || !Number.isFinite(innerHeight)) return 0;
  const { height, offsetTop } = visualViewport;
  if (!Number.isFinite(height)) return 0;
  const top = Number.isFinite(offsetTop) ? offsetTop : 0;
  return Math.max(0, Math.round(innerHeight - height - top));
}

/** Offset inferior legado: solo con entrada activa, sin umbral. */
export function calcularOffsetTecladoInferior(
  { innerHeight, visualViewport },
  { entradaActiva = false } = {},
) {
  if (!entradaActiva) return 0;
  return solapeTecladoLayout({ innerHeight, visualViewport });
}

function alturaVisible({ innerHeight, visualViewport }) {
  const height = visualViewport?.height;
  const top = Number.isFinite(visualViewport?.offsetTop) ? Math.max(0, visualViewport.offsetTop) : 0;
  const visible = Number.isFinite(height) ? height + top : innerHeight;
  if (!Number.isFinite(innerHeight)) return visible;
  return Math.max(innerHeight, visible);
}

/**
 * El teclado está abierto solo si el área visible se redujo de verdad
 * respecto de la altura sin teclado. El foco no alcanza: un teclado físico
 * puede enfocar un campo sin encoger el viewport.
 * Si ya estaba abierto, se mantiene mientras la reducción siga por encima
 * del umbral de cierre, aunque el foco pase de un input a otro.
 */
export function evaluarTecladoVirtual(
  { alturaBase, innerHeight, visualViewport },
  { entradaActiva = false, abiertoPrevio = false, admiteTecladoVirtual = true } = {},
) {
  const vv =
    visualViewport && Number.isFinite(visualViewport.height)
      ? visualViewport
      : null;
  if (!admiteTecladoVirtual || !vv || !Number.isFinite(innerHeight)) {
    const base = Number.isFinite(alturaBase) && alturaBase > 0 ? alturaBase : 0;
    return { abierto: false, offset: 0, alturaBase: base, reduccion: 0 };
  }

  const visible = alturaVisible({ innerHeight, visualViewport: vv });
  let base = Number.isFinite(alturaBase) && alturaBase > 0 ? alturaBase : visible;
  const reduccion = Math.max(0, Math.round(base - vv.height));
  const abierto = abiertoPrevio
    ? reduccion >= UMBRAL_TECLADO_CERRAR_PX
    : entradaActiva && reduccion >= UMBRAL_TECLADO_ABRIR_PX;
  const encogiendoConFoco = entradaActiva && visible < base - 8;
  if (!abierto && !encogiendoConFoco && Number.isFinite(visible) && visible > 0) {
    base = visible;
  }

  return {
    abierto,
    offset: abierto ? solapeTecladoLayout({ innerHeight, visualViewport: vv }) : 0,
    alturaBase: base,
    reduccion,
  };
}
