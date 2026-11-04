import "server-only";

import { etiquetaTipo, esTipoTarea } from "@/lib/calendario/modelo";
import { almacenClima } from "@/lib/clima/almacen-servidor";
import { leerUbicacion } from "@/lib/clima/cargar";
import { TEXTO_ALERTA_OFICIAL, TEXTO_AVISO_ENFLORA, TEXTO_DESCARGO } from "@/lib/clima/constantes";
import { obtenerPronostico } from "@/lib/clima/servicio";
import { coordenadaLeida } from "@/lib/clima/validar";
import { afirmarFiltrosHistorial, cargarHistorialRegistros, cargarRegistroPorId } from "@/lib/cargar-registros";
import { normalizarEtapasPlanta } from "@/lib/historial-vista-cultivo";
import { etiquetaEtapa, fechaHoy, fechaValida } from "@/lib/etapas";
import { esUuid, limitesFechaHistorial, normalizarFiltrosHistorial } from "@/lib/historial-registros";
import {
  agruparRegistrosPorDiaEvento,
  aplicacionNutrientesDeRegistro,
  buscarEventoAccion,
  clasificarParametroNativo,
  contarAcciones,
  estadisticasMediciones,
  filtrarRegistrosDeAplicacion,
  medicionesParametro,
  NOTAS_APLICACIONES_NUTRIENTES,
  recortarAplicacionesNutrientes,
  registroCompacto,
  registrosConAccion,
  resumenProductosAplicados,
  resumirActividadDesdeRegistros,
  seleccionarProductosPorNombre,
  TOPE_PRODUCTOS_RESUMEN,
} from "@/lib/flora-analisis";
import {
  FUENTE_CULTIVO,
  FUENTE_EXTERNA,
  LIMITES_FLORA,
  combinarRespuestasFlora,
  respuestaFlora,
} from "@/lib/flora-contrato";
import {
  cargarIndiceCultivos,
  filtrarPlantasPorGenetica,
  opcionesAmbiguas,
  resolverPlanta,
  resolverUnidad,
} from "@/lib/flora-entidades";
import { relacionarEvolucion, TOPE_EVENTOS_CRUCE, TOPE_REGISTROS_CRUCE } from "@/lib/flora-cruce";
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
        etapa_nombre: etiquetaEtapa(ultima.etapa),
        fecha_inicio: ultima.fechaInicio,
        historial: normalizadas.map((e) => ({
          id: e.id,
          etapa: e.etapa,
          etapa_nombre: etiquetaEtapa(e.etapa),
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
    etapa_nombre: etiquetaEtapa(planta.etapa),
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
    maxRegistros: opciones.maxRegistros || LIMITES_FLORA.maxRegistrosResumenPeriodo,
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

  const modo = opciones.modo || "ultimo";
  const maxRegistrosBusqueda =
    opciones.maxRegistros ||
    (modo === "listar" ? LIMITES_FLORA.maxRegistrosPorConsulta : LIMITES_FLORA.maxRegistrosAccionPuntual);

  const historial = await paginarHistorial(supabase, filtrosBase.filtros, {
    maxRegistros: maxRegistrosBusqueda,
  });
  if (historial.error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta: "buscar_acciones",
      error: historial.error,
      datos: null,
    });
  }

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
        etapa_nombre: etiquetaEtapa(e.etapa),
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

const MODOS_NUTRIENTES = new Set(["ultimo", "listar", "contar", "productos"]);
const VISTAS_TAREA = new Set(["pendientes", "vencidas", "proximas", "completadas", "fecha"]);
const TOPE_TAREAS_FLORA = 30;
const NOTA_TAREA_NO_ES_REGISTRO =
  "Estas filas son tareas programadas. No confirman que exista un registro de cultivo.";
const NOTA_LOTE_INCOMPLETO = "La consulta puede estar incompleta: hay registros fuera del lote cargado.";

const SELECT_TAREAS_FLORA = `
  id,
  usuario_id,
  unidad_cultivo_id,
  tipo,
  descripcion,
  fecha_programada,
  hora_programada,
  estado,
  tarea_plantas (planta_id)
`;

function tareasNoDisponibles(error) {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (/tareas_programadas/i.test(texto)) return true;
  return ["PGRST200", "PGRST205", "42P01", "42703"].includes(error?.code);
}

function notaLote(parcial) {
  return parcial ? [NOTA_LOTE_INCOMPLETO] : [];
}

async function resolverAlcanceConsulta(supabase, opciones, tipoConsulta) {
  let unidad = null;
  if (opciones.unidadId || opciones.nombreUnidad) {
    const resuelta = await resolverUnidad(supabase, {
      unidadId: opciones.unidadId,
      nombre: opciones.nombreUnidad,
    });
    if (resuelta.error || resuelta.ambiguedades?.length || !resuelta.unidad) {
      return {
        corte: respuestaFlora({
          fuente: FUENTE_CULTIVO,
          tipoConsulta,
          error: resuelta.error || "",
          datos: null,
          ambiguedades: resuelta.ambiguedades,
          metadatos: { sinDatos: true },
        }),
      };
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
    if (resuelta.error || resuelta.ambiguedades?.length || !resuelta.planta) {
      return {
        corte: respuestaFlora({
          fuente: FUENTE_CULTIVO,
          tipoConsulta,
          error: resuelta.error || "",
          datos: null,
          ambiguedades: resuelta.ambiguedades,
          metadatos: { sinDatos: true },
        }),
      };
    }
    planta = resuelta.planta;
  }

  return { unidad, planta };
}

function ordenarPorFechaDesc(registros) {
  return [...(registros || [])].sort(
    (a, b) => new Date(b.fecha_evento).getTime() - new Date(a.fecha_evento).getTime()
  );
}

function registroSinMezcla(registro) {
  const compacto = registroCompacto(registro);
  if (!compacto) return null;
  return {
    id: compacto.id,
    fecha_evento: compacto.fecha_evento,
    acciones: compacto.acciones,
    plantas: compacto.plantas,
    tiene_mezcla_aplicada: false,
  };
}

export async function consultarAplicacionesNutrientes(supabase, opciones = {}) {
  const tipoConsulta = "aplicaciones_nutrientes";
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: sesion.error, datos: null });
  }

  const modo = opciones.modo || "ultimo";
  if (!MODOS_NUTRIENTES.has(modo)) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: "Modo de consulta inválido.", datos: null });
  }
  if (modo === "contar" && !String(opciones.nombreProducto || "").trim()) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta,
      error: "Indicá el nombre del producto tal como quedó guardado en el registro.",
      datos: null,
    });
  }

  const alcance = await resolverAlcanceConsulta(supabase, opciones, tipoConsulta);
  if (alcance.corte) return alcance.corte;

  if (opciones.registroId) {
    if (!esUuid(opciones.registroId)) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta,
        error: "El identificador del registro no es válido.",
        datos: null,
      });
    }
    const lectura = await cargarRegistroPorId(supabase, opciones.registroId);
    if (lectura.error) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta,
        error: "No se pudo leer el registro.",
        datos: null,
      });
    }
    const registro = lectura.registro;
    if (!registro || (registro.usuario_id && registro.usuario_id !== sesion.usuario.id)) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta,
        error: "No se encontró el registro.",
        datos: null,
      });
    }
    if (alcance.unidad && registro.unidad_cultivo_id !== alcance.unidad.id) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta,
        error: "El registro no pertenece a esa unidad.",
        datos: null,
      });
    }
    if (
      alcance.planta &&
      !(registro.registro_plantas || []).some((fila) => fila.planta_id === alcance.planta.id)
    ) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta,
        error: "El registro no pertenece a esa planta.",
        datos: null,
      });
    }
    const aplicacion = aplicacionNutrientesDeRegistro(registro);
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta,
      entidades: {
        unidad_id: registro.unidad_cultivo_id || null,
        planta_id: alcance.planta?.id || null,
        registro_id: registro.id,
      },
      datos: aplicacion
        ? { aplicacion, sin_mezcla: false }
        : { aplicacion: null, sin_mezcla: true, registro: registroSinMezcla(registro) },
      metadatos: { sinDatos: !aplicacion, completo: true },
      limitaciones: NOTAS_APLICACIONES_NUTRIENTES,
    });
  }

  const periodoNorm =
    opciones.desde || opciones.hasta || opciones.preset
      ? normalizarPeriodo(opciones)
      : { error: "", periodo: null };
  if (periodoNorm.error) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: periodoNorm.error, datos: null });
  }

  const filtrosBase = filtrosHistorialBase({
    unidadId: alcance.unidad?.id || opciones.unidadId,
    plantaId: alcance.planta?.id || opciones.plantaId,
    genetica: opciones.genetica,
    desde: periodoNorm.periodo?.desde,
    hasta: periodoNorm.periodo?.hasta,
  });
  if (filtrosBase.error) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: filtrosBase.error, datos: null });
  }
  filtrosBase.filtros.contenidos = ["acciones"];

  const historial = await paginarHistorial(supabase, filtrosBase.filtros, {
    maxRegistros: modo === "ultimo" ? LIMITES_FLORA.maxRegistrosAccionPuntual : LIMITES_FLORA.maxRegistrosPorConsulta,
  });
  if (historial.error) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: historial.error, datos: null });
  }

  const filtro = {
    claveNativa: opciones.claveNativa,
    nombreAccion: opciones.nombreAccion,
    nombreProducto: opciones.nombreProducto,
    nombreReceta: opciones.nombreReceta,
  };
  const pideMezcla = Boolean(filtro.nombreProducto || filtro.nombreReceta);
  const entidades = {
    unidad_id: alcance.unidad?.id || null,
    planta_id: alcance.planta?.id || null,
  };
  const base = {
    fuente: FUENTE_CULTIVO,
    tipoConsulta,
    periodo: periodoNorm.periodo || undefined,
    entidades,
  };

  if (modo === "ultimo") {
    const candidatos = ordenarPorFechaDesc(
      filtrarRegistrosDeAplicacion(historial.registros, {
        ...filtro,
        soloConMezcla: pideMezcla || (!filtro.claveNativa && !filtro.nombreAccion),
      })
    );
    const elegido = candidatos[0] || null;
    if (!elegido) {
      return respuestaFlora({
        ...base,
        datos: { aplicacion: null, sin_mezcla: false },
        metadatos: { sinDatos: true, completo: !historial.parcial, hayMas: historial.hayMas },
        limitaciones: [...NOTAS_APLICACIONES_NUTRIENTES, ...notaLote(historial.parcial)],
      });
    }
    const aplicacion = aplicacionNutrientesDeRegistro(elegido);
    return respuestaFlora({
      ...base,
      datos: aplicacion
        ? { aplicacion, sin_mezcla: false }
        : { aplicacion: null, sin_mezcla: true, registro: registroSinMezcla(elegido) },
      metadatos: { sinDatos: false, completo: true, hayMas: false },
      limitaciones: NOTAS_APLICACIONES_NUTRIENTES,
    });
  }

  const aplicados = ordenarPorFechaDesc(
    filtrarRegistrosDeAplicacion(historial.registros, { ...filtro, soloConMezcla: true })
  );

  if (modo === "contar") {
    const coincidencias = seleccionarProductosPorNombre(resumenProductosAplicados(aplicados), opciones.nombreProducto);
    if (coincidencias.length > 1) {
      return respuestaFlora({
        ...base,
        datos: {
          nombre_producto: String(opciones.nombreProducto).trim(),
          aplicaciones: null,
          coincidencias: coincidencias.map((item) => ({
            nombre_producto: item.nombre_producto,
            fabricante: item.fabricante,
            aplicaciones: item.aplicaciones,
          })),
        },
        ambiguedades: coincidencias.map((item) => ({
          tipo: "producto",
          id: `${item.nombre_producto}::${item.fabricante || ""}`,
          etiqueta: item.nombre_producto,
          detalle: item.fabricante || "sin fabricante",
        })),
        metadatos: { sinDatos: false, completo: !historial.parcial, hayMas: historial.hayMas },
        limitaciones: [...NOTAS_APLICACIONES_NUTRIENTES, ...notaLote(historial.parcial)],
      });
    }
    const unico = coincidencias[0] || null;
    const sinUsos = !unico;
    return respuestaFlora({
      ...base,
      datos: {
        nombre_producto: unico?.nombre_producto || String(opciones.nombreProducto).trim(),
        fabricante: unico?.fabricante || null,
        aplicaciones: sinUsos && historial.parcial ? null : unico?.aplicaciones || 0,
      },
      metadatos: {
        sinDatos: sinUsos,
        completo: !historial.parcial,
        hayMas: historial.hayMas,
      },
      limitaciones: [
        ...NOTAS_APLICACIONES_NUTRIENTES,
        ...notaLote(historial.parcial),
        ...(sinUsos && historial.parcial
          ? ["No se afirma un cero porque la búsqueda no cubrió todo el historial."]
          : []),
      ],
    });
  }

  if (modo === "productos") {
    const todos = resumenProductosAplicados(aplicados);
    const productos = todos.slice(0, TOPE_PRODUCTOS_RESUMEN);
    return respuestaFlora({
      ...base,
      datos: { productos },
      metadatos: {
        sinDatos: productos.length === 0,
        completo: !historial.parcial && todos.length <= TOPE_PRODUCTOS_RESUMEN,
        hayMas: historial.hayMas || todos.length > TOPE_PRODUCTOS_RESUMEN,
        cantidad: productos.length,
      },
      limitaciones: [...NOTAS_APLICACIONES_NUTRIENTES, ...notaLote(historial.parcial)],
    });
  }

  const recorte = recortarAplicacionesNutrientes(aplicados.map(aplicacionNutrientesDeRegistro).filter(Boolean));
  return respuestaFlora({
    ...base,
    datos: { aplicaciones: recorte.aplicaciones },
    metadatos: {
      sinDatos: recorte.aplicaciones.length === 0,
      completo: !historial.parcial && !recorte.recortado,
      hayMas: historial.hayMas || recorte.recortado,
      cantidad: recorte.aplicaciones.length,
    },
    limitaciones: [
      ...NOTAS_APLICACIONES_NUTRIENTES,
      ...notaLote(historial.parcial || recorte.recortado),
    ],
  });
}

