import "server-only";

import { afirmarFiltrosHistorial, cargarHistorialRegistros } from "@/lib/cargar-registros";
import { normalizarEtapasPlanta } from "@/lib/historial-vista-cultivo";
import { fechaHoy } from "@/lib/etapas";
import { normalizarFiltrosHistorial } from "@/lib/historial-registros";
import {
  agruparRegistrosPorDiaEvento,
  buscarEventoAccion,
  clasificarParametroNativo,
  contarAcciones,
  estadisticasMediciones,
  medicionesParametro,
  registroCompacto,
  registrosConAccion,
  resumirActividadDesdeRegistros,
} from "@/lib/flora-analisis";
import {
  FUENTE_CULTIVO,
  LIMITES_FLORA,
  combinarRespuestasFlora,
  respuestaFlora,
} from "@/lib/flora-contrato";
import {
  cargarIndiceCultivos,
  filtrarPlantasPorGenetica,
  resolverPlanta,
  resolverUnidad,
} from "@/lib/flora-entidades";
import { normalizarPeriodo } from "@/lib/flora-periodos";

export { combinarRespuestasFlora, LIMITES_FLORA };

export async function requiereSesionFlora(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { ok: false, error: "Se requiere una sesión autenticada." };
  }
  return { ok: true, usuario: data.user };
}

function filtrosHistorialBase({ unidadId, plantaId, genetica, desde, hasta }) {
  const normalizado = normalizarFiltrosHistorial({
    unidad: unidadId || "",
    planta: plantaId || "",
    genetica: genetica || "",
    desde: desde || "",
    hasta: hasta || "",
    contenido: "",
  });
  if (normalizado.error) return { error: normalizado.error, filtros: null };
  return { error: "", filtros: normalizado.filtros };
}

async function paginarHistorial(supabase, filtros, { maxRegistros = LIMITES_FLORA.maxRegistrosPorConsulta } = {}) {
  const acumulado = [];
  let cursor = filtros.cursor || null;
  let paginas = 0;
  let hayMas = true;

  while (hayMas && acumulado.length < maxRegistros && paginas < LIMITES_FLORA.maxPaginasHistorial) {
    paginas += 1;
    const pagina = await cargarHistorialRegistros(supabase, { ...filtros, cursor });
    if (pagina.error) return { error: "No se pudieron cargar los registros.", registros: [], parcial: false };
    const filas = pagina.registros || [];
    acumulado.push(...filas);
    if (!pagina.hayMas || !filas.length) {
      hayMas = pagina.hayMas;
      break;
    }
    const ultimo = filas[filas.length - 1];
    cursor = { fecha: ultimo.fecha_evento, id: ultimo.id };
    hayMas = pagina.hayMas;
  }

  const parcial = hayMas || acumulado.length >= maxRegistros;
  return { error: "", registros: acumulado.slice(0, maxRegistros), parcial, hayMas };
}

async function cargarPlantasUnidad(supabase, unidadId, { genetica, plantaId } = {}) {
  const { data, error } = await supabase
    .from("plantas")
    .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, estado, numero, unidad_cultivo_id")
    .eq("unidad_cultivo_id", unidadId)
    .order("numero", { ascending: true });

  if (error) return { error: "No se pudieron cargar las plantas.", plantas: [] };

  let plantas = data || [];
  if (genetica) plantas = filtrarPlantasPorGenetica(plantas, genetica);
  if (plantaId) plantas = plantas.filter((p) => p.id === plantaId);
  return { error: "", plantas };
}

async function cargarEtapasPlantas(supabase, plantas) {
  const ids = (plantas || []).map((p) => p.id).filter(Boolean);
  if (!ids.length) return { etapasPorPlanta: new Map(), cambiosRecientes: [] };

  const { data, error } = await supabase
    .from("historial_etapas")
    .select("id, planta_id, etapa, fecha_inicio, fecha_fin")
    .in("planta_id", ids)
    .order("fecha_inicio", { ascending: true });

  if (error) return { etapasPorPlanta: new Map(), cambiosRecientes: [] };

  const mapa = new Map();
  for (const fila of data || []) {
    const lista = mapa.get(fila.planta_id) || [];
    lista.push(fila);
    mapa.set(fila.planta_id, lista);
  }

  const cambiosRecientes = [];
  for (const planta of plantas) {
    const normalizadas = normalizarEtapasPlanta(mapa.get(planta.id) || [], planta.fecha_inicio, fechaHoy());
    const ultima = normalizadas[normalizadas.length - 1];
    if (ultima) {
      cambiosRecientes.push({
        planta_id: planta.id,
        nombre: planta.nombre,
        etapa_actual: ultima.etapa,
        fecha_inicio: ultima.fechaInicio,
        historial: normalizadas.map((e) => ({
          id: e.id,
          etapa: e.etapa,
          fecha_inicio: e.fechaInicio,
          fecha_fin: e.fechaFin,
          duracion_dias: e.duracion,
        })),
      });
    }
  }

  return { etapasPorPlanta: mapa, cambiosRecientes };
}

