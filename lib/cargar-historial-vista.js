import {
  cargarHistorialRegistros,
} from "@/lib/cargar-registros";
import { firmarPortadas } from "@/lib/cargar-fotos";
import { adjuntarMiniaturas } from "@/lib/fotos-servidor";
import { consultarUnidad } from "@/lib/consultar-unidad";
import {
  construirHistorialVista,
  filtrarPlantasPorGenetica,
  normalizarEtapasPlanta,
} from "@/lib/historial-vista-cultivo";
import {
  DIAS_POR_PAGINA_HISTORIAL,
  fusionarLotePorDias,
} from "@/lib/historial-paginacion-dias";
import { diaArgentina, limitesFechaHistorial } from "@/lib/historial-registros";
import { fechaHoy } from "@/lib/etapas";

async function escanearResumenAlcance(supabase, filtros, plantasAlcance) {
  const limites = limitesFechaHistorial(filtros.desde, filtros.hasta);
  if (!limites) {
    return {
      diasRegistrados: 0,
      fotos: 0,
      fotosDeRegistros: 0,
      mediciones: 0,
      acciones: 0,
      etapas: 0,
      plantas: plantasAlcance.length,
      rango: { desde: "", hasta: "" },
    };
  }

  const dias = new Set();
  const fotos = new Set();
  let mediciones = 0;
  let acciones = 0;
  let desde = "";
  let hasta = "";
  let cursor = filtros.cursor;
  let continuar = true;

  while (continuar) {
    const pagina = await cargarHistorialRegistros(supabase, { ...filtros, cursor });
    if (pagina.error) break;
    const filas = pagina.registros || [];
    if (!filas.length) break;

    for (const registro of filas) {
      const dia = diaArgentina(registro.fecha_evento);
      if (dia) {
        dias.add(dia);
        if (!hasta || dia > hasta) hasta = dia;
        if (!desde || dia < desde) desde = dia;
      }
      mediciones += (registro.registro_parametros || []).length;
      acciones += (registro.registro_acciones || []).length;
      for (const foto of registro.registro_fotos || []) {
        if (foto?.id) fotos.add(foto.id);
      }
    }

    if (!pagina.hayMas) {
      continuar = false;
      break;
    }
    const ultimo = filas[filas.length - 1];
    cursor = { fecha: ultimo.fecha_evento, id: ultimo.id };
  }

  let etapas = 0;
  if (filtros.plantaId) {
    const { count } = await supabase
      .from("historial_etapas")
      .select("id", { count: "exact", head: true })
      .eq("planta_id", filtros.plantaId);
    etapas = count || 0;
  } else if (plantasAlcance.length) {
    const ids = plantasAlcance.map((planta) => planta.id);
    const { count } = await supabase
      .from("historial_etapas")
      .select("id", { count: "exact", head: true })
      .in("planta_id", ids);
    etapas = count || 0;
  }

  return {
    diasRegistrados: dias.size,
    fotos: fotos.size,
    fotosDeRegistros: fotos.size,
    mediciones,
    acciones,
    etapas,
    plantas: plantasAlcance.length,
    rango: { desde, hasta },
  };
}

export async function cargarRegistrosHistorialPorDias(supabase, filtros, { diasObjetivo = DIAS_POR_PAGINA_HISTORIAL } = {}) {
  const acumulado = [];
  let cursor = filtros.cursor || null;
  let hayMasServidor = true;
  let iteraciones = 0;

  while (hayMasServidor && iteraciones < 12) {
    iteraciones += 1;
    const pagina = await cargarHistorialRegistros(supabase, { ...filtros, cursor });
    if (pagina.error) return { error: true, registros: [], hayMas: false, cursor: null };
    const nuevos = pagina.registros || [];
    acumulado.push(...nuevos);

    const fusion = fusionarLotePorDias(acumulado, diasObjetivo);
    if (fusion.diasCargados >= diasObjetivo || !pagina.hayMas) {
      return {
        error: false,
        registros: fusion.registros,
        hayMas: pagina.hayMas || fusion.hayMas,
        cursor: fusion.cursor,
      };
    }

    const ultimo = nuevos[nuevos.length - 1];
    if (!ultimo) {
      hayMasServidor = false;
      break;
    }
    cursor = { fecha: ultimo.fecha_evento, id: ultimo.id };
    hayMasServidor = pagina.hayMas;
  }

  const fusion = fusionarLotePorDias(acumulado, diasObjetivo);
  return {
    error: false,
    registros: fusion.registros,
    hayMas: fusion.hayMas,
    cursor: fusion.cursor,
  };
}

