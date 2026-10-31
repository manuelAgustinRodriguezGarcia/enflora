import "server-only";
import { obtenerUsuario } from "@/lib/supabase/servidor";
import { ErrorAdminNoAutorizado, crearNucleoAdmin } from "./nucleo.js";
import { RESPALDOS_TRANSITORIOS } from "./respaldos.js";

/**
 * API de autorización administrativa para la aplicación (solo servidor).
 *
 * Toda operación privilegiada debe pasar por acá en el propio servidor (Server Action, Route
 * Handler o página): un layout o el proxy no alcanzan.
 *
 * - La identidad SIEMPRE sale de Supabase Auth (`obtenerUsuario` → `getUser()`, verificación de
 *   red). Estas funciones no aceptan usuarios, variables de entorno ni respaldos del llamador.
 * - El resultado es una credencial opaca y de vida corta (ver nucleo.js) que exigen las
 *   funciones de datos (`servicio.js`, `lib/expo-cannabis/admin.js`).
 * - Para tests de las reglas existe `crearNucleoAdmin` (nucleo.js), que la aplicación no importa.
 */
const nucleo = crearNucleoAdmin({
  leerUsuario: obtenerUsuario,
  env: process.env,
  respaldos: RESPALDOS_TRANSITORIOS,
});

export { ErrorAdminNoAutorizado };

/** { ok: true, credencial, via } | { ok: false, motivo, estado } */
export function obtenerAdmin(modulo) {
  return nucleo.obtenerAdmin(modulo);
}

/** Devuelve la credencial o lanza ErrorAdminNoAutorizado. */
export function requerirAdmin(modulo) {
  return nucleo.requerirAdmin(modulo);
}

/** Valida una credencial para `modulo` (obligatorio). Devuelve { id, modulo, via } o lanza. */
export function verificarCredencial(credencial, modulo) {
  return nucleo.verificar(credencial, modulo);
}