function plantaResumen(planta) {
  return {
    id: planta.id,
    nombre: planta.nombre,
    numero: planta.numero,
    genetica: planta.genetica,
    metodo: planta.metodo,
    sustrato: planta.sustrato,
    etapa: planta.etapa,
    fecha_inicio: planta.fecha_inicio,
    estado: planta.estado,
    unidad_cultivo_id: planta.unidad_cultivo_id,
  };
}

export async function obtenerContextoCultivo(supabase, opciones = {}) {
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "contexto_inicial",
      datos: null,
      error: sesion.error,
    });
  }

  const diasRecientes =
    opciones.diasRecientes === 14 ? 14 : LIMITES_FLORA.diasRecientesDefault;
  const periodoNorm = normalizarPeriodo({
    diasRecientes,
    preset: diasRecientes === 14 ? "ultimos_14" : "ultimos_7",
  });
  if (periodoNorm.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "contexto_inicial",
      error: periodoNorm.error,
      datos: null,
    });
  }

  let unidad = null;
  let ambiguedades = [];
  if (opciones.unidadId || opciones.nombreUnidad) {
    const resuelta = await resolverUnidad(supabase, {
      unidadId: opciones.unidadId,
      nombre: opciones.nombreUnidad,
      espacioId: opciones.espacioId,
    });
    if (resuelta.error) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta: "contexto_inicial",
        error: resuelta.error,
        datos: null,
      });
    }
    if (resuelta.ambiguedades?.length) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta: "contexto_inicial",
        datos: null,
        ambiguedades: resuelta.ambiguedades,
        metadatos: { sinDatos: true },
      });
    }
    unidad = resuelta.unidad;
  }

  let planta = null;
  if (opciones.plantaId || opciones.nombrePlanta) {
    const resuelta = await resolverPlanta(supabase, {
      plantaId: opciones.plantaId,
      nombre: opciones.nombrePlanta,
      unidadId: unidad?.id,
    });
    if (resuelta.error) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta: "contexto_inicial",
        error: resuelta.error,
        datos: null,
      });
    }
    if (resuelta.ambiguedades?.length) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta: "contexto_inicial",
        datos: null,
        ambiguedades: resuelta.ambiguedades,
        metadatos: { sinDatos: true },
      });
    }
    planta = resuelta.planta;
    if (!unidad && planta?.unidad_cultivo_id) {
      const u = await resolverUnidad(supabase, { unidadId: planta.unidad_cultivo_id });
      unidad = u.unidad;
    }
  }

  if (!unidad && !planta) {
    const indice = await cargarIndiceCultivos(supabase);
    if (indice.error) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta: "contexto_inicial",
        error: indice.error,
        datos: null,
      });
    }
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "contexto_inicial",
      periodo: periodoNorm.periodo,
      datos: {
        modo: "indice",
        espacios: indice.indice,
      },
      metadatos: {
        completo: true,
        sinDatos: !indice.indice?.length,
      },
    });
  }

  const plantasLectura = await cargarPlantasUnidad(supabase, unidad.id, {
    genetica: opciones.genetica,
    plantaId: planta?.id,
  });
  if (plantasLectura.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "contexto_inicial",
      error: plantasLectura.error,
      datos: null,
    });
  }

  const filtrosBase = filtrosHistorialBase({
    unidadId: unidad.id,
    plantaId: planta?.id,
    genetica: opciones.genetica,
    desde: periodoNorm.periodo.desde,
    hasta: periodoNorm.periodo.hasta,
  });
  if (filtrosBase.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "contexto_inicial",
      error: filtrosBase.error,
      datos: null,
    });
  }

  const afirmacion = await afirmarFiltrosHistorial(supabase, filtrosBase.filtros);
  if (afirmacion.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "contexto_inicial",
      error: afirmacion.error,
      datos: null,
    });
  }

  const [historial, etapasInfo] = await Promise.all([
    paginarHistorial(supabase, filtrosBase.filtros, {
      maxRegistros: LIMITES_FLORA.registrosContextoReciente,
    }),
    cargarEtapasPlantas(supabase, plantasLectura.plantas),
  ]);

  if (historial.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "contexto_inicial",
      error: historial.error,
      datos: null,
    });
  }

  const registrosCompactos = historial.registros.map(registroCompacto).filter(Boolean);
  const resumen = resumirActividadDesdeRegistros(historial.registros, {
    periodo: periodoNorm.periodo,
    etapas: etapasInfo.cambiosRecientes,
  });

  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta: "contexto_inicial",
    periodo: periodoNorm.periodo,
    entidades: {
      unidad_id: unidad.id,
      unidad_nombre: unidad.nombre,
      planta_id: planta?.id || null,
      plantas: plantasLectura.plantas.map(plantaResumen),
    },
    datos: {
      modo: "alcance",
      unidad: { id: unidad.id, nombre: unidad.nombre, tipo: unidad.tipo },
      plantas: plantasLectura.plantas.map(plantaResumen),
      etapas: etapasInfo.cambiosRecientes,
      resumen_reciente: resumen,
      registros_recientes: registrosCompactos,
    },
    ambiguedades: ambiguedades.length ? ambiguedades : undefined,
    metadatos: {
      completo: !historial.parcial,
      hayMas: historial.hayMas,
      cantidad: registrosCompactos.length,
    },
    limitaciones: historial.parcial
      ? ["El contexto reciente está truncado por límites de volumen."]
      : undefined,
  });
}