export async function cargarHistorialVistaUnidad(supabase, filtros) {
  if (!filtros?.unidadId) {
    return { error: "Seleccioná una unidad de cultivo.", historial: null };
  }

  const lectura = await consultarUnidad(supabase, { unidadId: filtros.unidadId });
  if (lectura.error || !lectura.unidad) {
    return { error: "No se encontró la unidad.", historial: null };
  }

  const unidad = lectura.unidad;
  const [espacioRespuesta, plantasRespuesta] = await Promise.all([
    supabase.from("espacios").select("id, nombre").eq("id", unidad.espacio_id).maybeSingle(),
    supabase
      .from("plantas")
      .select("id, nombre, genetica, metodo, sustrato, etapa, fecha_inicio, estado, numero, unidad_cultivo_id")
      .eq("unidad_cultivo_id", unidad.id)
      .order("numero", { ascending: true }),
  ]);

  if (plantasRespuesta.error) {
    return { error: "No se pudieron cargar las plantas.", historial: null };
  }

  let plantas = plantasRespuesta.data || [];
  if (filtros.genetica) plantas = filtrarPlantasPorGenetica(plantas, filtros.genetica);
  const plantasAlcance = filtros.plantaId ? plantas.filter((planta) => planta.id === filtros.plantaId) : plantas;

  if (filtros.plantaId && !plantasAlcance.length) {
    return { error: "La planta no pertenece a esa unidad.", historial: null };
  }

  const idsEtapas = plantasAlcance.map((planta) => planta.id);
  let etapasPorPlanta = null;
  let etapasVista = [];

  if (idsEtapas.length) {
    const { data: historialEtapas, error: errorEtapas } = await supabase
      .from("historial_etapas")
      .select("id, planta_id, etapa, fecha_inicio, fecha_fin")
      .in("planta_id", idsEtapas)
      .order("fecha_inicio", { ascending: true });

    if (errorEtapas) {
      return { error: "No se pudo cargar el historial de etapas.", historial: null };
    }

    const porPlanta = new Map();
    for (const fila of historialEtapas || []) {
      const lista = porPlanta.get(fila.planta_id) || [];
      lista.push(fila);
      porPlanta.set(fila.planta_id, lista);
    }

    if (filtros.plantaId) {
      const fechaInicio = plantasAlcance[0]?.fecha_inicio;
      etapasVista = normalizarEtapasPlanta(porPlanta.get(filtros.plantaId) || [], fechaInicio, fechaHoy());
    } else if (plantasAlcance.length === 1) {
      const fechaInicio = plantasAlcance[0]?.fecha_inicio;
      etapasVista = normalizarEtapasPlanta(porPlanta.get(plantasAlcance[0].id) || [], fechaInicio, fechaHoy());
    } else {
      etapasPorPlanta = plantasAlcance.map((planta) => ({
        plantaId: planta.id,
        nombre: planta.nombre,
        etapas: normalizarEtapasPlanta(porPlanta.get(planta.id) || [], planta.fecha_inicio, fechaHoy()),
      }));
    }
  }

  const [paginaRegistros, resumen, portadas] = await Promise.all([
    cargarRegistrosHistorialPorDias(supabase, filtros),
    escanearResumenAlcance(supabase, filtros, plantasAlcance),
    firmarPortadas(supabase, [unidad], { conOriginal: true }),
  ]);

  if (paginaRegistros.error) {
    return { error: "No se pudieron cargar los registros.", historial: null };
  }

  const portadaFirmada = portadas.get(unidad.id);
  const portada =
    unidad.portada_ruta && portadaFirmada?.portada
      ? {
          id: `portada-${unidad.id}`,
          tipo: "portada",
          url: portadaFirmada.portada,
          miniatura: portadaFirmada.miniatura || portadaFirmada.portada,
          ancho: 1600,
          alto: 900,
          anchoMiniatura: 480,
          altoMiniatura: 270,
        }
      : null;

  const registrosIniciales = await adjuntarMiniaturas(supabase, paginaRegistros.registros);

  const historial = construirHistorialVista({
    unidad,
    espacioNombre: espacioRespuesta.data?.nombre || "",
    plantas,
    plantaId: filtros.plantaId,
    etapas: etapasVista,
    etapasPorPlanta,
    registros: registrosIniciales,
    resumen,
    portada,
    fechaCorte: fechaHoy(),
    diaReferenciaUnidad: !filtros.plantaId && plantasAlcance.length > 1,
  });

  return {
    error: "",
    historial,
    registrosIniciales,
    hayMasDias: paginaRegistros.hayMas,
    cursorDias: paginaRegistros.cursor,
    unidad,
    plantas,
    espacioNombre: espacioRespuesta.data?.nombre || "",
    resumen,
    portada,
    etapas: etapasVista,
    etapasPorPlanta,
  };
}
