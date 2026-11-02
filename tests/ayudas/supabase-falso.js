import { MODULOS_ADMIN } from "../../lib/admin/reglas.js";
import { __fijarCookies, __restablecerCookies } from "../stubs/next-headers.js";

/**
 * Entorno de prueba que ejercita el código de PRODUCCIÓN de punta a punta sin red ni datos reales:
 *  - Variables de Supabase falsas (host `.test`, claves inventadas).
 *  - Una sesión en cookies, tal como las deja @supabase/ssr.
 *  - Un `fetch` global falso que hace de Supabase Auth (`/auth/v1/user` devuelve al usuario dado)
 *    y de PostgREST (`/rest/v1/*`), y registra cada solicitud saliente.
 */
export const URL_FALSA = "https://proyecto-falso.supabase.test";
export const CLAVE_SERVICIO_FALSA = "clave-de-servicio-falsa-para-tests";
const CLAVE_ANON_FALSA = "clave-anon-falsa-para-tests";

const CLAVES_ENTORNO = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_IDS",
  "EXPO_ADMIN_IDS",
  "EXPO_ADMIN_EMAILS",
  ...MODULOS_ADMIN.map((modulo) => `ADMIN_IDS_${modulo.toUpperCase()}`),
];

function base64url(texto) {
  return Buffer.from(texto).toString("base64url");
}

function crearJwt(usuario) {
  const cabecera = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const carga = base64url(
    JSON.stringify({
      sub: usuario.id,
      aud: "authenticated",
      role: "authenticated",
      email: usuario.email,
      is_anonymous: usuario.is_anonymous === true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${cabecera}.${carga}.firma-falsa`;
}

function respuestaJson(cuerpo, estado = 200, cabeceras = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json", ...cabeceras },
  });
}

/**
 * @param {object} opciones
 * @param {object|null} opciones.usuario   Usuario que devuelve Auth; null = sin sesión.
 * @param {boolean} [opciones.servicio]    Define SUPABASE_SERVICE_ROLE_KEY (por defecto sí).
 * @param {Record<string,string>} [opciones.entorno]  Variables adicionales (ADMIN_IDS, etc.).
 * @param {(solicitud:{metodo:string,url:URL,cuerpo:any})=>Response|null} [opciones.rest]
 *        Respuesta personalizada de PostgREST; por defecto `[]`.
 * @param {boolean} [opciones.authCaido]   Auth responde 500.
 */
export function instalarSupabaseFalso({ usuario, servicio = true, entorno = {}, rest = null, authCaido = false }) {
  const previoEntorno = Object.fromEntries(CLAVES_ENTORNO.map((clave) => [clave, process.env[clave]]));
  const previoFetch = globalThis.fetch;
  const solicitudes = [];

  for (const clave of CLAVES_ENTORNO) delete process.env[clave];
  process.env.NEXT_PUBLIC_SUPABASE_URL = URL_FALSA;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = CLAVE_ANON_FALSA;
  if (servicio) process.env.SUPABASE_SERVICE_ROLE_KEY = CLAVE_SERVICIO_FALSA;
  Object.assign(process.env, entorno);

  if (usuario) {
    const sesion = {
      access_token: crearJwt(usuario),
      refresh_token: "refresh-falso",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: usuario,
    };
    const nombre = `sb-${new URL(URL_FALSA).hostname.split(".")[0]}-auth-token`;
    __fijarCookies([{ name: nombre, value: `base64-${base64url(JSON.stringify(sesion))}` }]);
  } else {
    __fijarCookies([]);
  }

  globalThis.fetch = async (entrada, inicio) => {
    const url = new URL(typeof entrada === "string" || entrada instanceof URL ? String(entrada) : entrada.url);
    const metodo = String(inicio?.method ?? "GET").toUpperCase();
    const cabeceras = new Headers(inicio?.headers);
    solicitudes.push({
      metodo,
      url,
      cuerpo: inicio?.body,
      autorizacion: cabeceras.get("authorization"),
      apikey: cabeceras.get("apikey"),
    });

    if (url.pathname === "/auth/v1/user") {
      if (authCaido || !usuario) return respuestaJson({ message: "fallo" }, authCaido ? 500 : 401);
      return respuestaJson(usuario);
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const personalizada = rest?.({ metodo, url, cuerpo: inicio?.body });
      return personalizada ?? respuestaJson([], 200, { "content-range": "0-0/0" });
    }
    return respuestaJson({}, 404);
  };

  return {
    /** Solicitudes que llegaron a PostgREST (`/rest/v1/*`). */
    get rest() {
      return solicitudes.filter((solicitud) => solicitud.url.pathname.startsWith("/rest/v1/"));
    },
    get todas() {
      return solicitudes;
    },
    restaurar() {
      globalThis.fetch = previoFetch;
      __restablecerCookies();
      for (const clave of CLAVES_ENTORNO) {
        if (previoEntorno[clave] === undefined) delete process.env[clave];
        else process.env[clave] = previoEntorno[clave];
      }
    },
  };
}

/** Ejecuta `tarea` con el entorno instalado y lo restablece siempre. */
export async function conSupabaseFalso(opciones, tarea) {
  const entorno = instalarSupabaseFalso(opciones);
  try {
    return await tarea(entorno);
  } finally {
    entorno.restaurar();
  }
}
