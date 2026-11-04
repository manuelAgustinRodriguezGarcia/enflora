"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cargarCalendario } from "@/lib/calendario/cargar";
import { arbolCultivo, hrefCalendario, normalizarConsulta, normalizarTarea } from "@/lib/calendario/modelo";
import { fechaHoy } from "@/lib/etapas";
import { esUuid } from "@/lib/historial-registros";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor, obtenerSesionRapida } from "@/lib/supabase/servidor";

const MENSAJES = [
  "Escribí la tarea.",
  "La tarea es demasiado larga.",
  "La fecha no es válida.",
  "La hora no es válida.",
  "El tipo de tarea no es válido.",
  "No se encontró el espacio.",
  "No se encontró la unidad.",
  "La unidad no pertenece al espacio.",
  "Una planta no pertenece a la unidad.",
  "Una planta no pertenece a tu cuenta.",
  "No se encontró la tarea.",
  "Solo se editan tareas pendientes.",
  "El estado no es válido.",
  "La tarea no pertenece a tu cultivo.",
];

async function sesion() {
  if (!configuracionLista()) return { error: "Falta la configuración de Supabase." };
  const user = await obtenerSesionRapida();
  if (!user) redirect("/ingreso");
  const supabase = await crearClienteServidor();
  return { supabase, user };
}

function mensajeTarea(error, fallback) {
  const texto = error?.message || "";
  return MENSAJES.find((item) => texto.includes(item)) || fallback;
}

function leerRetorno(formulario) {
  return hrefCalendario(
    normalizarConsulta(
      {
        mes: formulario.get("retorno_mes"),
        unidad: formulario.get("retorno_unidad"),
        estado: formulario.get("retorno_estado"),
        fecha: formulario.get("retorno_fecha"),
      },
      fechaHoy(),
    ),
  );
}

async function contextoCultivo(supabase) {
  const [espaciosRes, unidadesRes, plantasRes] = await Promise.all([
    supabase.from("espacios").select("id, nombre"),
    supabase.from("unidades_cultivo").select("id, espacio_id, nombre"),
    supabase.from("plantas").select("id, nombre, unidad_cultivo_id, estado").eq("estado", "activa"),
  ]);
  if (espaciosRes.error || unidadesRes.error || plantasRes.error) return null;
  return { espacios: arbolCultivo(espaciosRes.data, unidadesRes.data, plantasRes.data) };
}

function revalidar(espacioId, unidadId) {
  revalidatePath("/calendario");
  revalidatePath("/inicio");
  revalidatePath("/cultivos");
  if (esUuid(espacioId)) revalidatePath(`/cultivos/${espacioId}`);
  if (esUuid(espacioId) && esUuid(unidadId)) {
    revalidatePath(`/cultivos/${espacioId}/unidades/${unidadId}`);
  }
}

function leerTarea(formulario) {
  return {
    id: String(formulario.get("id") || "").trim(),
    espacioId: String(formulario.get("espacio_id") || "").trim(),
    unidadId: String(formulario.get("unidad_id") || "").trim(),
    tipo: String(formulario.get("tipo") || "").trim(),
    descripcion: String(formulario.get("descripcion") || ""),
    fecha: String(formulario.get("fecha") || "").trim(),
    hora: String(formulario.get("hora") || "").trim(),
    plantaIds: formulario.getAll("planta_id"),
    avisoPush: formulario.get("aviso_push") === "1",
  };
}

export async function guardarTarea(_estado, formulario) {
  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const contexto = await contextoCultivo(acceso.supabase);
  if (!contexto) return { error: "No se pudieron leer tus cultivos." };

  const tarea = normalizarTarea(leerTarea(formulario), contexto);
  if (tarea.error) return { error: tarea.error };

  const { error } = await acceso.supabase.rpc("guardar_tarea_calendario", {
    p_id: tarea.id,
    p_espacio_id: tarea.espacioId,
    p_unidad_id: tarea.unidadId,
    p_tipo: tarea.tipo,
    p_descripcion: tarea.descripcion,
    p_fecha: tarea.fecha,
    p_hora: tarea.hora,
    p_planta_ids: tarea.plantaIds,
    p_aviso_push: tarea.avisoPush,
  });

  if (error) return { error: mensajeTarea(error, "No se pudo guardar la tarea.") };

  revalidar(tarea.espacioId, tarea.unidadId);
  redirect(leerRetorno(formulario));
}

async function cambiarEstado(formulario, estado) {
  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };
  const id = String(formulario.get("id") || "").trim();
  if (!esUuid(id)) return { error: "No se encontró la tarea." };

  const { error } = await acceso.supabase.rpc("cambiar_estado_tarea_calendario", {
    p_id: id,
    p_estado: estado,
  });
  if (error) return { error: mensajeTarea(error, "No se pudo actualizar la tarea.") };

  revalidar(formulario.get("espacio_id"), formulario.get("unidad_id"));
  redirect(leerRetorno(formulario));
}

export async function cargarVistaCalendario(params) {
  const acceso = await sesion();
  if (acceso.error) {
    return { disponible: true, error: true, filtros: null, espacios: [], tareasMes: [], tareasDia: [], proximas: [], enfocada: null };
  }
  return cargarCalendario(acceso.supabase, acceso.user.id, params || {});
}

export async function completarTarea(_estado, formulario) {
  return cambiarEstado(formulario, "completada");
}

export async function cancelarTarea(_estado, formulario) {
  return cambiarEstado(formulario, "cancelada");
}

export async function reabrirTarea(_estado, formulario) {
  return cambiarEstado(formulario, "pendiente");
}

export async function eliminarTarea(_estado, formulario) {
  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };
  const id = String(formulario.get("id") || "").trim();
  if (!esUuid(id)) return { error: "No se encontró la tarea." };

  const { error } = await acceso.supabase.rpc("eliminar_tarea_calendario", { p_id: id });
  if (error) return { error: mensajeTarea(error, "No se pudo eliminar la tarea.") };

  revalidar(formulario.get("espacio_id"), formulario.get("unidad_id"));
  redirect(leerRetorno(formulario));
}
