import "server-only";

import { cache } from "react";
import { firmarAvatar } from "@/lib/perfil/avatar-servidor";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

const COLUMNAS =
  "nombre, apellido, telefono, nombre_usuario, cambios_nombre_usuario, tipo_seguimiento, avatar_ruta";
const COLUMNAS_SIN_AVATAR =
  "nombre, apellido, telefono, nombre_usuario, cambios_nombre_usuario, tipo_seguimiento";

export const AVATAR_VACIO = { url: "", expira: 0 };

function columnaAvatarAusente(error) {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return /avatar_ruta/i.test(texto);
}

async function leerFilaPerfil(supabase, usuarioId) {
  const amplia = await supabase.from("perfiles").select(COLUMNAS).eq("id", usuarioId).maybeSingle();
  if (!amplia.error) return amplia;
  if (!columnaAvatarAusente(amplia.error)) return amplia;

  const basica = await supabase.from("perfiles").select(COLUMNAS_SIN_AVATAR).eq("id", usuarioId).maybeSingle();
  if (basica.error || !basica.data) return basica;
  return { data: { ...basica.data, avatar_ruta: null }, error: null };
}

export function inicialDePerfil(perfil, email) {
  const base = String(perfil?.nombre_usuario || perfil?.nombre || email || "").trim();
  return base.slice(0, 1).toUpperCase();
}

/** Una lectura de perfil por request, compartida por el encabezado y /perfil. */
export const leerIdentidadPerfil = cache(async () => {
  const user = await obtenerSesionRapida();
  if (!user) return null;

  const supabase = await crearClienteServidor();
  const lectura = await leerFilaPerfil(supabase, user.id);
  if (lectura.error) {
    return { user, perfil: null, avatar: AVATAR_VACIO, error: true };
  }

  const avatar = await firmarAvatar(supabase, user.id, lectura.data?.avatar_ruta);
  return { user, perfil: lectura.data, avatar, error: false };
});
