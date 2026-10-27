"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  afirmarFiltrosHistorial,
  cargarHistorialRegistros,
  cargarRegistroPorId,
} from "@/lib/cargar-registros";
import { SEGUNDOS_URL_ORIGINAL, adjuntarMiniaturas, borrarArchivos, firmarRutas, rutasDeFotos } from "@/lib/fotos-servidor";
import { esUuidFoto, rutaPerteneceAUsuario } from "@/lib/fotos";
import { normalizarFiltrosHistorial } from "@/lib/historial-registros";
import {
  argumentosRpcRegistro,
  prepararDatosRegistro,
} from "@/lib/registros";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

const FOTOS_YA_GUARDADAS = "Las fotos ya fueron guardadas.";

const MENSAJES = [
  "No hay sesión.",
  "El alcance del registro no es válido.",
  "El tipo de aplicación no es válido.",
  "Una medición ambiental requiere unidad o espacio.",
  "La fecha del evento no es válida.",
  "No se encontró el espacio.",
  "No se encontró la unidad.",
  "La unidad es obligatoria para este alcance.",
  "El espacio es obligatorio para este alcance.",
  "La genética del grupo no es válida.",
  "Seleccioná al menos una planta.",
  "Una medición ambiental no asocia plantas.",
  "No se puede asociar una planta de otro usuario.",
  "No se puede usar una opción de otro usuario.",
  "Hay una acción que no es válida.",
  "Hay un parámetro que no es válido.",
  "Hay un parámetro con tipo inválido.",
  "El registro necesita una acción, un parámetro o una observación.",
  "El registro necesita una acción, un parámetro, una observación o una foto.",
  FOTOS_YA_GUARDADAS,
  "Las fotos del registro no son válidas.",
  "Las fotos a quitar no son válidas.",
  "Hay una foto con identificador inválido.",
  "La ruta de una foto no es válida.",
  "Hay una foto con un formato no permitido.",
  "Hay una foto que supera el tamaño permitido.",
  "No se encontró el archivo de una foto.",
  "Un registro admite hasta 10 fotos.",
  "No se encontró el registro.",
  "Las plantas del registro no son válidas.",
  "Las acciones del registro no son válidas.",
  "Los parámetros del registro no son válidos.",
  "Hay una planta sin identificador.",
  "El nombre de la planta es obligatorio.",
  "El nombre de la acción es obligatorio.",
  "El nombre del parámetro es obligatorio.",
  "Hay una acción personalizada sin identificador.",
  "Hay un parámetro personalizado sin identificador.",
  "Hay un parámetro de texto vacío.",
  "Hay un parámetro numérico inválido.",
  "Hay un parámetro duplicado.",
  "La observación es demasiado larga.",
];

function mensajeDe(error, reserva) {
  const texto = error?.message || "";
  return MENSAJES.find((mensaje) => texto.includes(mensaje)) || reserva;
}

async function sesion() {
  if (!configuracionLista()) {
    return { error: "Falta la configuración de Supabase." };
  }

  const user = await obtenerSesionRapida();

  if (!user) {
    redirect("/ingreso");
  }

  const supabase = await crearClienteServidor();
  return { supabase, user };
}

function revalidarContexto(datos) {
  revalidatePath("/registros");
  revalidatePath("/registros/historial");
  revalidatePath("/espacios");
  if (datos?.espacio_id) {
    revalidatePath(`/espacios/${datos.espacio_id}`);
  }
  if (datos?.espacio_id && datos?.unidad_cultivo_id) {
    revalidatePath(`/espacios/${datos.espacio_id}/unidades/${datos.unidad_cultivo_id}`);
  }
}

function leerEntrada(formularioODatos) {
  if (formularioODatos && typeof formularioODatos.get === "function") {
    try {
      return JSON.parse(String(formularioODatos.get("registro") || ""));
    } catch {
      return null;
    }
  }
  return formularioODatos;
}

export async function guardarRegistro(_estado, formularioODatos) {
  const entrada = leerEntrada(formularioODatos);
  if (!entrada) {
    return { error: "No se pudo leer el registro." };
  }
  if (entrada.id || entrada.registro_id) {
    return editarRegistro(_estado, entrada);
  }
  return crearRegistro(_estado, entrada);
}

