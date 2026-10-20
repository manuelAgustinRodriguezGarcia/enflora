"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { estadoPorEtapa, fechaHoy, filasDeHistorial, validarEtapaInicial } from "@/lib/etapas";
import { guardarMetodosPersonalizados } from "@/lib/metodos-usuario";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { datosTipoUnidad, MAXIMO_UNIDADES } from "@/lib/unidades";

const MAXIMO_PLANTAS = 100;

async function sesion() {
  if (!configuracionLista()) return { error: "Falta la configuración de Supabase." };

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingreso");
  return { supabase, user };
}

function leerPlantas(formulario) {
  try {
    const valor = JSON.parse(String(formulario.get("plantas") || ""));
    return Array.isArray(valor) ? valor : null;
  } catch {
    return null;
  }
}

function rutaUnidad(espacioId, unidadId) {
  return `/espacios/${espacioId}/unidades/${unidadId}`;
}

export async function crearPlantas(_estado, formulario) {
  const unidadId = String(formulario.get("unidad_id") || "").trim();
  const lista = leerPlantas(formulario);

  if (!unidadId) return { error: "No se encontró la unidad." };
  if (!lista || lista.length < 1) return { error: "Seleccioná al menos una planta." };
  if (lista.length > MAXIMO_PLANTAS) return { error: "Se pueden crear hasta 100 plantas." };

  const plantas = [];

  for (const item of lista) {
    const fechaInicio = String(item?.fechaInicio || "").trim() || fechaHoy();
    const fechaInicioEtapa = String(item?.fechaInicioEtapa || "").trim();
    const metodo = String(item?.metodo || "").trim();
    const etapa = String(item?.etapa || "").trim();

    if (item?.metodoIncompleto || metodo === "otro") {
      return { error: "Escribí el nombre del método." };
    }
    const errorEtapa = validarEtapaInicial(etapa, fechaInicioEtapa);
    if (errorEtapa) return { error: errorEtapa };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
      return { error: "La fecha de inicio no es válida." };
    }

    plantas.push({
      nombre: String(item?.nombre || "").trim(),
      genetica: String(item?.genetica || "").trim(),
      metodo,
      sustrato: String(item?.sustrato || "").trim(),
      etapa,
      fechaInicio,
      fechaInicioEtapa,
    });
  }

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const { supabase, user } = acceso;
  const { data: unidad } = await supabase
    .from("unidades_cultivo")
    .select("id, espacio_id")
    .eq("id", unidadId)
    .maybeSingle();

  if (!unidad) return { error: "No se encontró la unidad." };

  const { data: existentes, error: errorNumeros } = await supabase
    .from("plantas")
    .select("numero")
    .eq("unidad_cultivo_id", unidadId);

  if (errorNumeros) return { error: "No se pudieron crear las plantas." };

  const errorMetodos = await guardarMetodosPersonalizados(
    supabase,
    user.id,
    plantas.map((planta) => planta.metodo)
  );
  if (errorMetodos) return { error: "No se pudo guardar el método." };

  let numero = 0;
  for (const fila of existentes || []) {
    if (fila.numero > numero) numero = fila.numero;
  }

  const origenes = [];
  const filas = plantas.map((planta) => {
    numero += 1;
    origenes.push({
      unidad_cultivo_id: unidadId,
      numero,
      etapa: planta.etapa,
      fechaInicioEtapa: planta.fechaInicioEtapa,
    });
    return {
      unidad_cultivo_id: unidadId,
      numero,
      nombre: planta.nombre || `Planta ${numero}`,
      genetica: planta.genetica || null,
      metodo: planta.metodo || null,
      sustrato: planta.sustrato || null,
      etapa: planta.etapa,
      fecha_inicio: planta.fechaInicio,
      estado: estadoPorEtapa(planta.etapa),
    };
  });

  const { data: creadas, error } = await supabase
    .from("plantas")
    .insert(filas)
    .select("id, unidad_cultivo_id, numero");
  if (error || !creadas?.length) return { error: "No se pudieron crear las plantas." };

  const historial = filasDeHistorial(creadas, origenes);
  if (historial.some((fila) => !fila)) {
    await supabase.from("plantas").delete().in("id", creadas.map((planta) => planta.id));
    return { error: "No se pudo guardar la etapa." };
  }

  const { error: errorHistorial } = await supabase.from("historial_etapas").insert(historial);
  if (errorHistorial) {
    await supabase.from("plantas").delete().in("id", creadas.map((planta) => planta.id));
    return { error: "No se pudo guardar la etapa." };
  }

  revalidatePath("/espacios");
  revalidatePath(`/espacios/${unidad.espacio_id}`);
  revalidatePath(rutaUnidad(unidad.espacio_id, unidadId));
  redirect(rutaUnidad(unidad.espacio_id, unidadId));
}

