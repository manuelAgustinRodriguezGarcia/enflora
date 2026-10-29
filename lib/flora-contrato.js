/** Contrato JSON común para respuestas del motor de recuperación (Sprint 2). */

export const FUENTE_CULTIVO = "cultivo";
export const FUENTE_GUIA = "guia_interna";
export const FUENTE_EXTERNA = "externa";

export const LIMITES_FLORA = {
  diasRecientesDefault: 7,
  diasRecientesMax: 14,
  registrosContextoReciente: 36,
  maxRegistrosResumenPeriodo: 120,
  maxRegistrosAccionPuntual: 60,
  maxRegistrosPorConsulta: 500,
  maxPaginasHistorial: 40,
  maxResultadosBusqueda: 50,
  maxFragmentosGuia: 8,
  maxCaracteresFragmento: 1200,
};

export function respuestaFlora({
  fuente,
  tipoConsulta,
  datos = null,
  entidades = null,
  periodo = null,
  metadatos = {},
  error = "",
  ambiguedades = null,
  limitaciones = [],
}) {
  const vacio =
    datos === null ||
    datos === undefined ||
    (Array.isArray(datos) && datos.length === 0) ||
    (typeof datos === "object" && !Array.isArray(datos) && Object.keys(datos).length === 0);

  return {
    fuente,
    tipoConsulta,
    entidades: entidades || undefined,
    periodo: periodo || undefined,
    datos,
    metadatos: {
      completo: metadatos.completo !== false,
      hayMas: Boolean(metadatos.hayMas),
      cantidad: metadatos.cantidad ?? (Array.isArray(datos) ? datos.length : datos ? 1 : 0),
      sinDatos: Boolean(metadatos.sinDatos ?? vacio),
      ...metadatos,
    },
    ambiguedades: ambiguedades?.length ? ambiguedades : undefined,
    limitaciones: limitaciones.length ? limitaciones : undefined,
    error: error || undefined,
  };
}

export function combinarRespuestasFlora(partes, { tipoConsulta = "combinada" } = {}) {
  const lista = (partes || []).filter(Boolean);
  return {
    tipoConsulta,
    partes: lista,
    metadatos: {
      fuentes: [...new Set(lista.map((item) => item.fuente))],
      conError: lista.some((item) => item.error),
      sinDatos: lista.every((item) => item.metadatos?.sinDatos),
    },
  };
}