function horaRegistrada(hora) {
  const coincidencia = /^(\d{2}):(\d{2})/.exec(String(hora || ""));
  return coincidencia ? `${coincidencia[1]}:${coincidencia[2]}` : null;
}

function tareaProgramadaCompacta(fila, { hoy, nombresPlanta, nombresUnidad }) {
  const fecha = String(fila.fecha_programada || "").slice(0, 10);
  const estado = fila.estado || "pendiente";
  const plantaIds = (fila.tarea_plantas || []).map((item) => item.planta_id).filter(Boolean);
  return {
    id: fila.id,
    tipo: fila.tipo || "personalizada",
    etiqueta_tipo: etiquetaTipo(fila.tipo || "personalizada"),
    descripcion: String(fila.descripcion || "").trim().slice(0, 500) || null,
    fecha,
    hora: horaRegistrada(fila.hora_programada),
    estado,
    vencida: estado === "pendiente" && Boolean(fecha) && fecha < hoy,
    unidad_cultivo_id: fila.unidad_cultivo_id || null,
    unidad_nombre: nombresUnidad.get(fila.unidad_cultivo_id) || null,
    plantas: plantaIds.map((id) => ({
      planta_id: id,
      nombre: nombresPlanta.get(id) || null,
    })),
    naturaleza: "tarea_programada",
    es_registro_de_cultivo: false,
  };
}

