import {
  chatFloraTieneContenidoPerdible,
  requiereModalSalidaChatFlora,
} from "@/lib/flora-estado-persistencia-chat";

/** ¿Hay contenido en pantalla que se pierde al irte sin guardar (chat nuevo)? */
export function conversacionFloraPendiente(opciones) {
  return requiereModalSalidaChatFlora(opciones);
}

export { chatFloraTieneContenidoPerdible, requiereModalSalidaChatFlora };

export function esNavegacionSalidaChatFlora(pathnameActual, href) {
  if (pathnameActual !== "/flora") return false;
  if (!href || href.startsWith("#")) return false;

  let url;
  try {
    url = new URL(href, "http://local");
  } catch {
    return false;
  }

  const path = url.pathname;
  if (path === "/flora" && !url.search) return false;
  return true;
}
