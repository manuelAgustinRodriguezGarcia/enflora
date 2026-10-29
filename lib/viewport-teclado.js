/** Cálculo puro del offset inferior por teclado virtual (sin DOM). */

export function entradaEditableActiva(activeElement) {
  if (!activeElement) {
    return false;
  }
  const tag = activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    const tipo = activeElement.type;
    if (tag === "INPUT" && (tipo === "hidden" || tipo === "checkbox" || tipo === "radio" || tipo === "file")) {
      return false;
    }
    return !activeElement.readOnly && !activeElement.disabled;
  }
  return Boolean(activeElement.isContentEditable);
}

/**
 * Offset desde el borde inferior del layout viewport hasta el borde inferior visible.
 * Solo aplica con entrada editable activa; evita falsos positivos al ocultar la barra de URL en Chrome Android.
 */
export function calcularOffsetTecladoInferior(
  { innerHeight, visualViewport },
  { entradaActiva = false } = {},
) {
  if (!entradaActiva || !visualViewport || !Number.isFinite(innerHeight)) {
    return 0;
  }
  const { height, offsetTop } = visualViewport;
  if (!Number.isFinite(height)) return 0;
  const offset = innerHeight - height - (Number.isFinite(offsetTop) ? offsetTop : 0);
  return Math.max(0, Math.round(offset));
}