export async function resumirActividadPeriodo(supabase, opciones = {}) {
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "resumen_periodo",
      error: sesion.error,
      datos: null,
    });
  }

  const periodoNorm = normalizarPeriodo(opciones);
  if (periodoNorm.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "resumen_periodo",
      error: periodoNorm.error,
      datos: null,
    });
  }

  const filtrosBase = filtrosHistorialBase({
    unidadId: opciones.unidadId,
    plantaId: opciones.plantaId,
    genetica: opciones.genetica,
    desde: periodoNorm.periodo.desde,
    hasta: periodoNorm.periodo.hasta,
  });
  if (filtrosBase.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "resumen_periodo",
      error: filtrosBase.error,
      datos: null,
    });
  }

  const afirmacion = await afirmarFiltrosHistorial(supabase, filtrosBase.filtros);
  if (afirmacion.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "resumen_periodo",
      error: afirmacion.error,
      datos: null,
    });
  }

  const historial = await paginarHistorial(supabase, filtrosBase.filtros, {
    maxRegistros: opciones.maxRegistros || LIMITES_FLORA.maxRegistrosPorConsulta,
  });
  if (historial.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "resumen_periodo",
      error: historial.error,
      datos: null,
    });
  }

  const resumen = resumirActividadDesdeRegistros(historial.registros, {
    periodo: periodoNorm.periodo,
  });

  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta: "resumen_periodo",
    periodo: periodoNorm.periodo,
    entidades: {
      unidad_id: opciones.unidadId || null,
      planta_id: opciones.plantaId || null,
    },
    datos: resumen,
    metadatos: {
      completo: !historial.parcial,
      hayMas: historial.hayMas,
    },
    limitaciones: historial.parcial ? ["El resumen puede estar incompleto por límites de consulta."] : undefined,
  });
}

