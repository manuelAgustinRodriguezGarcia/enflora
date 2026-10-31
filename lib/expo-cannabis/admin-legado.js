import { contarEntradasInvalidas, normalizarIds } from "../admin/reglas.js";

/**
 * MECANISMO ANTERIOR del admin de Expo Cannabis, conservado solo durante la transición a la
 * autorización central (lib/admin). NO ampliar ni reutilizar en módulos nuevos.
 *
 * Reconoce a un administrador por: un correo fijo en el código, EXPO_ADMIN_EMAILS o EXPO_ADMIN_IDS.
 * Las validaciones de cuenta (no anónima, correo confirmado) las aplica la autorización central
 * antes de consultar este respaldo.
 *
 * SIGUE ACTIVO: lo consulta lib/admin/respaldos.js para el módulo expo cuando el UUID no está en\n * ADMIN_IDS / ADMIN_IDS_EXPO. Por eso quitar un UUID de ADMIN_IDS NO revoca el acceso de quien\n * entra por correo fijo, EXPO_ADMIN_EMAILS o EXPO_ADMIN_IDS.\n *\n * Para retirarlo: ver auditorias/ADMIN-SPRINT1-AUTORIZACION.md (sección "Retirar el mecanismo anterior").
 */
export const CORREO_ADMIN_LEGADO = "marg.ec256@gmail.com";

export function correosAdminLegado(env = process.env) {
  const extras = String(env?.EXPO_ADMIN_EMAILS || "")
    .split(",")
    .map((correo) => correo.trim().toLowerCase())
    .filter((correo) => correo.includes("@"));
  return [CORREO_ADMIN_LEGADO, ...extras];
}

export function idsAdminLegado(env = process.env) {
  return normalizarIds(env?.EXPO_ADMIN_IDS);
}

export function idsLegadoInvalidos(env = process.env) {
  return contarEntradasInvalidas(env?.EXPO_ADMIN_IDS);
}

export function esAdminExpoLegado(usuario, env = process.env) {
  const correo = String(usuario?.email || "").trim().toLowerCase();
  if (correo && correosAdminLegado(env).includes(correo)) return true;
  const id = String(usuario?.id || "").trim().toLowerCase();
  return idsAdminLegado(env).includes(id);
}
