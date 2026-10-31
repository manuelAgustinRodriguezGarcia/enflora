import "server-only";

import {
  evaluarAltaPlantas,
  limitePlantasComercial,
} from "@/lib/flora-beneficios-comercial";
import { resolverBeneficiosFlora } from "@/lib/flora-beneficios-servidor";
import { MAXIMO_PLANTAS } from "@/lib/unidades";

export async function contarPlantasEnUnidad(supabase, unidadId) {
  const { count, error } = await supabase
    .from("plantas")
    .select("id", { count: "exact", head: true })
    .eq("unidad_cultivo_id", unidadId);

  if (error) return { ok: false, error: "No se pudieron contar las plantas." };
  return { ok: true, count: count ?? 0 };
}

/**
 * Valida alta (o traslado neto) antes de insertar. Relee conteo en servidor; carreras simultáneas
 * pueden requerir constraint en DB (fuera de alcance de este sprint).
 */
export async function validarAltaPlantasEnUnidad(supabase, usuarioId, unidadId, cantidadAAgregar) {
  const agregar = Math.trunc(cantidadAAgregar);
  if (!unidadId) return { ok: false, error: "No se encontró la unidad." };
  if (!Number.isFinite(agregar) || agregar < 1) {
    return { ok: false, error: "Seleccioná al menos una planta." };
  }

  const [beneficios, conteo] = await Promise.all([
    resolverBeneficiosFlora(supabase, usuarioId, { unidadCultivoId: unidadId }),
    contarPlantasEnUnidad(supabase, unidadId),
  ]);

  if (!conteo.ok) return conteo;

  const limite = limitePlantasComercial(beneficios.nivel, MAXIMO_PLANTAS);
  const evaluacion = evaluarAltaPlantas({
    plantasExistentes: conteo.count,
    cantidadAAgregar: agregar,
    limitePermitido: limite,
  });

  if (!evaluacion.ok) {
    return {
      ok: false,
      error: evaluacion.mensaje,
      codigo: evaluacion.codigo,
      beneficios,
      limite,
    };
  }

  return {
    ok: true,
    beneficios,
    limite,
    existentes: evaluacion.existentes,
    totalDespues: evaluacion.totalDespues,
  };
}
