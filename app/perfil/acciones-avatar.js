"use server";

import { revalidatePath } from "next/cache";
import { persistirAvatar, quitarAvatar, firmarAvatar } from "@/lib/perfil/avatar-servidor";
import { MAX_BYTES_AVATAR } from "@/lib/perfil/avatar";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida, obtenerUsuario } from "@/lib/supabase/servidor";

function refrescarPerfil() {
  revalidatePath("/perfil");
  revalidatePath("/", "layout");
}

async function bytesDeFormulario(formulario) {
  const archivo = formulario?.get?.("foto");
  if (!archivo || typeof archivo.arrayBuffer !== "function" || typeof archivo.size !== "number") {
    return { error: "No se pudo leer la foto." };
  }
  if (archivo.size < 1 || archivo.size > MAX_BYTES_AVATAR) {
    return { error: "La foto procesada es demasiado pesada." };
  }
  return { error: "", bytes: new Uint8Array(await archivo.arrayBuffer()) };
}

export async function guardarFotoPerfil(formulario) {
  if (!configuracionLista()) return { error: "Falta la configuración de Supabase." };

  const lectura = await bytesDeFormulario(formulario);
  if (lectura.error) return { error: lectura.error };

  const supabase = await crearClienteServidor();
  const user = await obtenerUsuario();
  if (!user) return { error: "No hay sesión." };

  const resultado = await persistirAvatar(supabase, user.id, lectura.bytes);
  if (resultado.error) {
    console.error("guardar_foto_perfil", resultado.error);
    return { error: resultado.error };
  }

  refrescarPerfil();
  return { error: "", url: resultado.url, expira: resultado.expira };
}

export async function eliminarFotoPerfil() {
  if (!configuracionLista()) return { error: "Falta la configuración de Supabase." };

  const supabase = await crearClienteServidor();
  const user = await obtenerUsuario();
  if (!user) return { error: "No hay sesión." };

  const resultado = await quitarAvatar(supabase, user.id);
  if (resultado.error) {
    console.error("eliminar_foto_perfil", resultado.error);
    return { error: resultado.error };
  }

  refrescarPerfil();
  return { error: "" };
}

export async function renovarUrlAvatar() {
  if (!configuracionLista()) return { url: "", expira: 0 };

  const supabase = await crearClienteServidor();
  const user = await obtenerSesionRapida();
  if (!user) return { url: "", expira: 0 };

  const { data, error } = await supabase
    .from("perfiles")
    .select("avatar_ruta")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data?.avatar_ruta) return { url: "", expira: 0 };
  return firmarAvatar(supabase, user.id, data.avatar_ruta);
}
