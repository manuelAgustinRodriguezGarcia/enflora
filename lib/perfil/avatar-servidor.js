import { BUCKET_AVATARS, SEGUNDOS_URL_AVATAR, esUuidAvatar, rutaAvatar, rutaAvatarValida, validarBytesSubidaAvatar } from "@/lib/perfil/avatar";

function rutaDevuelta(data) {
  return typeof data === "string" ? data : "";
}

function mensajeSubida(error) {
  const texto = String(error?.message || "");
  if (/bucket|not found|does not exist/i.test(texto)) {
    return "No se pudo guardar la foto. Falta crear el almacenamiento de avatares.";
  }
  return "No se pudo subir la foto. Revisá tu conexión e intentá de nuevo.";
}

function mensajePerfil(error) {
  const texto = String(error?.message || "");
  if (/avatar_ruta|schema cache|column/i.test(texto)) {
    return "Falta aplicar la actualización de la base para la foto de perfil.";
  }
  if (/No se encontró el perfil/i.test(texto)) return "No se encontró el perfil.";
  if (/No hay sesión/i.test(texto)) return "No hay sesión.";
  return "No se pudo guardar la foto. Intentá de nuevo.";
}

async function borrarSiEsPropia(supabase, usuarioId, ruta) {
  if (!ruta || !rutaAvatarValida(ruta, usuarioId)) return;
  await supabase.storage.from(BUCKET_AVATARS).remove([ruta]);
}

export async function firmarAvatar(supabase, usuarioId, ruta) {
  if (!rutaAvatarValida(ruta, usuarioId)) return { url: "", expira: 0 };
  const { data, error } = await supabase.storage
    .from(BUCKET_AVATARS)
    .createSignedUrl(ruta, SEGUNDOS_URL_AVATAR);
  if (error || !data?.signedUrl) return { url: "", expira: 0 };
  return {
    url: data.signedUrl,
    expira: Date.now() + SEGUNDOS_URL_AVATAR * 1000,
  };
}

/**
 * Sube el recorte ya procesado y actualiza el perfil del usuario indicado.
 * El llamador tiene que pasar el id de la sesión, nunca uno enviado por el cliente.
 * Si el perfil no se actualiza, borra el archivo nuevo y deja la foto anterior.
 */
export async function persistirAvatar(supabase, usuarioId, bytes) {
  if (!esUuidAvatar(usuarioId)) return { error: "No hay sesión." };

  const validacion = validarBytesSubidaAvatar(bytes);
  if (validacion.error) return { error: validacion.error };

  const ruta = rutaAvatar(usuarioId, crypto.randomUUID(), validacion.extension);
  const { error: errorSubida } = await supabase.storage.from(BUCKET_AVATARS).upload(ruta, bytes, {
    contentType: validacion.tipo,
    cacheControl: "3600",
    upsert: false,
  });
  if (errorSubida) return { error: mensajeSubida(errorSubida) };

  const { data, error: errorPerfil } = await supabase.rpc("guardar_avatar_perfil", { ruta });
  if (errorPerfil) {
    await borrarSiEsPropia(supabase, usuarioId, ruta);
    return { error: mensajePerfil(errorPerfil) };
  }

  const anterior = rutaDevuelta(data);
  if (anterior && anterior !== ruta) await borrarSiEsPropia(supabase, usuarioId, anterior);

  const firma = await firmarAvatar(supabase, usuarioId, ruta);
  return { error: "", url: firma.url, expira: firma.expira };
}

/** Quita la referencia y, si la ruta es de este usuario, el archivo. */
export async function quitarAvatar(supabase, usuarioId) {
  if (!esUuidAvatar(usuarioId)) return { error: "No hay sesión." };

  const { data, error } = await supabase.rpc("quitar_avatar_perfil");
  if (error) {
    const texto = String(error.message || "");
    if (/No se encontró el perfil/i.test(texto)) return { error: "No se encontró el perfil." };
    if (/No hay sesión/i.test(texto)) return { error: "No hay sesión." };
    return { error: "No se pudo quitar la foto. Intentá de nuevo." };
  }

  await borrarSiEsPropia(supabase, usuarioId, rutaDevuelta(data));
  return { error: "" };
}
