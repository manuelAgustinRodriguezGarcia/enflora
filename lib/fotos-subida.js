// Subida de fotos a Storage desde el navegador (usa la sesión del usuario y las políticas RLS).
// Está separado de lib/fotos-cliente.js para que la demo, que comparte el formulario, no importe Supabase.
import { BUCKET_FOTOS, extensionDeTipo, rutaFotoRegistro, rutaPortadaUnidad } from "@/lib/fotos";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

async function subirArchivo(supabase, ruta, blob) {
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(ruta, blob, {
    contentType: blob.type,
    cacheControl: "3600",
    upsert: false,
  });
  return error ? error.message || "No se pudo subir el archivo." : "";
}

export async function borrarArchivosSubidos(rutas) {
  const lista = (rutas || []).filter(Boolean);
  if (lista.length === 0) return;
  try {
    await crearClienteNavegador().storage.from(BUCKET_FOTOS).remove(lista);
  } catch {
    // Si falla la limpieza queda un archivo huérfano; scripts/limpiar-fotos-huerfanas.mjs lo recoge.
  }
}

function idFoto() {
  return globalThis.crypto.randomUUID();
}

// Sube foto + miniatura de un registro. Devuelve el metadato listo para crear_registro/editar_registro.
export async function subirFotoRegistro(usuarioId, procesada, id = idFoto()) {
  const supabase = crearClienteNavegador();
  const extension = extensionDeTipo(procesada.tipo_mime);
  const extensionMiniatura = extensionDeTipo(procesada.tipo_mime_miniatura);
  const ruta = rutaFotoRegistro(usuarioId, id, extension);
  const rutaMiniatura = rutaFotoRegistro(usuarioId, id, extensionMiniatura, true);

  const errorPrincipal = await subirArchivo(supabase, ruta, procesada.blob);
  if (errorPrincipal) return { error: "No se pudo subir una foto. Revisá tu conexión.", rutas: [] };

  const errorMiniatura = await subirArchivo(supabase, rutaMiniatura, procesada.miniaturaBlob);
  if (errorMiniatura) {
    await borrarArchivosSubidos([ruta]);
    return { error: "No se pudo subir una foto. Revisá tu conexión.", rutas: [] };
  }

  return {
    error: "",
    rutas: [ruta, rutaMiniatura],
    foto: {
      id,
      ruta,
      ruta_miniatura: rutaMiniatura,
      tipo_mime: procesada.tipo_mime,
      tamano_bytes: procesada.tamano_bytes,
      ancho: procesada.ancho,
      alto: procesada.alto,
    },
  };
}

// Sube la portada de una unidad (archivo principal + miniatura) en una carpeta propia de la unidad.
export async function subirPortadaUnidad(usuarioId, unidadId, procesada) {
  const supabase = crearClienteNavegador();
  const id = idFoto();
  const ruta = rutaPortadaUnidad(usuarioId, unidadId, id, extensionDeTipo(procesada.tipo_mime));
  const miniatura = rutaPortadaUnidad(
    usuarioId,
    unidadId,
    id,
    extensionDeTipo(procesada.tipo_mime_miniatura),
    true
  );

  if (await subirArchivo(supabase, ruta, procesada.blob)) {
    return { error: "No se pudo subir la portada. Revisá tu conexión." };
  }
  if (await subirArchivo(supabase, miniatura, procesada.miniaturaBlob)) {
    await borrarArchivosSubidos([ruta]);
    return { error: "No se pudo subir la portada. Revisá tu conexión." };
  }

  return { error: "", ruta, miniatura, rutas: [ruta, miniatura] };
}