export async function compararPeriodosActividad(supabase, opciones = {}) {
  const periodoA = normalizarPeriodo(opciones.periodoA || { preset: "semana_actual" });
  const periodoB = normalizarPeriodo(opciones.periodoB || { preset: "semana_anterior" });
  if (periodoA.error || periodoB.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "comparar_periodos",
      error: periodoA.error || periodoB.error,
      datos: null,
    });
  }

  const [a, b] = await Promise.all([
    resumirActividadPeriodo(supabase, {
      ...opciones,
      preset: undefined,
      desde: periodoA.periodo.desde,
      hasta: periodoA.periodo.hasta,
    }),
    resumirActividadPeriodo(supabase, {
      ...opciones,
      preset: undefined,
      desde: periodoB.periodo.desde,
      hasta: periodoB.periodo.hasta,
    }),
  ]);

  if (a.error || b.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "comparar_periodos",
      error: a.error || b.error,
      datos: null,
    });
  }

  let comparacionParametro = null;
  if (opciones.parametro) {
    const filtro = { claveNativa: opciones.parametro.claveNativa, opcionId: opciones.parametro.opcionId };
    const [regsA, regsB] = await Promise.all([
      paginarHistorial(
        supabase,
        filtrosHistorialBase({
          unidadId: opciones.unidadId,
          plantaId: opciones.plantaId,
          genetica: opciones.genetica,
          desde: periodoA.periodo.desde,
          hasta: periodoA.periodo.hasta,
        }).filtros
      ),
      paginarHistorial(
        supabase,
        filtrosHistorialBase({
          unidadId: opciones.unidadId,
          plantaId: opciones.plantaId,
          genetica: opciones.genetica,
          desde: periodoB.periodo.desde,
          hasta: periodoB.periodo.hasta,
        }).filtros
      ),
    ]);
    const statsA = estadisticasMediciones(medicionesParametro(regsA.registros, filtro));
    const statsB = estadisticasMediciones(medicionesParametro(regsB.registros, filtro));
    comparacionParametro = {
      parametro: opciones.parametro,
      periodo_a: statsA,
      periodo_b: statsB,
      comparable: statsA.comparable && statsB.comparable && statsA.unidades.join() === statsB.unidades.join(),
    };
    if (!comparacionParametro.comparable) {
      comparacionParametro.limitacion = "Mediciones insuficientes o unidades no comparables.";
    }
  }

  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta: "comparar_periodos",
    datos: {
      periodo_a: { periodo: periodoA.periodo, resumen: a.datos },
      periodo_b: { periodo: periodoB.periodo, resumen: b.datos },
      parametro: comparacionParametro,
    },
    metadatos: {
      completo: a.metadatos.completo && b.metadatos.completo,
      hayMas: a.metadatos.hayMas || b.metadatos.hayMas,
    },
  });
}

export async function buscarAccionesHistoricas(supabase, opciones = {}) {
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "buscar_acciones",
      error: sesion.error,
      datos: null,
    });
  }

  const filtroAccion = {
    claveNativa: opciones.claveNativa,
    opcionId: opciones.opcionId,
    nombre: opciones.nombreAccion,
  };

  const periodoNorm = opciones.desde || opciones.hasta || opciones.preset
    ? normalizarPeriodo(opciones)
    : { error: "", periodo: null };

  if (periodoNorm.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "buscar_acciones",
      error: periodoNorm.error,
      datos: null,
    });
  }

  const filtrosBase = filtrosHistorialBase({
    unidadId: opciones.unidadId,
    plantaId: opciones.plantaId,
    genetica: opciones.genetica,
    desde: periodoNorm.periodo?.desde,
    hasta: periodoNorm.periodo?.hasta,
  });
  if (filtrosBase.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "buscar_acciones",
      error: filtrosBase.error,
      datos: null,
    });
  }

  filtrosBase.filtros.contenidos = ["acciones"];

  const afirmacion = await afirmarFiltrosHistorial(supabase, filtrosBase.filtros);
  if (afirmacion.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "buscar_acciones",
      error: afirmacion.error,
      datos: null,
    });
  }

  const historial = await paginarHistorial(supabase, filtrosBase.filtros, {
    maxRegistros: opciones.maxRegistros || LIMITES_FLORA.maxRegistrosPorConsulta,
  });
  if (historial.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "buscar_acciones",
      error: historial.error,
      datos: null,
    });
  }

  const modo = opciones.modo || "ultimo";
  let datos = null;
  if (modo === "contar") {
    datos = { cantidad: contarAcciones(historial.registros, filtroAccion) };
  } else if (modo === "primero") {
    datos = { evento: buscarEventoAccion(historial.registros, filtroAccion, { orden: "asc" }) };
  } else if (modo === "listar") {
    datos = {
      eventos: registrosConAccion(historial.registros, filtroAccion)
        .slice(0, LIMITES_FLORA.maxResultadosBusqueda)
        .map(registroCompacto),
    };
  } else {
    datos = { evento: buscarEventoAccion(historial.registros, filtroAccion, { orden: "desc" }) };
  }

  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta: "buscar_acciones",
    periodo: periodoNorm.periodo || undefined,
    entidades: {
      unidad_id: opciones.unidadId || null,
      planta_id: opciones.plantaId || null,
    },
    datos,
    metadatos: {
      completo: !historial.parcial,
      hayMas: historial.hayMas,
      modo,
      sinDatos:
        modo === "contar"
          ? datos.cantidad === 0
          : modo === "listar"
            ? !datos.eventos?.length
            : !datos.evento,
    },
    limitaciones: historial.parcial
      ? ["La búsqueda histórica puede estar incompleta; hay más registros fuera del lote cargado."]
      : undefined,
  });
}