export async function editarPlanta(_estado, formulario) {
  const plantaId = String(formulario.get("planta_id") || "").trim();
  const unidadAnteriorId = String(formulario.get("unidad_anterior_id") || "").trim();
  const unidadId = String(formulario.get("unidad_id") || "").trim();
  const nombre = String(formulario.get("nombre") || "").trim();
  const genetica = String(formulario.get("genetica") || "").trim();
  const metodo = String(formulario.get("metodo") || "").trim();
  const sustrato = String(formulario.get("sustrato") || "").trim();
  const fechaInicio = String(formulario.get("fecha_inicio") || "").trim() || fechaHoy();
  const estado = String(formulario.get("estado") || "").trim();
  const datos = { nombre, genetica, metodo, sustrato, fechaInicio, estadoPlanta: estado, unidadId };

  if (!nombre) return { error: "El nombre de la planta es obligatorio.", ...datos };
  if (estado !== "activa" && estado !== "finalizada") {
    return { error: "El estado es obligatorio.", ...datos };
  }
  if (!unidadId) return { error: "Seleccioná una unidad.", ...datos };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
    return { error: "La fecha de inicio no es válida.", ...datos };
  }
  if (formulario.get("metodo_incompleto") === "si" || metodo === "otro") {
    return { error: "Escribí el nombre del método.", ...datos };
  }
  if (!plantaId || !unidadAnteriorId) return { error: "No se encontró la planta.", ...datos };

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error, ...datos };

  const { supabase, user } = acceso;
  const { data: unidad } = await supabase
    .from("unidades_cultivo")
    .select("id, espacio_id")
    .eq("id", unidadId)
    .maybeSingle();

  if (!unidad) return { error: "No se encontró la unidad.", ...datos };

  const { data: unidadAnterior } = await supabase
    .from("unidades_cultivo")
    .select("espacio_id")
    .eq("id", unidadAnteriorId)
    .maybeSingle();

  const { data: actual } = await supabase
    .from("plantas")
    .select("numero, unidad_cultivo_id")
    .eq("id", plantaId)
    .eq("unidad_cultivo_id", unidadAnteriorId)
    .maybeSingle();

  if (!actual) return { error: "No se encontró la planta.", ...datos };

  let numero = actual.numero;
  if (actual.unidad_cultivo_id !== unidadId) {
    const { data: existentes, error: errorNumeros } = await supabase
      .from("plantas")
      .select("numero")
      .eq("unidad_cultivo_id", unidadId);

    if (errorNumeros) return { error: "No se pudo editar la planta.", ...datos };
    numero = 0;
    for (const fila of existentes || []) {
      if (fila.numero > numero) numero = fila.numero;
    }
    numero += 1;
  }

  const errorMetodos = await guardarMetodosPersonalizados(supabase, user.id, [metodo]);
  if (errorMetodos) return { error: "No se pudo guardar el método.", ...datos };

  const { data, error } = await supabase
    .from("plantas")
    .update({
      nombre,
      genetica: genetica || null,
      metodo: metodo || null,
      sustrato: sustrato || null,
      fecha_inicio: fechaInicio,
      estado,
      unidad_cultivo_id: unidadId,
      numero,
    })
    .eq("id", plantaId)
    .eq("unidad_cultivo_id", unidadAnteriorId)
    .select("id");

  if (error || !data?.length) return { error: "No se pudo editar la planta.", ...datos };

  revalidatePath("/espacios");
  if (unidadAnterior?.espacio_id) {
    revalidatePath(`/espacios/${unidadAnterior.espacio_id}`);
    revalidatePath(rutaUnidad(unidadAnterior.espacio_id, unidadAnteriorId));
  }
  revalidatePath(`/espacios/${unidad.espacio_id}`);
  revalidatePath(rutaUnidad(unidad.espacio_id, unidadId));
  redirect(`/espacios/${unidad.espacio_id}/unidades/${unidadId}/plantas/${plantaId}`);
}

