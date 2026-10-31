import { esAdminExpoLegado } from "../expo-cannabis/admin-legado.js";

/**
 * Mecanismos anteriores que todavía conceden acceso, por módulo. TRANSITORIO.
 *
 * Importante: mientras exista una entrada acá, quitar un UUID de ADMIN_IDS NO revoca el acceso de
 * quien también entra por el mecanismo anterior. Para retirarlo: ver
 * auditorias/ADMIN-SPRINT1-AUTORIZACION.md ("Retirar el mecanismo anterior").
 *
 * Cada respaldo recibe (usuario, env) y debe responder exactamente `true`. Solo se consulta
 * después de validar que la cuenta no es anónima y tiene el correo confirmado.
 */
export const RESPALDOS_TRANSITORIOS = Object.freeze({
  expo: (usuario, env) => esAdminExpoLegado(usuario, env),
});