async function mapaNombres(supabase, tabla, ids) {
  const unicos = [...new Set((ids || []).filter(Boolean))].slice(0, 80);
  if (!unicos.length) return { error: false, mapa: new Map() };
  const { data, error } = await supabase.from(tabla).select("id, nombre").in("id", unicos);
  if (error || !Array.isArray(data)) return { error: Boolean(error), mapa: new Map() };
  return {
    error: false,
    mapa: new Map(data.filter((fila) => fila?.id).map((fila) => [fila.id, fila.nombre || ""])),
  };
}

export async function consultarTareasProgramadas(supabase, opciones = {}) {
  const tipoConsulta = "tareas_programadas";
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: sesion.error, datos: null });
  }

  let vista = opciones.vista || (opciones.fecha ? "fecha" : "pendientes");
  if (!VISTAS_TAREA.has(vista)) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: "La vista de tareas no es válida.", datos: null });
  }
  if (opciones.tipo && !esTipoTarea(opciones.tipo)) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: "El tipo de tarea no es válido.", datos: null });
  }
  if (vista === "fecha" && !fechaValida(opciones.fecha)) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta,
      error: "La fecha de la tarea no es válida.",
      datos: null,
    });
  }

  const hoy = fechaHoy();
  let periodo = null;
  if (vista === "completadas") {
    const periodoNorm = normalizarPeriodo(
      opciones.preset || opciones.desde || opciones.hasta ? opciones : { preset: "ultimos_7" }
    );
    if (periodoNorm.error) {
      return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: periodoNorm.error, datos: null });
    }
    periodo = periodoNorm.periodo;
  }

  const alcance = await resolverAlcanceConsulta(supabase, opciones, tipoConsulta);
  if (alcance.corte) return alcance.corte;

  let idsPlanta = null;
  if (alcance.planta) {
    const enlaces = await supabase
      .from("tarea_plantas")
      .select("tarea_id")
      .eq("planta_id", alcance.planta.id)
      .limit(200);
    if (enlaces.error) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta,
        error: tareasNoDisponibles(enlaces.error)
          ? "El calendario de tareas no está disponible."
          : "No se pudieron cargar las tareas.",
        datos: null,
      });
    }
    idsPlanta = [...new Set((enlaces.data || []).map((fila) => fila.tarea_id).filter(Boolean))];
    if (!idsPlanta.length) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta,
        periodo,
        entidades: { unidad_id: alcance.unidad?.id || null, planta_id: alcance.planta.id },
        datos: { hoy, vista, tareas: [] },
        metadatos: { sinDatos: true, completo: true },
        limitaciones: [NOTA_TAREA_NO_ES_REGISTRO],
      });
    }
  }

  let consulta = supabase.from("tareas_programadas").select(SELECT_TAREAS_FLORA).eq("usuario_id", sesion.usuario.id);
  if (alcance.unidad) consulta = consulta.eq("unidad_cultivo_id", alcance.unidad.id);
  if (opciones.tipo) consulta = consulta.eq("tipo", opciones.tipo);
  if (idsPlanta) consulta = consulta.in("id", idsPlanta);
  if (vista === "pendientes" || vista === "vencidas" || vista === "proximas") {
    consulta = consulta.eq("estado", "pendiente");
  }
  if (vista === "completadas") {
    consulta = consulta.eq("estado", "completada");
    if (periodo?.desde) consulta = consulta.gte("fecha_programada", periodo.desde);
    if (periodo?.hasta) consulta = consulta.lte("fecha_programada", periodo.hasta);
  }
  if (vista === "vencidas") consulta = consulta.lt("fecha_programada", hoy);
  if (vista === "proximas") consulta = consulta.gte("fecha_programada", hoy);
  if (vista === "fecha") consulta = consulta.eq("fecha_programada", opciones.fecha);

  const { data, error } = await consulta
    .order("fecha_programada", { ascending: vista !== "completadas" })
    .order("hora_programada", { ascending: true })
    .limit(TOPE_TAREAS_FLORA);

  if (error) {
    return respuestaFlora({
      fuente: FUENTE_CULTIVO,
      tipoConsulta,
      error: tareasNoDisponibles(error)
        ? "El calendario de tareas no está disponible."
        : "No se pudieron cargar las tareas.",
      datos: null,
    });
  }

  const filas = (data || []).filter((fila) => !fila?.usuario_id || fila.usuario_id === sesion.usuario.id);
  const nombresPlanta = await mapaNombres(
    supabase,
    "plantas",
    filas.flatMap((fila) => (fila.tarea_plantas || []).map((item) => item.planta_id))
  );
  const nombresUnidad = await mapaNombres(
    supabase,
    "unidades_cultivo",
    filas.map((fila) => fila.unidad_cultivo_id)
  );
  const tareas = filas.map((fila) =>
    tareaProgramadaCompacta(fila, { hoy, nombresPlanta: nombresPlanta.mapa, nombresUnidad: nombresUnidad.mapa })
  );
  const limitaciones = [NOTA_TAREA_NO_ES_REGISTRO];
  if (nombresPlanta.error || nombresUnidad.error) {
    limitaciones.push("No se pudieron leer algunos nombres vinculados.");
  }
  if (filas.length >= TOPE_TAREAS_FLORA) {
    limitaciones.push("La lista está limitada. Puede haber más tareas.");
  }

  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta,
    periodo,
    entidades: {
      unidad_id: alcance.unidad?.id || null,
      planta_id: alcance.planta?.id || null,
    },
    datos: { hoy, vista, tareas },
    metadatos: {
      sinDatos: tareas.length === 0,
      completo: filas.length < TOPE_TAREAS_FLORA,
      hayMas: filas.length >= TOPE_TAREAS_FLORA,
      cantidad: tareas.length,
    },
    limitaciones,
  });
}

