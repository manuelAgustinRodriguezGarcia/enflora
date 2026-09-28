"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function crearPlanta(_estado, formulario) {
  const espacioId = String(formulario.get("espacio_id") || "").trim();
  const nombre = String(formulario.get("nombre") || "").trim();
  const genetica = String(formulario.get("genetica") || "").trim();
  const fechaInicio = String(formulario.get("fecha_inicio") || "").trim();

  if (!nombre) {
    return { error: "El nombre es obligatorio.", nombre, genetica, fechaInicio };
  }

  if (fechaInicio && !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
    return {
      error: "La fecha de inicio no es válida.",
      nombre,
      genetica,
      fechaInicio,
    };
  }

  if (!espacioId) {
    return {
      error: "No se encontró el espacio.",
      nombre,
      genetica,
      fechaInicio,
    };
  }

  if (!configuracionLista()) {
    return {
      error: "Falta la configuración de Supabase.",
      nombre,
      genetica,
      fechaInicio,
    };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/entrar");
  }

  const { data: espacio } = await supabase
    .from("espacios")
    .select("id")
    .eq("id", espacioId)
    .maybeSingle();

  if (!espacio) {
    return {
      error: "No se encontró el espacio.",
      nombre,
      genetica,
      fechaInicio,
    };
  }

  const { error } = await supabase.from("plantas").insert({
    espacio_id: espacioId,
    nombre,
    genetica: genetica || null,
    fecha_inicio: fechaInicio || null,
  });

  if (error) {
    return { error: "No se pudo crear la planta.", nombre, genetica, fechaInicio };
  }

  revalidatePath("/espacios");
  revalidatePath(`/espacios/${espacioId}`);
  redirect(`/espacios/${espacioId}`);
}