export async function consultarParametros(supabase, opciones = {}) {
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "consultar_parametros",
      error: sesion.error,
      datos: null,
    });
  }

  const periodoNorm = normalizarPeriodo(opciones);
  if (periodoNorm.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "consultar_parametros",
      error: periodoNorm.error,
      datos: null,
    });
  }

  const filtro = {
    claveNativa: opciones.claveNativa,
    opcionId: opciones.opcionId,
    nombre: opciones.nombre,
    aplicaA: opciones.aplicaA,
  };

  const filtrosBase = filtrosHistorialBase({
    unidadId: opciones.unidadId,
    plantaId: opciones.plantaId,
    genetica: opciones.genetica,
    desde: periodoNorm.periodo.desde,
    hasta: periodoNorm.periodo.hasta,
  });
  if (filtrosBase.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "consultar_parametros",
      error: filtrosBase.error,
      datos: null,
    });
  }
  filtrosBase.filtros.contenidos = ["parametros"];

  const historial = await paginarHistorial(supabase, filtrosBase.filtros);
  if (historial.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "consultar_parametros",
      error: historial.error,
      datos: null,
    });
  }

  const mediciones = medicionesParametro(historial.registros, filtro);
  const stats = estadisticasMediciones(mediciones);
  const clasificacion = opciones.claveNativa ? clasificarParametroNativo(opciones.claveNativa) : null;

  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta: "consultar_parametros",
    periodo: periodoNorm.periodo,
    datos: {
      clasificacion,
      mediciones: mediciones.slice(0, LIMITES_FLORA.maxResultadosBusqueda),
      estadisticas: stats,
    },
    metadatos: {
      completo: !historial.parcial,
      hayMas: historial.hayMas || mediciones.length > LIMITES_FLORA.maxResultadosBusqueda,
      sinDatos: !mediciones.length,
    },
    limitaciones: !stats.comparable && stats.medicionesNumericas > 0
      ? ["Hay unidades distintas; no se calcularon promedios agregados."]
      : historial.parcial
        ? ["Puede haber mediciones adicionales fuera del lote consultado."]
        : undefined,
  });
}

export async function consultarActividadPorFechas(supabase, opciones = {}) {
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "actividad_diaria",
      error: sesion.error,
      datos: null,
    });
  }

  const periodoNorm =
    opciones.desde || opciones.hasta
      ? normalizarPeriodo({ desde: opciones.desde, hasta: opciones.hasta })
      : normalizarPeriodo(opciones);
  if (periodoNorm.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "actividad_diaria",
      error: periodoNorm.error,
      datos: null,
    });
  }

  const filtrosBase = filtrosHistorialBase({
    unidadId: opciones.unidadId,
    plantaId: opciones.plantaId,
    genetica: opciones.genetica,
    desde: periodoNorm.periodo.desde,
    hasta: periodoNorm.periodo.hasta,
  });
  if (filtrosBase.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "actividad_diaria",
      error: filtrosBase.error,
      datos: null,
    });
  }

  const historial = await paginarHistorial(supabase, filtrosBase.filtros);
  if (historial.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "actividad_diaria",
      error: historial.error,
      datos: null,
    });
  }

  const dias = agruparRegistrosPorDiaEvento(historial.registros);

  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta: "actividad_diaria",
    periodo: periodoNorm.periodo,
    datos: dias,
    metadatos: {
      completo: !historial.parcial,
      hayMas: historial.hayMas,
      cantidad: historial.registros.length,
    },
  });
}

