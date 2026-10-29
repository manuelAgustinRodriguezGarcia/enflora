/** ¿Hay conversación en /flora que se pierde al navegar sin guardar el chat? */

export function conversacionFloraPendiente({
  mensajes = [],
  bannerContinuar = null,
  entrada = "",
  adjuntos = [],
  cargando = false,
}) {
  if (cargando) return true;
  if (bannerContinuar) return true;
  if (String(entrada || "").trim()) return true;
  if (adjuntos?.length) return true;
  return mensajes.some((m) => m.id !== "bienvenida");
}

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
