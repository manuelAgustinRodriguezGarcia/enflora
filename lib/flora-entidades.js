import { consultarUnidad } from "@/lib/consultar-unidad";
import { esUuid } from "@/lib/historial-registros";
import { normalizarGenetica } from "@/lib/registros";

function normalizarTexto(valor) {
  return String(valor || "").trim().toLowerCase();
}

export function opcionesAmbiguas(tipo, candidatos) {
  return candidatos.map((item) => ({
    tipo,
    id: item.id,
    etiqueta: item.etiqueta || item.nombre || item.id,
    detalle: item.detalle || undefined,
  }));
}

export async function resolverUnidad(supabase, { unidadId, nombre, espacioId } = {}) {
  if (unidadId) {
    if (!esUuid(unidadId)) {
      return { error: "El identificador de unidad no es válido.", unidad: null, ambiguedades: null };
    }
    const lectura = await consultarUnidad(supabase, { unidadId, espacioId });
    if (lectura.error || !lectura.unidad) {
      return { error: "No se encontró la unidad.", unidad: null, ambiguedades: null };
    }
    return { error: "", unidad: lectura.unidad, ambiguedades: null };
  }

  if (!nombre) return { error: "", unidad: null, ambiguedades: null };

  let consulta = supabase
    .from("unidades_cultivo")
    .select("id, nombre, tipo, numero, espacio_id")
    .ilike("nombre", nombre.trim());
  if (espacioId) consulta = consulta.eq("espacio_id", espacioId);

  const { data, error } = await consulta.limit(6);
  if (error) return { error: "No se pudo buscar la unidad.", unidad: null, ambiguedades: null };

  const coincidencias = (data || []).filter(
    (fila) => normalizarTexto(fila.nombre) === normalizarTexto(nombre)
  );
  if (coincidencias.length === 1) {
    return { error: "", unidad: coincidencias[0], ambiguedades: null };
  }
  if (coincidencias.length > 1) {
    return {
      error: "",
      unidad: null,
      ambiguedades: opcionesAmbiguas(
        "unidad",
        coincidencias.map((fila) => ({
          id: fila.id,
          etiqueta: fila.nombre,
          detalle: fila.tipo,
        }))
      ),
    };
  }
  return { error: "No se encontró la unidad.", unidad: null, ambiguedades: null };
}

export async function resolverPlanta(supabase, { plantaId, nombre, unidadId } = {}) {
  if (plantaId) {
    if (!esUuid(plantaId)) {
      return { error: "El identificador de planta no es válido.", planta: null, ambiguedades: null };
    }
    const { data, error } = await supabase
      .from("plantas")
      .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, estado, numero, unidad_cultivo_id")
      .eq("id", plantaId)
      .maybeSingle();
    if (error || !data) return { error: "No se encontró la planta.", planta: null, ambiguedades: null };
    if (unidadId && data.unidad_cultivo_id !== unidadId) {
      return { error: "La planta no pertenece a esa unidad.", planta: null, ambiguedades: null };
    }
    return { error: "", planta: data, ambiguedades: null };
  }

  if (!nombre) return { error: "", planta: null, ambiguedades: null };

  let consulta = supabase
    .from("plantas")
    .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, estado, numero, unidad_cultivo_id")
    .ilike("nombre", nombre.trim());
  if (unidadId) consulta = consulta.eq("unidad_cultivo_id", unidadId);

  const { data, error } = await consulta.limit(8);
  if (error) return { error: "No se pudo buscar la planta.", planta: null, ambiguedades: null };

  const coincidencias = (data || []).filter(
    (fila) => normalizarTexto(fila.nombre) === normalizarTexto(nombre)
  );
  if (coincidencias.length === 1) {
    return { error: "", planta: coincidencias[0], ambiguedades: null };
  }
  if (coincidencias.length > 1) {
    return {
      error: "",
      planta: null,
      ambiguedades: opcionesAmbiguas(
        "planta",
        coincidencias.map((fila) => ({
          id: fila.id,
          etiqueta: fila.nombre,
          detalle: fila.genetica,
        }))
      ),
    };
  }
  return { error: "No se encontró la planta.", planta: null, ambiguedades: null };
}

export async function cargarIndiceCultivos(supabase) {
  const { data: espacios, error: errorEspacios } = await supabase
    .from("espacios")
    .select("id, nombre")
    .order("nombre", { ascending: true });

  if (errorEspacios) return { error: "No se pudieron cargar los espacios.", indice: null };

  const { data: unidades, error: errorUnidades } = await supabase
    .from("unidades_cultivo")
    .select("id, nombre, tipo, numero, espacio_id")
    .order("numero", { ascending: true });

  if (errorUnidades) return { error: "No se pudieron cargar las unidades.", indice: null };

  const { data: plantas, error: errorPlantas } = await supabase
    .from("plantas")
    .select("id, nombre, genetica, etapa, estado, unidad_cultivo_id, numero")
    .order("numero", { ascending: true });

  if (errorPlantas) return { error: "No se pudieron cargar las plantas.", indice: null };

  const plantasPorUnidad = new Map();
  for (const planta of plantas || []) {
    const lista = plantasPorUnidad.get(planta.unidad_cultivo_id) || [];
    lista.push({
      id: planta.id,
      nombre: planta.nombre,
      genetica: planta.genetica,
      etapa: planta.etapa,
      estado: planta.estado,
      numero: planta.numero,
    });
    plantasPorUnidad.set(planta.unidad_cultivo_id, lista);
  }

  const unidadesPorEspacio = new Map();
  for (const unidad of unidades || []) {
    const lista = unidadesPorEspacio.get(unidad.espacio_id) || [];
    lista.push({
      id: unidad.id,
      nombre: unidad.nombre,
      tipo: unidad.tipo,
      numero: unidad.numero,
      plantas: plantasPorUnidad.get(unidad.id) || [],
    });
    unidadesPorEspacio.set(unidad.espacio_id, lista);
  }

  return {
    error: "",
    indice: (espacios || []).map((espacio) => ({
      id: espacio.id,
      nombre: espacio.nombre,
      unidades: unidadesPorEspacio.get(espacio.id) || [],
    })),
  };
}

export function filtrarPlantasPorGenetica(plantas, genetica) {
  const clave = normalizarGenetica(genetica);
  if (!clave) return plantas || [];
  return (plantas || []).filter((planta) => normalizarGenetica(planta.genetica) === clave);
}
