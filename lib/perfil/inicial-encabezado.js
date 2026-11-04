import "server-only";

import { AVATAR_VACIO, inicialDePerfil, leerIdentidadPerfil } from "@/lib/perfil/identidad";

/** Inicial y foto del encabezado. Reutiliza la lectura de perfil del request. */
export async function leerEncabezadoPerfil(usuarioId, email) {
  const identidad = await leerIdentidadPerfil();
  const propio = identidad?.user?.id === usuarioId ? identidad : null;
  return {
    inicial: inicialDePerfil(propio?.perfil, email),
    avatar: propio?.avatar || AVATAR_VACIO,
  };
}
