import { RUTA_INICIO } from "@/lib/navegacion";
import { URL_SITIO } from "@/lib/seo";

export const ID_PWA = "/";
export const SCOPE_PWA = "/";
export const RUTA_ARRANQUE_PWA = RUTA_INICIO;
export const RUTA_MANIFIESTO_PWA = "/manifest.webmanifest";

export function urlManifiestoPwa() {
  return `${URL_SITIO}${RUTA_MANIFIESTO_PWA}`;
}

export function aplicacionWebInstalada(apps, origin) {
  if (!Array.isArray(apps) || typeof origin !== "string" || !origin) return false;
  return apps.some((app) => {
    if (!app || app.platform !== "webapp" || typeof app.url !== "string") return false;
    try {
      const url = new URL(app.url, origin);
      return url.origin === origin && url.pathname === RUTA_MANIFIESTO_PWA;
    } catch {
      return false;
    }
  });
}

export function scriptEntradaPwa() {
  const destino = JSON.stringify(RUTA_ARRANQUE_PWA);
  return `(function(){try{var ruta=location.pathname||"/";if(ruta.length>1)ruta=ruta.replace(/\\/+$/,"")||"/";if(ruta!=="/")return;if(/(?:^|[?&])(?:code|token_hash)=/.test(location.search||""))return;var consultar=window.matchMedia;var modo=function(nombre){return !!(consultar&&consultar(nombre).matches);};if(modo("(display-mode: standalone)")||modo("(display-mode: minimal-ui)")||window.navigator.standalone===true)location.replace(${destino});}catch(e){}})();`;
}

export const SCRIPT_ENTRADA_PWA = scriptEntradaPwa();
