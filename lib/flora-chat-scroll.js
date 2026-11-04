/** Distancia al fondo a partir de la cual el chat vuelve a seguir la respuesta. */
export const UMBRAL_SCROLL_INFERIOR_CHAT = 96;

/**
 * El seguimiento al final se suelta al subir, aunque el usuario siga cerca del borde.
 * Solo se recupera si baja y queda dentro del umbral.
 * Si el alto del contenido baja, el navegador recorta scrollTop: eso no es un gesto.
 */
export function anclajeTrasScrollUsuario({
  anclado,
  scrollTopPrevio,
  scrollTop,
  distanciaAlFinal,
  scrollHeightPrevio = null,
  scrollHeight = null,
  umbral = UMBRAL_SCROLL_INFERIOR_CHAT,
}) {
  const delta = scrollTop - scrollTopPrevio;
  const cercaDelFinal = distanciaAlFinal <= umbral;
  const alturaConocida =
    typeof scrollHeightPrevio === "number" && typeof scrollHeight === "number";
  if (alturaConocida && scrollHeight < scrollHeightPrevio - 1) return anclado;
  if (delta < -1) return false;
  if (delta > 1 && cercaDelFinal) return true;
  return anclado;
}
