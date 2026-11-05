"use server";

import { AVATAR_VACIO, inicialDePerfil, leerIdentidadPerfil } from "@/lib/perfil/identidad";

/** Inicial y foto del botón de perfil cuando el layout no las trae en el primer render. */
export async function cargarEncabezadoPerfil() {
  const identidad = await leerIdentidadPerfil();
  if (!identidad?.user?.id) return null;

  return {
    inicial: inicialDePerfil(identidad.perfil, identidad.user.email),
    avatar: identidad.avatar || AVATAR_VACIO,
  };
}