export function resumenClimaParaFlora(clima, { desdeCache = false } = {}) {
  if (!clima || typeof clima !== "object") return null;
  const alertas = Array.isArray(clima.alertasOficiales)
    ? clima.alertasOficiales.map((alerta) => ({
        origen: "alerta_oficial",
        titulo: alerta.titulo || "",
        evento: alerta.evento || null,
        severidad: alerta.severidad || null,
        desde: alerta.desde || null,
        hasta: alerta.hasta || null,
      }))
    : null;
  return {
    localidad: {
      nombre: clima.localidad?.nombre || "",
      region: clima.localidad?.region || "",
      pais: clima.localidad?.pais || "",
    },
    observacion_actual: clima.actual
      ? {
          naturaleza: "observacion",
          temperatura_c: clima.actual.temperaturaC ?? null,
          sensacion_c: clima.actual.sensacionC ?? null,
          humedad: clima.actual.humedad ?? null,
          condicion: clima.actual.condicion || null,
          viento_kph: clima.actual.vientoKph ?? null,
          precipitacion_mm: clima.actual.precipitacionMm ?? null,
          actualizado_en: clima.actual.actualizadoEn || null,
        }
      : null,
    pronostico: (clima.dias || []).map((dia) => ({
      naturaleza: "pronostico",
      fecha: dia.fecha,
      minima_c: dia.minimaC ?? null,
      maxima_c: dia.maximaC ?? null,
      probabilidad_lluvia: dia.probabilidadLluvia ?? null,
      precipitacion_mm: dia.precipitacionMm ?? null,
      viento_kph: dia.vientoKph ?? null,
      condicion: dia.condicion || null,
    })),
    alertas_oficiales: alertas,
    avisos_calculados: (clima.avisosEnflora || []).map((aviso) => ({
      origen: "calculo_enflora",
      tipo: aviso.tipo,
      titulo: aviso.titulo,
      detalle: aviso.detalle,
      es_alerta_oficial: false,
    })),
    desde_cache: Boolean(desdeCache),
    proveedor: clima.proveedor || "weatherapi",
  };
}

