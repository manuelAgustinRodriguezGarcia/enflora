import "server-only";

import { esUuidGaleria } from "@/lib/flora-galeria-fotos";
import {
  acotarLimiteTandaGaleria,
  evaluarNivelBeneficiosFlora,
  tandaGaleriaFlora,
} from "@/lib/flora-beneficios";
import {
  ALCANCE_PLANTAS_GRATUITO,
  FLORA_CHAT_COMERCIAL,
  limitePlantasComercial,
} from "@/lib/flora-beneficios-comercial";
import { POLITICA_FLORA_IA } from "@/lib/flora-beneficios-politica";
import { leerAmbientePagos } from "@/lib/pagos/ambiente";
import { licenciaHabilita } from "@/lib/pagos/cobertura";
import { consultarPlusActivo } from "@/lib/pagos/plus/leer-plus-activo";
import { MAXIMO_PLANTAS } from "@/lib/unidades";

export {
  TANDA_GALERIA_GRATUITO,
  TANDA_GALERIA_PLUS,
  acotarLimiteTandaGaleria,
  evaluarNivelBeneficiosFlora,
  tandaGaleriaFlora,
} from "@/lib/flora-beneficios";

function ambienteLicenciaConsulta() {
  const lectura = leerAmbientePagos();
  if (lectura.ok) return lectura.ambiente;
  return "produccion";
}

async function licenciaActivaParaUnidadAncla(supabase, usuarioId, unidadCultivoId, ambiente) {
  const { data: ciclos, error: errorCiclos } = await supabase
    .from("ciclos_cultivo")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("unidad_ancla_id", unidadCultivoId)
    .eq("estado", "activo");

  if (errorCiclos) {
    if (/ciclos_cultivo|42P01|PGRST205/i.test(`${errorCiclos.message || ""}`)) {
      return { ok: false, habilitada: false, pagosDisponibles: false };
    }
    return { ok: false, habilitada: false, pagosDisponibles: true };
  }

  const cicloIds = (ciclos || []).map((c) => c.id).filter(Boolean);
  if (cicloIds.length === 0) return { ok: true, habilitada: false, pagosDisponibles: true };

  const { data: licencias, error: errorLicencias } = await supabase
    .from("licencias_cultivo")
    .select("ciclo_cultivo_id, pago_id, estado, usuario_id")
    .eq("usuario_id", usuarioId)
    .eq("estado", "activa")
    .in("ciclo_cultivo_id", cicloIds);

  if (errorLicencias) {
    if (/licencias_cultivo|42P01|PGRST205/i.test(`${errorLicencias.message || ""}`)) {
      return { ok: false, habilitada: false, pagosDisponibles: false };
    }
    return { ok: false, habilitada: false, pagosDisponibles: true };
  }

  const pagoIds = [...new Set((licencias || []).map((l) => l.pago_id).filter(Boolean))];
  if (pagoIds.length === 0) return { ok: true, habilitada: false, pagosDisponibles: true };

  const { data: pagos, error: errorPagos } = await supabase
    .from("pagos")
    .select("id, estado, ambiente, usuario_id, ciclo_cultivo_id")
    .in("id", pagoIds);

  if (errorPagos) {
    if (/pagos|42P01|PGRST205/i.test(`${errorPagos.message || ""}`)) {
      return { ok: false, habilitada: false, pagosDisponibles: false };
    }
    return { ok: false, habilitada: false, pagosDisponibles: true };
  }

  const pagosPorId = new Map((pagos || []).map((p) => [p.id, p]));
  for (const licencia of licencias || []) {
    const pago = pagosPorId.get(licencia.pago_id);
    if (licenciaHabilita({ licencia, pago, ambiente, usuarioId })) {
      return { ok: true, habilitada: true, pagosDisponibles: true };
    }
  }
  return { ok: true, habilitada: false, pagosDisponibles: true };
}

export async function resolverBeneficiosFlora(supabase, usuarioId, { unidadCultivoId } = {}) {
  const ambiente = ambienteLicenciaConsulta();
  const plusConsulta = await consultarPlusActivo(supabase, usuarioId);
  const plusActivo = plusConsulta.activo;
  let licenciaEnUnidad = false;
  let pagosDisponibles = true;

  if (unidadCultivoId && esUuidGaleria(unidadCultivoId)) {
    const licencia = await licenciaActivaParaUnidadAncla(
      supabase,
      usuarioId,
      unidadCultivoId,
      ambiente,
    );
    licenciaEnUnidad = licencia.habilitada;
    pagosDisponibles = licencia.pagosDisponibles;
  }

  const nivel = evaluarNivelBeneficiosFlora({ plusActivo, licenciaEnUnidad });
  const limitePlantas = limitePlantasComercial(nivel, MAXIMO_PLANTAS);
  return {
    nivel,
    ambiente,
    tandaGaleria: tandaGaleriaFlora(nivel),
    limitePlantas,
    alcancePlantas: ALCANCE_PLANTAS_GRATUITO,
    plantasIlimitadasComercial: nivel === "plus",
    floraChatComercial: { ...FLORA_CHAT_COMERCIAL, politica: POLITICA_FLORA_IA },
    plusActivo,
    licenciaEnUnidad,
    plusRegistrableEnDb: plusConsulta.dbDisponible,
    pagosDisponibles,
  };
}
