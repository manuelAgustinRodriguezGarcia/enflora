import "server-only";
import { createClient } from "@supabase/supabase-js";
import { verificarCredencial } from "./autorizacion.js";
import { ACCESO_DATOS_ADMIN, evaluarSolicitudAdmin } from "./politica.js";

export { ACCESO_DATOS_ADMIN };

/**
 * Único punto de creación del cliente con service role para operaciones administrativas.
 *
 * Defensas, de afuera hacia adentro:
 *  1. Exige una credencial vigente emitida para el módulo indicado (autorizacion.js).
 *  2. No entrega el cliente de Supabase: la fachada solo tiene `from` y `rpc`, con la lista de
 *     tablas y RPC del módulo (política en politica.js). Sin `auth`, `storage` ni `functions`.
 *  3. La barrera efectiva está en el TRANSPORTE: el cliente se crea con un `fetch` propio que
 *     valida cada solicitud HTTP justo antes de enviarla (destino, ruta, tabla/RPC, método,
 *     columnas, relaciones embebidas, esquema, filtros por id en escrituras). Como la clave de
 *     servicio solo se agrega dentro de ese camino, mutar `builder.url`, llamar a
 *     `builder.fetch` o armar consultas distintas no la saca de la política.
 *  4. Las solicitudes bloqueadas se registran con el motivo (sin URL, datos ni claves).
 *
 * El resultado de `from()` es un constructor PostgREST: solo lo deben recibir módulos de lib/
 * (p. ej. lib/expo-cannabis/*). Páginas, acciones y componentes usan funciones específicas y no
 * importan este archivo (lo verifica un test). Límites de seguridad: ver politica.js.
 */

/**
 * Fábrica con dependencias inyectables. Es el punto de prueba: la aplicación usa
 * `crearClienteRestringido`, que fija estas dependencias y no acepta opciones.
 */
export function crearServicioDatosAdmin({
  verificar,
  env,
  fetchBase = (...argumentos) => globalThis.fetch(...argumentos),
  crearSupabase = createClient,
  advertir = (mensaje) => console.warn(mensaje),
}) {
  return function crearClienteRestringido(credencial, modulo) {
    const datos = verificar(credencial, modulo);

    const politica = Object.hasOwn(ACCESO_DATOS_ADMIN, datos.modulo) ? ACCESO_DATOS_ADMIN[datos.modulo] : null;
    if (!politica) throw new Error("modulo_sin_acceso_a_datos");

    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !clave) return null;

    let destino;
    try {
      const analizada = new URL(url);
      destino = { origen: analizada.origin, prefijo: analizada.pathname.replace(/\/+$/, "") };
    } catch {
      return null;
    }

    function fetchRestringido(entrada, inicio) {
      const esPeticion = typeof Request !== "undefined" && entrada instanceof Request;
      const solicitud = {
        metodo: inicio?.method ?? (esPeticion ? entrada.method : "GET"),
        url: esPeticion ? entrada.url : String(entrada),
        cabeceras: new Headers(inicio?.headers ?? (esPeticion ? entrada.headers : undefined)),
        cuerpo: inicio?.body,
      };
      const veredicto = evaluarSolicitudAdmin(politica, solicitud, destino);
      if (!veredicto.ok) {
        try {
          advertir(`[admin] Solicitud a Supabase bloqueada (módulo ${datos.modulo}): ${veredicto.motivo}`);
        } catch {
          // Registrar nunca debe impedir el bloqueo.
        }
        // Respuesta 403 y no un rechazo: postgrest-js reintenta las lecturas cuando el fetch falla
        // (1 s, 2 s y 4 s) y eso multiplicaría el aviso y la demora de una solicitud ya prohibida.
        return Promise.resolve(
          new Response(JSON.stringify({ message: `transporte_no_permitido:${veredicto.motivo}`, code: "ADMIN_BLOQUEADO" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return fetchBase(entrada, inicio);
    }

    const base = crearSupabase(url, clave, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchRestringido },
    });

    return Object.freeze({
      from(tabla) {
        if (typeof tabla !== "string" || !Object.hasOwn(politica.tablas, tabla)) throw new Error("tabla_no_permitida");
        return base.from(tabla);
      },
      rpc(nombre, argumentos) {
        if (typeof nombre !== "string" || !politica.rpcs.includes(nombre)) throw new Error("rpc_no_permitida");
        return base.rpc(nombre, argumentos);
      },
    });
  };
}

/** Cliente restringido de producción: `modulo` es obligatorio y debe coincidir con la credencial. */
export function crearClienteRestringido(credencial, modulo) {
  return crearServicioDatosAdmin({ verificar: verificarCredencial, env: process.env })(credencial, modulo);
}
