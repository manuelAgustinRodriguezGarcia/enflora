export const EVENTO_GUIA = "enflora:guia";

export function publicarGuia(detalle) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_GUIA, { detail: detalle }));
}