export async function crearRegistro(_estado, formularioODatos) {
  const entrada = leerEntrada(formularioODatos);
  if (!entrada) {
    return { error: "No se pudo leer el registro." };
  }

  const preparado = prepararDatosRegistro(entrada);
  if (preparado.error) {
    return { error: preparado.error };
  }

  const acceso = await sesion();
  if (acceso.error) {
    return { error: acceso.error };
  }

  if (!fotosDelUsuario(preparado.datos.fotos, acceso.user.id)) {
    return { error: "La ruta de una foto no es válida." };
  }

  const { data, error } = await acceso.supabase.rpc(
    "crear_registro",
    argumentosRpcRegistro(preparado.datos)
  );

  if (error) {
    return await respuestaConError(acceso.supabase, error, preparado.datos.fotos, "No se pudo crear el registro.");
  }

  revalidarContexto(preparado.datos);
  return { ok: true, registro: data };
}

function fotosDelUsuario(fotos, usuarioId) {
  return (fotos || []).every(
    (foto) =>
      rutaPerteneceAUsuario(foto.ruta, usuarioId) &&
      rutaPerteneceAUsuario(foto.ruta_miniatura, usuarioId)
  );
}

// Si el registro no pudo guardarse, los archivos recién subidos no quedan asociados a nada:
// se borran para no dejar huérfanos. Excepción: "ya fueron guardadas" significa que un envío
// anterior SÍ los asoció, así que no se tocan.
async function respuestaConError(supabase, error, fotosNuevas, reserva) {
  const mensaje = mensajeDe(error, reserva);
  if (mensaje === FOTOS_YA_GUARDADAS) {
    return {
      error: "Este registro ya se había guardado. Revisalo en el historial antes de volver a enviarlo.",
      yaGuardado: true,
    };
  }
  if ((fotosNuevas || []).length > 0) {
    await borrarArchivos(supabase, rutasDeFotos(fotosNuevas));
    return { error: mensaje, archivosLimpiados: true };
  }
  return { error: mensaje };
}

export async function editarRegistro(_estado, formularioODatos) {
  const entrada = leerEntrada(formularioODatos);
  if (!entrada) {
    return { error: "No se pudo leer el registro." };
  }

  const registroId = String(entrada?.id || entrada?.registro_id || "").trim();
  if (!registroId) {
    return { error: "No se encontró el registro." };
  }

  const preparado = prepararDatosRegistro(entrada);
  if (preparado.error) {
    return { error: preparado.error };
  }

  const acceso = await sesion();
  if (acceso.error) {
    return { error: acceso.error };
  }

  if (!fotosDelUsuario(preparado.datos.fotos, acceso.user.id)) {
    return { error: "La ruta de una foto no es válida." };
  }

  // Rutas de los archivos que se van a quitar: se leen antes porque la fila desaparece con la edición.
  let rutasQuitadas = [];
  if (preparado.datos.fotos_quitar.length > 0) {
    const { data: aQuitar } = await acceso.supabase
      .from("registro_fotos")
      .select("ruta, ruta_miniatura")
      .eq("registro_id", registroId)
      .in("id", preparado.datos.fotos_quitar);
    rutasQuitadas = rutasDeFotos(aQuitar);
  }

  const { data, error } = await acceso.supabase.rpc("editar_registro", {
    p_registro_id: registroId,
    ...argumentosRpcRegistro(preparado.datos),
    ...(preparado.datos.fotos_quitar.length > 0
      ? { p_fotos_quitar: preparado.datos.fotos_quitar }
      : {}),
  });

  if (error) {
    return await respuestaConError(acceso.supabase, error, preparado.datos.fotos, "No se pudo editar el registro.");
  }

  // Los archivos viejos se borran SOLO después de confirmar que la edición quedó guardada.
  await borrarArchivos(acceso.supabase, rutasQuitadas);

  revalidarContexto(preparado.datos);
  return { ok: true, registro: data };
}