export function debeConsultarPronostico({ tipoEspacio, estadoUbicacion, hayLocalidad, coordenadasValidas }) {
  return tipoEspacio === "exterior" && estadoUbicacion === "ok" && Boolean(hayLocalidad) && Boolean(coordenadasValidas);
}

function textoPlano(valor) {
  return String(valor || "").trim().toLowerCase();
}

async function elegirEspacioClima(supabase, usuarioId, opciones) {
  if (opciones.espacioId) {
    if (!esUuid(opciones.espacioId)) return { error: "El identificador del espacio no es válido." };
    const { data, error } = await supabase
      .from("espacios")
      .select("id, nombre, tipo, usuario_id")
      .eq("id", opciones.espacioId)
      .eq("usuario_id", usuarioId)
      .maybeSingle();
    if (error) return { error: "No se pudo leer el espacio." };
    if (!data || data.usuario_id !== usuarioId) return { error: "No se encontró el espacio." };
    return { espacio: data };
  }

  const { data, error } = await supabase
    .from("espacios")
    .select("id, nombre, tipo, usuario_id")
    .eq("usuario_id", usuarioId)
    .order("nombre", { ascending: true })
    .limit(40);
  if (error) return { error: "No se pudieron leer los espacios." };
  const propios = (data || []).filter((fila) => fila?.usuario_id === usuarioId);
  if (!opciones.nombreEspacio) {
    const exteriores = propios.filter((fila) => fila.tipo === "exterior");
    if (exteriores.length === 1) return { espacio: exteriores[0] };
    if (exteriores.length === 0) return { sinEspacioExterior: true };
    return { ambiguedades: exteriores };
  }

  const nombre = textoPlano(opciones.nombreEspacio);
  const exactos = propios.filter((fila) => textoPlano(fila.nombre) === nombre);
  if (exactos.length === 1) return { espacio: exactos[0] };
  if (exactos.length > 1) return { ambiguedades: exactos };
  return { error: "No se encontró el espacio." };
}

