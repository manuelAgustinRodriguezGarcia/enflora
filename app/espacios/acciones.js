"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { estadoPorEtapa, fechaHoy, filasDeHistorial, validarEtapaInicial } from "@/lib/etapas";
import { guardarMetodosPersonalizados } from "@/lib/metodos-usuario";
import { configuracionLista } from "@/lib/supabase/configuracion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { datosTipoUnidad, tipoUnidadPermitido } from "@/lib/unidades";

const MAXIMO_UNIDADES = 20;
const MAXIMO_PLANTAS = 100;

function leerCultivo(formulario) {
  try {
    const valor = JSON.parse(String(formulario.get("cultivo") || ""));
    if (!valor || typeof valor !== "object") return null;
    return valor;
  } catch {
    return null;
  }
}

export async function crearCultivo(_estado, formulario) {
  const cultivo = leerCultivo(formulario);
  const nombre = String(cultivo?.nombre || "").trim();
  const tipo = String(cultivo?.tipo || "").trim();
  const unidades = Array.isArray(cultivo?.unidades) ? cultivo.unidades : null;

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (tipo !== "interior" && tipo !== "exterior") {
    return { error: "Seleccioná un tipo de espacio." };
  }
  if (!unidades || unidades.length < 1 || unidades.length > MAXIMO_UNIDADES) {
    return { error: "Seleccioná un tipo de unidad." };
  }

  const filasUnidades = [];
  const plantasPorUnidad = [];

  for (let indice = 0; indice < unidades.length; indice += 1) {
    const unidad = unidades[indice];
    const nombreUnidad = String(unidad?.nombre || "").trim();
    const tipoUnidad = String(unidad?.tipo || "").trim();
    const plantas = Array.isArray(unidad?.plantas) ? unidad.plantas : [];
    const datosTipo = datosTipoUnidad(tipo, tipoUnidad, unidad?.tipoPersonalizado);

    if (!nombreUnidad) return { error: "El nombre es obligatorio." };
    if (datosTipo.error) return { error: datosTipo.error };
    if (plantas.length < 1 || plantas.length > MAXIMO_PLANTAS) {
      return { error: "Seleccioná al menos una planta." };
    }

    const filas = [];
    for (const planta of plantas) {
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

    filasUnidades.push({
      nombre: nombreUnidad,
      tipo: datosTipo.tipo,
      tipo_personalizado: datosTipo.tipo_personalizado,
      numero: indice + 1,
    });
    plantasPorUnidad.push(filas);
  }

  if (!configuracionLista()) return { error: "Falta la configuración de Supabase." };

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ingreso");

  const { data: espacio, error: errorEspacio } = await supabase
    .from("espacios")
    .insert({ usuario_id: user.id, nombre, tipo })
    .select("id")
    .single();

  if (errorEspacio || !espacio) return { error: "No se pudo crear el espacio." };

  const { data: unidadesCreadas, error: errorUnidades } = await supabase
    .from("unidades_cultivo")
    .insert(filasUnidades.map((unidad) => ({ ...unidad, espacio_id: espacio.id })))
    .select("id, numero");

  if (errorUnidades || !unidadesCreadas?.length) {
    await supabase.from("espacios").delete().eq("id", espacio.id);
    return { error: "No se pudo crear el espacio." };
  }

  const porNumero = new Map(unidadesCreadas.map((unidad) => [unidad.numero, unidad.id]));
  const filasPlantas = [];
  const origenes = [];
  const hoy = fechaHoy();

  plantasPorUnidad.forEach((plantas, indice) => {
    const unidadId = porNumero.get(indice + 1);
    plantas.forEach((planta, posicion) => {
      const numero = posicion + 1;
      filasPlantas.push({
        unidad_cultivo_id: unidadId,
        numero,
        nombre: `Planta ${numero}`,
        genetica: planta.genetica || null,
        metodo: planta.metodo || null,
        sustrato: planta.sustrato || null,
        etapa: planta.etapa,
        fecha_inicio: hoy,
        estado: estadoPorEtapa(planta.etapa),
      });
      origenes.push({
        unidad_cultivo_id: unidadId,
        numero,
        etapa: planta.etapa,
        fechaInicioEtapa: planta.fechaInicioEtapa,
      });
    });
  });

  const { data: plantasCreadas, error: errorPlantas } = await supabase
    .from("plantas")
    .insert(filasPlantas)
    .select("id, unidad_cultivo_id, numero");

  if (errorPlantas || !plantasCreadas?.length) {
    await supabase.from("espacios").delete().eq("id", espacio.id);
    return { error: "No se pudieron crear las plantas." };
  }

  const historial = filasDeHistorial(plantasCreadas, origenes);
  if (historial.some((fila) => !fila)) {
    await supabase.from("espacios").delete().eq("id", espacio.id);
    return { error: "No se pudo guardar la etapa." };
  }

  const { error: errorHistorial } = await supabase.from("historial_etapas").insert(historial);
  if (errorHistorial) {
    await supabase.from("espacios").delete().eq("id", espacio.id);
    return { error: "No se pudo guardar la etapa." };
  }

  const errorMetodos = await guardarMetodosPersonalizados(
    supabase,
    user.id,
    filasPlantas.map((planta) => planta.metodo)
  );

  if (errorMetodos) {
    await supabase.from("espacios").delete().eq("id", espacio.id);
    return { error: "No se pudo guardar el método." };
  }

  revalidatePath("/espacios");
  redirect(`/espacios/${espacio.id}`);
}

export async function editarEspacio(_estado, formulario) {
  const espacioId = String(formulario.get("espacio_id") || "").trim();
  const nombre = String(formulario.get("nombre") || "").trim();
  const tipo = String(formulario.get("tipo") || "").trim();

  if (!nombre) {
    return { error: "El nombre es obligatorio.", nombre, tipo };
  }

  if (tipo !== "interior" && tipo !== "exterior") {
    return { error: "Seleccioná un tipo de espacio.", nombre, tipo };
  }

  if (!espacioId) {
    return { error: "No se encontró el espacio.", nombre, tipo };
  }

  if (!configuracionLista()) {
    return { error: "Falta la configuración de Supabase.", nombre, tipo };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/ingreso");
  }

  const { data: unidades, error: errorUnidades } = await supabase
    .from("unidades_cultivo")
    .select("tipo")
    .eq("espacio_id", espacioId);

  if (errorUnidades) {
    return { error: "No se pudo editar el espacio.", nombre, tipo };
  }

  const incompatible = (unidades || []).some((unidad) => !tipoUnidadPermitido(tipo, unidad.tipo));
  if (incompatible) {
    return {
      error: "No se puede cambiar el tipo porque hay unidades que no corresponden.",
      nombre,
      tipo,
    };
  }

  const { data, error } = await supabase
    .from("espacios")
    .update({ nombre, tipo })
    .eq("id", espacioId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo editar el espacio.", nombre, tipo };
  }

  revalidatePath("/espacios");
  revalidatePath(`/espacios/${espacioId}`);
  redirect(`/espacios/${espacioId}`);
}

export async function eliminarEspacio(_estado, formulario) {
  const espacioId = String(formulario.get("espacio_id") || "").trim();

  if (!espacioId) {
    return { error: "No se encontró el espacio." };
  }

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

  const { data, error } = await supabase
    .from("espacios")
    .delete()
    .eq("id", espacioId)
    .select("id");

  if (error || !data?.length) {
    return { error: "No se pudo eliminar el espacio." };
  }

  revalidatePath("/espacios");
  revalidatePath(`/espacios/${espacioId}`);
  redirect("/espacios");
}
