"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  argumentosRpcRegistro,
  prepararDatosRegistro,
} from "@/lib/registros";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

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

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ingreso");
  }

  return { supabase, user };
}

function revalidarContexto(datos) {
  revalidatePath("/registros");
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

  const { data, error } = await acceso.supabase.rpc(
    "crear_registro",
    argumentosRpcRegistro(preparado.datos)
  );

  if (error) {
    return { error: mensajeDe(error, "No se pudo crear el registro.") };
  }

  revalidarContexto(preparado.datos);
  return { ok: true, registro: data };
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

  const { data, error } = await acceso.supabase.rpc("editar_registro", {
    p_registro_id: registroId,
    ...argumentosRpcRegistro(preparado.datos),
  });

  if (error) {
    return { error: mensajeDe(error, "No se pudo editar el registro.") };
  }

  revalidarContexto(preparado.datos);
  return { ok: true, registro: data };
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

  const { error } = await acceso.supabase.rpc("eliminar_registro", {
    p_registro_id: registroId,
  });

  if (error) {
    return { error: mensajeDe(error, "No se pudo eliminar el registro.") };
  }

  revalidarContexto({
    espacio_id: espacioId || null,
    unidad_cultivo_id: unidadId || null,
  });
  return { ok: true };
}