function respuestaClimaVacia({ error = "", limitaciones = [], ambiguedades = null, metadatos = {} }) {
  return respuestaFlora({
    fuente: FUENTE_EXTERNA,
    tipoConsulta: "clima_exterior",
    error,
    datos: null,
    ambiguedades,
    metadatos: { sinDatos: true, ...metadatos },
    limitaciones,
  });
}

export async function consultarClimaExterior(supabase, opciones = {}, dependencias = {}) {
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaClimaVacia({ error: sesion.error });
  }

  const elegido = await elegirEspacioClima(supabase, sesion.usuario.id, opciones);
  if (elegido.error) return respuestaClimaVacia({ error: elegido.error });
  if (elegido.sinEspacioExterior) {
    return respuestaClimaVacia({
      limitaciones: ["No hay un espacio exterior. No se consultó al proveedor meteorológico."],
    });
  }
  if (elegido.ambiguedades?.length) {
    return respuestaClimaVacia({
      ambiguedades: opcionesAmbiguas(
        "espacio",
        elegido.ambiguedades.map((espacio) => ({
          id: espacio.id,
          etiqueta: espacio.nombre,
          detalle: espacio.tipo,
        }))
      ),
      limitaciones: ["Hay más de un espacio posible. No se consultó el clima."],
    });
  }

  const espacio = elegido.espacio;
  if (espacio.tipo !== "exterior") {
    return respuestaClimaVacia({
      limitaciones: ["El clima corresponde a espacios exteriores. No se consultó al proveedor meteorológico."],
      metadatos: { motivo: "espacio_interior" },
    });
  }

  const ubicacion = await leerUbicacion(supabase, espacio.id, sesion.usuario.id);
  if (ubicacion.estado === "no_disponible") {
    return respuestaClimaVacia({ error: "El módulo de clima no está disponible en la base." });
  }
  if (ubicacion.estado !== "ok") {
    return respuestaClimaVacia({ error: "No se pudo leer la localidad del espacio." });
  }
  if (!ubicacion.fila || ubicacion.fila.usuario_id !== sesion.usuario.id) {
    return respuestaClimaVacia({
      limitaciones: ["No hay una localidad meteorológica guardada para ese espacio. No se consultó al proveedor."],
      metadatos: { motivo: "sin_localidad" },
    });
  }

  const coordenadas = coordenadaLeida(ubicacion.fila.latitud, ubicacion.fila.longitud);
  if (
    !debeConsultarPronostico({
      tipoEspacio: espacio.tipo,
      estadoUbicacion: ubicacion.estado,
      hayLocalidad: true,
      coordenadasValidas: Boolean(coordenadas),
    })
  ) {
    return respuestaClimaVacia({
      limitaciones: ["La localidad guardada no tiene coordenadas válidas. No se consultó al proveedor."],
    });
  }

  const pedir = dependencias.obtenerPronostico || obtenerPronostico;
  const resultado = await pedir({
    latitud: coordenadas.latitud,
    longitud: coordenadas.longitud,
    usuarioId: sesion.usuario.id,
    zonaConocida: ubicacion.fila.zona_horaria || "",
    almacen: almacenClima(),
  });
  if (!resultado?.ok || !resultado.clima) {
    return respuestaClimaVacia({
      error: resultado?.mensaje || "No hay datos meteorológicos para mostrar.",
      limitaciones: ["No hay datos meteorológicos verificados."],
      metadatos: { codigo: resultado?.codigo || "sin_datos" },
    });
  }

  const resumen = resumenClimaParaFlora(resultado.clima, { desdeCache: resultado.desdeCache });
  const limitaciones = [TEXTO_DESCARGO];
  if (!Array.isArray(resultado.clima.alertasOficiales)) {
    limitaciones.push("No se pudieron verificar alertas oficiales.");
  } else if (resultado.clima.alertasOficiales.length) {
    limitaciones.push(TEXTO_ALERTA_OFICIAL);
  }
  if (resumen.avisos_calculados.length) limitaciones.push(TEXTO_AVISO_ENFLORA);

  return respuestaFlora({
    fuente: FUENTE_EXTERNA,
    tipoConsulta: "clima_exterior",
    entidades: { espacio_id: espacio.id, espacio_nombre: espacio.nombre },
    datos: resumen,
    metadatos: {
      sinDatos: !resumen.observacion_actual && resumen.pronostico.length === 0,
      desdeCache: Boolean(resultado.desdeCache),
      completo: true,
    },
    limitaciones,
  });
}