export async function consultarHistorialEtapas(supabase, opciones = {}) {
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "historial_etapas",
      error: sesion.error,
      datos: null,
    });
  }

  let planta = null;
  if (opciones.plantaId) {
    const resuelta = await resolverPlanta(supabase, { plantaId: opciones.plantaId });
    if (resuelta.error) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta: "historial_etapas",
        error: resuelta.error,
        datos: null,
      });
    }
    planta = resuelta.planta;
  }

  if (!planta && opciones.unidadId) {
    const plantas = await cargarPlantasUnidad(supabase, opciones.unidadId);
    const historiales = await cargarEtapasPlantas(supabase, plantas.plantas);
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "historial_etapas",
      entidades: { unidad_id: opciones.unidadId },
      datos: historiales.cambiosRecientes,
      metadatos: { sinDatos: !historiales.cambiosRecientes.length },
    });
  }

  if (!planta) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "historial_etapas",
      error: "Indicá una planta o unidad.",
      datos: null,
    });
  }

  const { etapasPorPlanta } = await cargarEtapasPlantas(supabase, [planta]);
  const historial = normalizarEtapasPlanta(
    [...(etapasPorPlanta.get(planta.id) || [])],
    planta.fecha_inicio,
    fechaHoy()
  );

  let accionesEnEtapa = null;
  if (opciones.etapa && opciones.unidadId) {
    const etapaObj = historial.find((e) => e.etapa === opciones.etapa);
    if (etapaObj) {
      const filtros = filtrosHistorialBase({
        unidadId: opciones.unidadId,
        plantaId: planta.id,
        desde: etapaObj.fechaInicio,
        hasta: etapaObj.fechaFin || fechaHoy(),
      });
      if (!filtros.error) {
        filtros.filtros.contenidos = ["acciones"];
        const pagina = await paginarHistorial(supabase, filtros.filtros, { maxRegistros: 200 });
        accionesEnEtapa = pagina.registros.map(registroCompacto);
      }
    }
  }

  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta: "historial_etapas",
    entidades: { planta_id: planta.id, nombre: planta.nombre },
    datos: {
      planta: plantaResumen(planta),
      etapas: historial.map((e) => ({
        id: e.id,
        etapa: e.etapa,
        fecha_inicio: e.fechaInicio,
        fecha_fin: e.fechaFin,
        duracion_dias: e.duracion,
        actual: e.actual,
      })),
      acciones_en_etapa: accionesEnEtapa,
    },
    metadatos: { sinDatos: !historial.length },
  });
}

export async function buscarFotosMetadatos(supabase, opciones = {}) {
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "fotos_metadatos",
      error: sesion.error,
      datos: null,
    });
  }

  const periodoNorm = normalizarPeriodo(opciones);
  if (periodoNorm.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "fotos_metadatos",
      error: periodoNorm.error,
      datos: null,
    });
  }

  const filtrosBase = filtrosHistorialBase({
    unidadId: opciones.unidadId,
    plantaId: opciones.plantaId,
    genetica: opciones.genetica,
    desde: periodoNorm.periodo.desde,
    hasta: periodoNorm.periodo.hasta,
  });
  if (filtrosBase.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "fotos_metadatos",
      error: filtrosBase.error,
      datos: null,
    });
  }

  const historial = await paginarHistorial(supabase, filtrosBase.filtros);
  if (historial.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "fotos_metadatos",
      error: historial.error,
      datos: null,
    });
  }

  const fotos = [];
  for (const registro of historial.registros) {
    for (const foto of registro.registro_fotos || []) {
      if (!foto?.id) continue;
      fotos.push({
        id: foto.id,
        fecha_evento: registro.fecha_evento,
        registro_id: registro.id,
        unidad_cultivo_id: registro.unidad_cultivo_id,
        planta_ids: (registro.registro_plantas || []).map((p) => p.planta_id).filter(Boolean),
        orden: foto.orden,
        descripcion: foto.descripcion || null,
      });
    }
  }

  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta: "fotos_metadatos",
    periodo: periodoNorm.periodo,
    datos: {
      cantidad: fotos.length,
      fotos: fotos.slice(0, LIMITES_FLORA.maxResultadosBusqueda),
    },
    metadatos: {
      sinDatos: fotos.length === 0,
      hayMas: fotos.length > LIMITES_FLORA.maxResultadosBusqueda || historial.parcial,
      completo: !historial.parcial,
    },
    limitaciones: ["Solo metadatos; no se incluyen archivos ni URLs firmadas."],
  });
}

/** Facade de herramientas conceptuales para el Sprint 3. */
export const HERRAMIENTAS_FLORA = {
  obtenerContextoCultivo,
  resumirActividadPeriodo,
  compararPeriodosActividad,
  buscarAccionesHistoricas,
  consultarParametros,
  consultarActividadPorFechas,
  consultarHistorialEtapas,
  buscarFotosMetadatos,
};
