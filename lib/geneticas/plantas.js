import {
  esColumnaGeneticaAusente,
  esEsquemaAusente,
  esUuid,
  nombreGeneticaLibre,
  sinColumnaGenetica,
} from "@/lib/geneticas/reglas";

const SELECCION = "id, unidad_cultivo_id, numero";

export async function resolverListaGeneticas(supabase, usuarioId, entradas) {
  const ids = [
    ...new Set(
      (entradas || [])
        .map((entrada) => String(entrada?.geneticaId || "").trim())
        .filter((id) => esUuid(id))
    ),
  ];

  let mapa = new Map();
  let sinTabla = false;

  if (ids.length) {
    const { data, error } = await supabase
      .from("geneticas")
      .select("id, nombre")
      .eq("usuario_id", usuarioId)
      .in("id", ids);

    if (error) {
      if (esEsquemaAusente(error)) sinTabla = true;
      else return { error: "No se pudo verificar la genética." };
    } else {
      mapa = new Map((data || []).map((fila) => [fila.id, fila.nombre]));
    }
  }

  const plantas = [];
  for (const entrada of entradas || []) {
    const id = String(entrada?.geneticaId || "").trim();
    const libre = nombreGeneticaLibre(entrada?.genetica);
    if (!id || sinTabla) {
      plantas.push({ genetica: libre, genetica_id: null });
      continue;
    }
    if (!esUuid(id) || !mapa.has(id)) return { error: "No se encontró la genética." };
    plantas.push({ genetica: mapa.get(id), genetica_id: id });
  }

  return { plantas };
}

export async function aplicarVinculoGenetica(supabase, usuarioId, lista) {
  const resuelto = await resolverListaGeneticas(supabase, usuarioId, lista);
  if (resuelto.error) return resuelto;
  return {
    plantas: lista.map((item, indice) => ({
      ...item,
      genetica: resuelto.plantas[indice].genetica,
      genetica_id: resuelto.plantas[indice].genetica_id,
    })),
  };
}

export async function insertarPlantas(supabase, filas) {
  const conVinculo = filas.some((fila) => fila.genetica_id);
  const enviadas = conVinculo ? filas : filas.map(sinColumnaGenetica);
  const intento = await supabase.from("plantas").insert(enviadas).select(SELECCION);
  if (intento.error && conVinculo && esColumnaGeneticaAusente(intento.error)) {
    return supabase.from("plantas").insert(filas.map(sinColumnaGenetica)).select(SELECCION);
  }
  return intento;
}

export async function actualizarPlanta(supabase, plantaId, unidadAnteriorId, campos) {
  const consultar = (valores) =>
    supabase
      .from("plantas")
      .update(valores)
      .eq("id", plantaId)
      .eq("unidad_cultivo_id", unidadAnteriorId)
      .select("id");

  const intento = await consultar(campos);
  if (!intento.error || !Object.prototype.hasOwnProperty.call(campos, "genetica_id")) return intento;
  if (!esColumnaGeneticaAusente(intento.error)) return intento;
  return consultar(sinColumnaGenetica(campos));
}