async function sondaDeAccion(supabase, filtros, opciones, historial) {
  if (opciones.modo !== "despues_de_accion" || !historial.parcial || filtros.genetica) return null;
  const solicitados = Math.min(Math.max(opciones.cantidad || 3, 1), TOPE_EVENTOS_CRUCE);
  const encontrados = (historial.registros || []).filter((registro) =>
    (registro.registro_acciones || []).some(
      (fila) => fila?.origen === "nativa" && fila.clave_nativa === opciones.claveAccion,
    ),
  ).length;
  if (encontrados >= solicitados) return null;

  const limites = limitesFechaHistorial(filtros.desde, filtros.hasta);
  if (!limites) return { error: true };
  const pedido = solicitados + 1;
  let select = "id, fecha_evento, filtro_accion:registro_acciones!inner(origen, clave_nativa)";
  if (filtros.plantaId) select += ", filtro_planta:registro_plantas!inner(planta_id)";
  let consulta = supabase
    .from("registros")
    .select(select)
    .eq("filtro_accion.origen", "nativa")
    .eq("filtro_accion.clave_nativa", opciones.claveAccion);
  if (filtros.unidadId) consulta = consulta.eq("unidad_cultivo_id", filtros.unidadId);
  if (filtros.plantaId) consulta = consulta.eq("filtro_planta.planta_id", filtros.plantaId);
  if (limites.desde) consulta = consulta.gte("fecha_evento", limites.desde);
  if (limites.hasta) consulta = consulta.lte("fecha_evento", limites.hasta);
  const { data, error } = await consulta.order("fecha_evento", { ascending: false }).limit(pedido);
  if (error) return { error: true };
  const fechas = (data || []).map((fila) => fila.fecha_evento).filter(Boolean);
  return { fechas, completa: fechas.length < pedido };
}