export async function obtenerRegistroCompleto(registroId) {
  const id = String(registroId || "").trim();
  if (!id) {
    return { error: "No se encontró el registro.", registro: null };
  }

  const acceso = await sesion();
  if (acceso.error) {
    return { error: acceso.error, registro: null };
  }

  const { error, registro } = await cargarRegistroPorId(acceso.supabase, id);
  if (error || !registro) {
    return { error: "No se encontró el registro.", registro: null };
  }

  const [conMiniaturas] = await adjuntarMiniaturas(acceso.supabase, [registro]);
  return { error: "", registro: conMiniaturas };
}

// URL temporal (10 minutos) para ver una foto en tamaño ampliado. Solo para fotos propias (RLS).
export async function urlFotoOriginal(fotoId) {
  const id = String(fotoId || "").trim();
  if (!esUuidFoto(id)) return { error: "No se encontró la foto.", url: "" };

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error, url: "" };

  const { data, error } = await acceso.supabase
    .from("registro_fotos")
    .select("ruta")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { error: "No se encontró la foto.", url: "" };

  const urls = await firmarRutas(acceso.supabase, [data.ruta], SEGUNDOS_URL_ORIGINAL);
  const url = urls.get(data.ruta) || "";
  return url ? { error: "", url } : { error: "No se pudo cargar la foto.", url: "" };
}

export async function eliminarRegistro(_estado, formularioODatos) {
  let registroId = "";
  let espacioId = "";
  let unidadId = "";

  if (formularioODatos && typeof formularioODatos.get === "function") {
    registroId = String(formularioODatos.get("registro_id") || "").trim();
    espacioId = String(formularioODatos.get("espacio_id") || "").trim();
    unidadId = String(formularioODatos.get("unidad_id") || "").trim();
  } else {
    registroId = String(formularioODatos?.id || formularioODatos?.registro_id || "").trim();
    espacioId = String(formularioODatos?.espacio_id || "").trim();
    unidadId = String(formularioODatos?.unidad_cultivo_id || "").trim();
  }

  if (!registroId) {
    return { error: "No se encontró el registro." };
  }

  const acceso = await sesion();
  if (acceso.error) {
    return { error: acceso.error };
  }

  // Las filas de fotos se eliminan en cascada con el registro: las rutas se leen antes.
  const { data: fotosDelRegistro } = await acceso.supabase
    .from("registro_fotos")
    .select("ruta, ruta_miniatura")
    .eq("registro_id", registroId);

  const { error } = await acceso.supabase.rpc("eliminar_registro", {
    p_registro_id: registroId,
  });

  if (error) {
    return { error: mensajeDe(error, "No se pudo eliminar el registro.") };
  }

  await borrarArchivos(acceso.supabase, rutasDeFotos(fotosDelRegistro));

  revalidarContexto({
    espacio_id: espacioId || null,
    unidad_cultivo_id: unidadId || null,
  });
  return { ok: true };
}

export async function cargarPaginaHistorial(payload) {
  const normalizado = normalizarFiltrosHistorial({
    unidad: payload?.unidadId || "",
    planta: payload?.plantaId || "",
    genetica: payload?.genetica || "",
    desde: payload?.desde || "",
    hasta: payload?.hasta || "",
    contenido: payload?.sinContenido ? "ninguno" : (payload?.contenidos || []).join(","),
    cursorFecha: payload?.cursorFecha || "",
    cursorId: payload?.cursorId || "",
  });

  if (normalizado.error || !normalizado.filtros?.cursor) {
    return {
      error: true,
      mensaje: normalizado.error || "No se pudo continuar el historial.",
      registros: [],
      hayMas: false,
    };
  }

  const acceso = await sesion();
  if (acceso.error) {
    return { error: true, mensaje: acceso.error, registros: [], hayMas: false };
  }

  const propio = await afirmarFiltrosHistorial(acceso.supabase, normalizado.filtros);
  if (propio.error) {
    return { error: true, mensaje: propio.error, registros: [], hayMas: false };
  }

  const pagina = await cargarHistorialRegistros(acceso.supabase, normalizado.filtros);
  if (pagina.error) {
    return {
      error: true,
      mensaje: "No se pudo cargar más registros.",
      registros: [],
      hayMas: false,
    };
  }

  const registros = await adjuntarMiniaturas(acceso.supabase, pagina.registros);
  return { error: false, mensaje: "", registros, hayMas: pagina.hayMas };
}
