import "server-only";

import { esUuidGaleria } from "@/lib/flora-galeria-fotos";
import {
  acotarLimiteTandaGaleria,
  evaluarNivelBeneficiosFlora,
  tandaGaleriaFlora,
} from "@/lib/flora-beneficios";
import { leerAmbientePagos } from "@/lib/pagos/ambiente";
import { licenciaHabilita } from "@/lib/pagos/cobertura";

export {
  TANDA_GALERIA_GRATUITO,
  TANDA_GALERIA_PLUS,
  acotarLimiteTandaGaleria,
  evaluarNivelBeneficiosFlora,
  tandaGaleriaFlora,
} from "@/lib/flora-beneficios";

async function leerPlusActivo(_supabase, _usuarioId) {
  // Sprint 3.10: tabla/API de suscripción PLAN 420 aún no modelada en Supabase.
  return false;
}

function ambienteLicenciaConsulta() {
  const lectura = leerAmbientePagos();
  if (lectura.ok) return lectura.ambiente;
  return "produccion";
}

async function licenciaActivaParaUnidadAncla(supabase, usuarioId, unidadCultivoId) {
  const ambiente = ambienteLicenciaConsulta();
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
    if (licenciaHabilita({ licencia, pago, ambiente })) {
      return { ok: true, habilitada: true, pagosDisponibles: true };
    }
  }
  return { ok: true, habilitada: false, pagosDisponibles: true };
}

export async function resolverBeneficiosFlora(supabase, usuarioId, { unidadCultivoId } = {}) {
  const plusActivo = await leerPlusActivo(supabase, usuarioId);
  let licenciaEnUnidad = false;
  let pagosDisponibles = true;

  if (unidadCultivoId && esUuidGaleria(unidadCultivoId)) {
    const licencia = await licenciaActivaParaUnidadAncla(supabase, usuarioId, unidadCultivoId);
    licenciaEnUnidad = licencia.habilitada;
    pagosDisponibles = licencia.pagosDisponibles;
  }

  const nivel = evaluarNivelBeneficiosFlora({ plusActivo, licenciaEnUnidad });
  return {
    nivel,
    tandaGaleria: tandaGaleriaFlora(nivel),
    plusActivo,
    licenciaEnUnidad,
    plusRegistrableEnDb: false,
    pagosDisponibles,
  };
}
