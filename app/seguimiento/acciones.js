"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ACCIONES_SEGUIMIENTO,
  PARAMETROS_SEGUIMIENTO,
  accionesOfrecibles,
  esTipoSeguimiento,
  esTipoValor,
  nombreOpcionValido,
  ordenarPreferencias,
  preferenciasValidas,
  unidadOpcionValida,
} from "@/lib/seguimiento";
import { RUTA_INICIO } from "@/lib/navegacion";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

const MENSAJES = [
  "Seleccioná un tipo de seguimiento.",
  "Hay una preferencia que no es válida.",
  "El nombre es obligatorio.",
  "El nombre es demasiado largo.",
  "Elegí un tipo de valor.",
  "La unidad es demasiado larga.",
  "Ya existe una opción con ese nombre.",
  "No se encontró la opción.",
  "No se encontró el perfil.",
  "No hay sesión.",
];

function mensajeDe(error, reserva) {
  const texto = error?.message || "";
  return MENSAJES.find((mensaje) => texto.includes(mensaje)) || reserva;
}

function revalidar() {
  revalidatePath("/perfil");
  revalidatePath("/onboarding");
  revalidatePath("/espacios");
}

async function sesion() {
  if (!configuracionLista()) {
    return { error: "Falta la configuración de Supabase." };
  }

  const supabase = await crearClienteServidor();
  const user = await obtenerSesionRapida();

  if (!user) {
    redirect("/ingreso");
  }

  return { supabase };
}

function leerOpcion(formulario) {
  return {
    categoria: String(formulario.get("categoria") || ""),
    nombre: String(formulario.get("nombre") || ""),
    tipoValor: String(formulario.get("tipo_valor") || ""),
    unidad: String(formulario.get("unidad") || ""),
    marca: String(formulario.get("marca") || ""),
    opcionId: String(formulario.get("opcion_id") || ""),
  };
}

function validarOpcion(datos) {
  if (datos.categoria !== "accion" && datos.categoria !== "parametro") {
    return "Hay una preferencia que no es válida.";
  }

  if (!nombreOpcionValido(datos.nombre)) {
    const limpio = datos.nombre.trim();
    return limpio ? "El nombre es demasiado largo." : "El nombre es obligatorio.";
  }

  if (datos.categoria === "parametro" && !esTipoValor(datos.tipoValor)) {
    return "Elegí un tipo de valor.";
  }

  if (!unidadOpcionValida(datos.unidad)) {
    return "La unidad es demasiado larga.";
  }

  return "";
}

export async function crearOpcionSeguimiento(_estado, formulario) {
  const datos = leerOpcion(formulario);
  const errorLocal = validarOpcion(datos);

  if (errorLocal) {
    return { error: errorLocal, marca: datos.marca };
  }

  const sesionActual = await sesion();
  if (sesionActual.error) {
    return { error: sesionActual.error, marca: datos.marca };
  }

  const { data, error } = await sesionActual.supabase.rpc("crear_opcion_seguimiento", {
    categoria: datos.categoria,
    nombre: datos.nombre.trim(),
    tipo_valor: datos.categoria === "parametro" ? datos.tipoValor : null,
    unidad: datos.categoria === "parametro" ? datos.unidad.trim() : null,
  });

  if (error) {
    return {
      error: mensajeDe(error, "No se pudo guardar la opción."),
      marca: datos.marca,
    };
  }

  revalidar();
  return { ok: true, marca: datos.marca, opcion: data };
}

export async function editarOpcionSeguimiento(_estado, formulario) {
  const datos = leerOpcion(formulario);
  const errorLocal = validarOpcion(datos);

  if (errorLocal) {
    return { error: errorLocal, marca: datos.marca };
  }

  const sesionActual = await sesion();
  if (sesionActual.error) {
    return { error: sesionActual.error, marca: datos.marca };
  }

  const { data, error } = await sesionActual.supabase.rpc("editar_opcion_seguimiento", {
    opcion_id: datos.opcionId,
    nombre: datos.nombre.trim(),
    tipo_valor: datos.categoria === "parametro" ? datos.tipoValor : null,
    unidad: datos.categoria === "parametro" ? datos.unidad.trim() : null,
  });

  if (error) {
    return {
      error: mensajeDe(error, "No se pudo guardar la opción."),
      marca: datos.marca,
    };
  }

  revalidar();
  return { ok: true, marca: datos.marca, opcion: data };
}

export async function desactivarOpcionSeguimiento(opcionId) {
  const sesionActual = await sesion();
  if (sesionActual.error) {
    return { error: sesionActual.error };
  }

  const { error } = await sesionActual.supabase.rpc("desactivar_opcion_seguimiento", {
    opcion_id: opcionId,
  });

  if (error) {
    return { error: mensajeDe(error, "No se pudo quitar la opción.") };
  }

  revalidar();
  return { ok: true };
}

export async function guardarConfiguracionSeguimiento(_estado, formulario) {
  const tipo = String(formulario.get("tipo_seguimiento") || "");
  // Foto y Nota ya no son acciones: si un cliente viejo las envía, se descartan.
  const acciones = accionesOfrecibles(formulario.getAll("acciones").map(String));
  const parametros = formulario.getAll("parametros").map(String);
  const opciones = formulario.getAll("opciones").map(String);
  const continuarEn = String(formulario.get("continuar_en") || "");
  const accionesOrdenadas = ordenarPreferencias(acciones, ACCIONES_SEGUIMIENTO);
  const parametrosOrdenados = ordenarPreferencias(parametros, PARAMETROS_SEGUIMIENTO);
  const base = { acciones: accionesOrdenadas, parametros: parametrosOrdenados, tipo };

  if (!esTipoSeguimiento(tipo)) {
    return { error: "Seleccioná un tipo de seguimiento.", ...base };
  }

  if (!preferenciasValidas(acciones, parametros)) {
    return { error: "Hay una preferencia que no es válida.", ...base };
  }

  if (opciones.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    return { error: "Hay una preferencia que no es válida.", ...base };
  }

  const sesionActual = await sesion();
  if (sesionActual.error) {
    return { error: sesionActual.error, ...base };
  }

  const { error } = await sesionActual.supabase.rpc("guardar_configuracion_seguimiento", {
    tipo,
    acciones: accionesOrdenadas,
    parametros: parametrosOrdenados,
    opciones_prioritarias: opciones,
  });

  if (error) {
    return { error: mensajeDe(error, "No se pudo guardar la configuración."), ...base };
  }

  revalidar();

  if (continuarEn === RUTA_INICIO || continuarEn === "/espacios") {
    redirect(RUTA_INICIO);
  }

  return { ok: true, ...base };
}