function mensajeCambio(error) {
  const texto = String(error?.message || "");
  if (texto.includes("La fecha no puede ser anterior")) {
    return "La fecha no puede ser anterior al inicio de la etapa actual.";
  }
  if (texto.includes("Seleccioná una etapa")) return "Seleccioná una etapa.";
  if (texto.includes("La fecha de inicio no es válida")) return "La fecha de inicio no es válida.";
  if (texto.includes("No se encontró la planta")) return "No se encontró la planta.";
  if (texto.includes("Seleccioná al menos una planta")) return "Seleccioná al menos una planta.";
  if (texto.includes("Ninguna planta necesita cambio")) return "Ninguna planta necesita cambio.";
  return "No se pudo cambiar la etapa.";
}

function leerIdsPlantas(formulario) {
  const multiples = formulario
    .getAll("planta_id")
    .map((valor) => String(valor || "").trim())
    .filter(Boolean);
  if (multiples.length) return [...new Set(multiples)];

  try {
    const valor = JSON.parse(String(formulario.get("planta_ids") || ""));
    if (!Array.isArray(valor)) return [];
    return [...new Set(valor.map((item) => String(item || "").trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export async function cambiarEtapa(_estado, formulario) {
  const plantaId = String(formulario.get("planta_id") || "").trim();
  const unidadId = String(formulario.get("unidad_id") || "").trim();
  const espacioId = String(formulario.get("espacio_id") || "").trim();
  const etapa = String(formulario.get("etapa") || "").trim();
  const fecha = String(formulario.get("fecha_inicio") || "").trim();
  const datos = { etapa, fechaInicio: fecha };

  if (!plantaId || !unidadId || !espacioId) return { error: "No se encontró la planta.", ...datos };
  const errorEtapa = validarEtapaInicial(etapa, fecha);
  if (errorEtapa) return { error: errorEtapa, ...datos };

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error, ...datos };

  const { data: planta } = await acceso.supabase
    .from("plantas")
    .select("id")
    .eq("id", plantaId)
    .eq("unidad_cultivo_id", unidadId)
    .maybeSingle();

  if (!planta) return { error: "No se encontró la planta.", ...datos };

  const { error } = await acceso.supabase.rpc("cambiar_etapa_planta", {
    p_planta_id: plantaId,
    p_etapa: etapa,
    p_fecha: fecha,
  });

  if (error) return { error: mensajeCambio(error), ...datos };

  revalidatePath("/espacios");
  revalidatePath(`/espacios/${espacioId}`);
  revalidatePath(rutaUnidad(espacioId, unidadId));
  revalidatePath(`/espacios/${espacioId}/unidades/${unidadId}/plantas/${plantaId}`);
  redirect(`/espacios/${espacioId}/unidades/${unidadId}/plantas/${plantaId}`);
}

export async function cambiarEtapaMasiva(_estado, formulario) {
  const unidadId = String(formulario.get("unidad_id") || "").trim();
  const espacioId = String(formulario.get("espacio_id") || "").trim();
  const etapa = String(formulario.get("etapa") || "").trim();
  const fecha = String(formulario.get("fecha_inicio") || "").trim();
  const plantaIds = leerIdsPlantas(formulario);
  const datos = { etapa, fechaInicio: fecha, plantaIds };

  if (!unidadId || !espacioId) return { error: "No se encontró la unidad.", ...datos };
  if (!plantaIds.length) return { error: "Seleccioná al menos una planta.", ...datos };

  const errorEtapa = validarEtapaInicial(etapa, fecha);
  if (errorEtapa) return { error: errorEtapa, ...datos };

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error, ...datos };

  const { data: plantas, error: errorPlantas } = await acceso.supabase
    .from("plantas")
    .select("id")
    .eq("unidad_cultivo_id", unidadId)
    .in("id", plantaIds);

  if (errorPlantas || !plantas || plantas.length !== plantaIds.length) {
    return { error: "No se encontró la planta.", ...datos };
  }

  const { data, error } = await acceso.supabase.rpc("cambiar_etapa_plantas", {
    p_planta_ids: plantaIds,
    p_etapa: etapa,
    p_fecha: fecha,
  });

  if (error) return { error: mensajeCambio(error), ...datos };

  revalidatePath("/espacios");
  revalidatePath(`/espacios/${espacioId}`);
  revalidatePath(rutaUnidad(espacioId, unidadId));

  return {
    ok: true,
    actualizadas: data?.actualizadas ?? plantaIds.length,
    omitidas: data?.omitidas ?? 0,
    ...datos,
  };
}

export async function eliminarPlanta(_estado, formulario) {
  const plantaId = String(formulario.get("planta_id") || "").trim();
  const unidadId = String(formulario.get("unidad_id") || "").trim();
  const espacioId = String(formulario.get("espacio_id") || "").trim();

  if (!plantaId || !unidadId) return { error: "No se encontró la planta." };

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const { data, error } = await acceso.supabase
    .from("plantas")
    .delete()
    .eq("id", plantaId)
    .eq("unidad_cultivo_id", unidadId)
    .select("id");

  if (error || !data?.length) return { error: "No se pudo eliminar la planta." };

  revalidatePath("/espacios");
  if (espacioId) revalidatePath(`/espacios/${espacioId}`);
  redirect(espacioId ? rutaUnidad(espacioId, unidadId) : "/espacios");
}

export async function editarUnidad(_estado, formulario) {
  const unidadId = String(formulario.get("unidad_id") || "").trim();
  const espacioId = String(formulario.get("espacio_id") || "").trim();
  const nombre = String(formulario.get("nombre") || "").trim();
  const tipo = String(formulario.get("tipo") || "").trim();
  const tipoPersonalizado = String(formulario.get("tipo_personalizado") || "").trim();
  const datos = { nombre, tipo, tipoPersonalizado };

  if (!nombre) return { error: "El nombre es obligatorio.", ...datos };
  if (!unidadId || !espacioId) return { error: "No se encontró la unidad.", ...datos };

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error, ...datos };

  const { data: espacio, error: errorEspacio } = await acceso.supabase
    .from("espacios")
    .select("id, tipo")
    .eq("id", espacioId)
    .maybeSingle();

  if (errorEspacio || !espacio) return { error: "No se encontró el espacio.", ...datos };

  const tipoUnidad = datosTipoUnidad(espacio.tipo, tipo, tipoPersonalizado);
  if (tipoUnidad.error) return { error: tipoUnidad.error, ...datos };

  const { data: hermanas, error: errorHermanas } = await acceso.supabase
    .from("unidades_cultivo")
    .select("id, tipo")
    .eq("espacio_id", espacioId);

  if (errorHermanas) return { error: "No se pudo editar la unidad.", ...datos };

  const repetida = (hermanas || []).some(
    (unidad) => unidad.id !== unidadId && unidad.tipo === tipoUnidad.tipo && (tipoUnidad.tipo === "sala" || tipoUnidad.tipo === "aire_libre")
  );
  if (repetida) {
    const mensaje = tipoUnidad.tipo === "sala" ? "Este espacio ya tiene una sala." : "Este espacio ya tiene aire libre.";
    return { error: mensaje, ...datos };
  }

  const { data, error } = await acceso.supabase
    .from("unidades_cultivo")
    .update({
      nombre,
      tipo: tipoUnidad.tipo,
      tipo_personalizado: tipoUnidad.tipo_personalizado,
    })
    .eq("id", unidadId)
    .eq("espacio_id", espacioId)
    .select("id");

  if (error || !data?.length) return { error: "No se pudo editar la unidad.", ...datos };

  revalidatePath(`/espacios/${espacioId}`);
  revalidatePath(rutaUnidad(espacioId, unidadId));
  redirect(rutaUnidad(espacioId, unidadId));
}

export async function eliminarUnidad(_estado, formulario) {
  const unidadId = String(formulario.get("unidad_id") || "").trim();
  const espacioId = String(formulario.get("espacio_id") || "").trim();

  if (!unidadId || !espacioId) return { error: "No se encontró la unidad." };

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const { data, error } = await acceso.supabase
    .from("unidades_cultivo")
    .delete()
    .eq("id", unidadId)
    .eq("espacio_id", espacioId)
    .select("id");

  if (error || !data?.length) return { error: "No se pudo eliminar la unidad." };

  revalidatePath("/espacios");
  revalidatePath(`/espacios/${espacioId}`);
  redirect(`/espacios/${espacioId}`);
}

export async function agregarUnidad(_estado, formulario) {
  const espacioId = String(formulario.get("espacio_id") || "").trim();
  let cultivo = null;

  try {
    cultivo = JSON.parse(String(formulario.get("cultivo") || ""));
  } catch {
    cultivo = null;
  }

  const unidad = Array.isArray(cultivo?.unidades) ? cultivo.unidades[0] : null;
  const nombre = String(unidad?.nombre || "").trim();
  const plantasEntrada = Array.isArray(unidad?.plantas) ? unidad.plantas : [];

  if (!espacioId) return { error: "No se encontró el espacio." };
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (plantasEntrada.length < 1 || plantasEntrada.length > MAXIMO_PLANTAS) {
    return { error: "Seleccioná al menos una planta." };
  }

  const acceso = await sesion();
  if (acceso.error) return { error: acceso.error };

  const { supabase, user } = acceso;
  const { data: espacio, error: errorEspacio } = await supabase
    .from("espacios")
    .select("id, tipo")
    .eq("id", espacioId)
    .maybeSingle();

  if (errorEspacio || !espacio) return { error: "No se encontró el espacio." };

  const tipoUnidad = datosTipoUnidad(espacio.tipo, unidad?.tipo, unidad?.tipoPersonalizado);
  if (tipoUnidad.error) return { error: tipoUnidad.error };

  const { data: existentes, error: errorExistentes } = await supabase
    .from("unidades_cultivo")
    .select("id, tipo, numero")
    .eq("espacio_id", espacioId);

  if (errorExistentes) return { error: "No se pudo crear la unidad." };

  const lista = existentes || [];
  if (lista.length >= MAXIMO_UNIDADES) return { error: "Se pueden crear hasta 20 unidades." };
  if (tipoUnidad.tipo === "sala" && lista.some((item) => item.tipo === "sala")) {
    return { error: "Este espacio ya tiene una sala." };
  }
  if (tipoUnidad.tipo === "aire_libre" && lista.some((item) => item.tipo === "aire_libre")) {
    return { error: "Este espacio ya tiene aire libre." };
  }

  let numero = 0;
  for (const item of lista) {
    if (item.numero > numero) numero = item.numero;
  }
  numero += 1;

  const filas = [];
  for (const planta of plantasEntrada) {
    const metodo = String(planta?.metodo || "").trim();
    const etapa = String(planta?.etapa || "").trim();
    const fechaInicioEtapa = String(planta?.fechaInicioEtapa || "").trim();
    if (metodo === "otro") return { error: "Escribí el nombre del método." };
    const errorEtapa = validarEtapaInicial(etapa, fechaInicioEtapa);
    if (errorEtapa) return { error: errorEtapa };
    filas.push({
      genetica: String(planta?.genetica || "").trim(),
      metodo,
      sustrato: String(planta?.sustrato || "").trim(),
      etapa,
      fechaInicioEtapa,
    });
  }

  const { data: creada, error: errorUnidad } = await supabase
    .from("unidades_cultivo")
    .insert({
      espacio_id: espacioId,
      nombre,
      tipo: tipoUnidad.tipo,
      tipo_personalizado: tipoUnidad.tipo_personalizado,
      numero,
    })
    .select("id")
    .single();

  if (errorUnidad || !creada) return { error: "No se pudo crear la unidad." };

  const hoy = fechaHoy();
  const origenes = [];
  const filasPlantas = filas.map((planta, posicion) => {
    const n = posicion + 1;
    origenes.push({
      unidad_cultivo_id: creada.id,
      numero: n,
      etapa: planta.etapa,
      fechaInicioEtapa: planta.fechaInicioEtapa,
    });
    return {
      unidad_cultivo_id: creada.id,
      numero: n,
      nombre: `Planta ${n}`,
      genetica: planta.genetica || null,
      metodo: planta.metodo || null,
      sustrato: planta.sustrato || null,
      etapa: planta.etapa,
      fecha_inicio: hoy,
      estado: estadoPorEtapa(planta.etapa),
    };
  });

  const { data: plantasCreadas, error: errorPlantas } = await supabase
    .from("plantas")
    .insert(filasPlantas)
    .select("id, unidad_cultivo_id, numero");
  if (errorPlantas || !plantasCreadas?.length) {
    await supabase.from("unidades_cultivo").delete().eq("id", creada.id);
    return { error: "No se pudieron crear las plantas." };
  }

  const historial = filasDeHistorial(plantasCreadas, origenes);
  if (historial.some((fila) => !fila)) {
    await supabase.from("unidades_cultivo").delete().eq("id", creada.id);
    return { error: "No se pudo guardar la etapa." };
  }

  const { error: errorHistorial } = await supabase.from("historial_etapas").insert(historial);
  if (errorHistorial) {
    await supabase.from("unidades_cultivo").delete().eq("id", creada.id);
    return { error: "No se pudo guardar la etapa." };
  }

  const errorMetodos = await guardarMetodosPersonalizados(
    supabase,
    user.id,
    filasPlantas.map((planta) => planta.metodo)
  );

  if (errorMetodos) {
    await supabase.from("unidades_cultivo").delete().eq("id", creada.id);
    return { error: "No se pudo guardar el método." };
  }

  revalidatePath("/espacios");
  revalidatePath(`/espacios/${espacioId}`);
  redirect(`/espacios/${espacioId}`);
}
