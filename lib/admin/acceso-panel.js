import "server-only";
import { cache } from "react";
import { obtenerAdmin } from "./autorizacion.js";
import { MODULOS_ADMIN, MOTIVOS_ADMIN } from "./reglas.js";

/**
 * Módulos que la cuenta actual puede ver. Una sola pasada por request.
 * No consulta tablas: solo la autorización del Sprint 1.
 * Si falta la sesión, no se informa ningún módulo.
 */
export const resolverModulosAdmin = cache(async () => {
  const pares = await Promise.all(
    MODULOS_ADMIN.map(async (modulo) => {
      const resultado = await obtenerAdmin(modulo);
      return { modulo, resultado };
    }),
  );

  if (pares.some((par) => par.resultado.motivo === MOTIVOS_ADMIN.sinSesion)) {
    return { sesion: false, modulos: [] };
  }

  return {
    sesion: true,
    modulos: pares.filter((par) => par.resultado.ok).map((par) => par.modulo),
  };
});