export async function relacionarEvolucionCultivo(supabase, opciones = {}) {
  const tipoConsulta = "evolucion_cultivo";
  const sesion = await requiereSesionFlora(supabase);
  if (!sesion.ok) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: sesion.error, datos: null });
  }

  const alcance = await resolverAlcanceConsulta(supabase, opciones, tipoConsulta);
  if (alcance.corte) return alcance.corte;

  const pideEtapa = opciones.modo === "durante_etapa" || opciones.modo === "entre_etapas";
  let etapas = [];
  if (pideEtapa) {
    if (!alcance.planta) {
      return respuestaFlora({
        fuente: FUENTE_CULTIVO,
        tipoConsulta,
        error: "Indicá una planta para usar sus etapas.",
        datos: null,
      });
    }
    const cargadas = await cargarEtapasPlantas(supabase, [alcance.planta]);
    etapas = normalizarEtapasPlanta(
      cargadas.etapasPorPlanta.get(alcance.planta.id) || [],
      alcance.planta.fecha_inicio,
      fechaHoy(),
    ).map((etapa) => ({
      etapa: etapa.etapa,
      etapa_nombre: etiquetaEtapa(etapa.etapa),
      fechaInicio: etapa.fechaInicio,
      fechaFin: etapa.fechaFin,
    }));
  }

  let desde = opciones.desde || "";
  let hasta = opciones.hasta || "";
  if (pideEtapa && !desde && !hasta) {
    const elegidas = etapas.filter(
      (etapa) => etapa.etapa === opciones.etapa || etapa.etapa === opciones.etapaB,
    );
    if (elegidas.length) {
      desde = [...elegidas].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))[0].fechaInicio;
      hasta = elegidas
        .map((etapa) => etapa.fechaFin || fechaHoy())
        .sort()
        .at(-1);
    }
  }

  const filtrosBase = filtrosHistorialBase({
    unidadId: alcance.unidad?.id || opciones.unidadId,
    plantaId: alcance.planta?.id || opciones.plantaId,
    genetica: opciones.genetica,
    desde,
    hasta,
  });
  if (filtrosBase.error) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: filtrosBase.error, datos: null });
  }

  const afirmacion = await afirmarFiltrosHistorial(supabase, filtrosBase.filtros);
  if (afirmacion.error) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: afirmacion.error, datos: null });
  }

  const historial = await paginarHistorial(supabase, filtrosBase.filtros, {
    maxRegistros: TOPE_REGISTROS_CRUCE,
  });
  if (historial.error) {
    return respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta, error: historial.error, datos: null });
  }

  const ventana = historial.parcial ? "parcial" : "completa";
  const sonda = await sondaDeAccion(supabase, filtrosBase.filtros, opciones, historial);
  const datos = relacionarEvolucion(historial.registros, { ...opciones, etapas, ventana, sonda });
  const parcial = Boolean(historial.parcial || datos.parcial);
  return respuestaFlora({
    fuente: FUENTE_CULTIVO,
    tipoConsulta,
    periodo: desde || hasta ? { desde, hasta } : undefined,
    entidades: {
      unidad_id: alcance.unidad?.id || null,
      planta_id: alcance.planta?.id || null,
    },
    datos,
    metadatos: {
      completo: !parcial,
      hayMas: Boolean(historial.hayMas || datos.parcial),
      sinDatos: Boolean(datos.sin_datos),
    },
    limitaciones: [
      "La relación es temporal. No demuestra que un producto haya causado el cambio.",
      "El volumen informado es agua preparada, no el volumen aplicado a cada planta.",
      ...(parcial ? ["El análisis está parcial: no se recorrió todo el historial pedido."] : []),
      ...(datos.cobertura?.se_puede_afirmar_ausencia === false
        ? ["No se puede afirmar que no existan eventos anteriores a esta ventana."]
        : []),
    ],
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
  consultarAplicacionesNutrientes,
  relacionarEvolucionCultivo,
  consultarTareasProgramadas,
  consultarClimaExterior,
};
