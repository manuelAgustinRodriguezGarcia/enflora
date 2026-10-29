import "server-only";

import { acotarLimiteTandaGaleria, resolverBeneficiosFlora } from "@/lib/flora-beneficios-servidor";
import {
  compararFotosGaleria,
  cursorDesdeUltimaFoto,
  esUuidGaleria,
  filasPlantasRegistro,
  hayFiltrosActivosGaleria,
  LIMITE_MAXIMO_BUSQUEDA_REGISTROS,
  nombrePlantaDesdeRegistro,
  normalizarTextoBusqueda,
  parsearCursorGaleria,
  rangoFechasGaleriaValido,
} from "@/lib/flora-galeria-fotos";
import { firmarRutas } from "@/lib/fotos-servidor";

const SELECT_GALERIA = `
  id,
  ruta_miniatura,
  registro_id,
  registro:registros!inner (
    id,
    fecha_evento,
    unidad_cultivo_id,
    aplica_a,
    unidad:unidades_cultivo ( id, nombre ),
    registro_plantas ( nombre_planta, planta_id )
  )
`;

function inicioDiaUtc(fechaYmd) {
  return `${fechaYmd}T00:00:00.000Z`;
}

function finDiaUtc(fechaYmd) {
  return `${fechaYmd}T23:59:59.999Z`;
}

function registroCoincideBusqueda(registro, terminoLower) {
  if (!terminoLower) return true;
  const unidad = String(registro?.unidad?.nombre || "").toLowerCase();
  if (unidad.includes(terminoLower)) return true;
  for (const fila of filasPlantasRegistro(registro)) {
    const nombre = String(fila?.nombre_planta || "").toLowerCase();
    if (nombre.includes(terminoLower)) return true;
  }
  return false;
}

function mapaFotoDesdeFila(fila) {
  const registro = fila?.registro;
  const fechaEvento = registro?.fecha_evento ? String(registro.fecha_evento) : "";
  return {
    id: fila.id,
    registro_id: fila.registro_id || registro?.id || "",
    url_miniatura: "",
    ruta_miniatura: fila.ruta_miniatura || "",
    fecha_evento: fechaEvento,
    aplica_a: registro?.aplica_a || "",
    unidad_cultivo_id: registro?.unidad_cultivo_id || "",
    unidad_nombre: registro?.unidad?.nombre || "",
    planta_etiqueta: nombrePlantaDesdeRegistro(registro),
  };
}

async function registroIdsParaBusqueda(supabase, termino) {
  const ids = new Set();
  const patron = `%${termino}%`;

  const [unidadesResp, plantasResp] = await Promise.all([
    supabase.from("unidades_cultivo").select("id").ilike("nombre", patron).limit(200),
    supabase.from("registro_plantas").select("registro_id").ilike("nombre_planta", patron).limit(LIMITE_MAXIMO_BUSQUEDA_REGISTROS),
  ]);

  if (unidadesResp.error || plantasResp.error) {
    return { ok: false, ids: null };
  }

  for (const fila of plantasResp.data || []) {
    if (fila?.registro_id) ids.add(fila.registro_id);
  }

  const unidadIds = (unidadesResp.data || []).map((u) => u.id).filter(Boolean);
  if (unidadIds.length > 0) {
    const { data, error } = await supabase
      .from("registros")
      .select("id")
      .in("unidad_cultivo_id", unidadIds)
      .limit(LIMITE_MAXIMO_BUSQUEDA_REGISTROS);
    if (error) return { ok: false, ids: null };
    for (const reg of data || []) ids.add(reg.id);
  }

  return { ok: true, ids: [...ids] };
}

function aplicarCursorKeyset(query, cursor) {
  if (!cursor?.fecha_evento || !cursor?.id) return query;
  const f = cursor.fecha_evento;
  const id = cursor.id;
  return query.or(`registro.fecha_evento.lt.${f},and(registro.fecha_evento.eq.${f},id.lt.${id})`);
}

async function consultarLoteFotos(supabase, { limite, filtros, cursor, registroIdsBusqueda }) {
  let query = supabase
    .from("registro_fotos")
    .select(SELECT_GALERIA)
    .order("fecha_evento", { foreignTable: "registros", ascending: false })
    .order("id", { ascending: false })
    .limit(limite + 1);

  if (filtros.unidadId) {
    query = query.eq("registro.unidad_cultivo_id", filtros.unidadId);
  }

  if (filtros.fechaDesde) {
    query = query.gte("registro.fecha_evento", inicioDiaUtc(filtros.fechaDesde));
  }
  if (filtros.fechaHasta) {
    query = query.lte("registro.fecha_evento", finDiaUtc(filtros.fechaHasta));
  }

  if (registroIdsBusqueda) {
    if (registroIdsBusqueda.length === 0) {
      return { ok: true, filas: [], truncado: false };
    }
    query = query.in("registro_id", registroIdsBusqueda.slice(0, LIMITE_MAXIMO_BUSQUEDA_REGISTROS));
  }

  query = aplicarCursorKeyset(query, cursor);

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: "No se pudieron cargar las fotos.", detalle: error.message };
  }

  let filas = data || [];
  const terminoLower = filtros.busquedaLower;
  if (terminoLower && !registroIdsBusqueda) {
    filas = filas.filter((fila) => registroCoincideBusqueda(fila.registro, terminoLower));
  }

  filas.sort(compararFotosGaleria);
  return { ok: true, filas, truncado: false };
}

export async function listarUnidadesGaleriaFlora(supabase) {
  const { data, error } = await supabase
    .from("unidades_cultivo")
    .select("id, nombre, espacio:espacios ( nombre )")
    .order("nombre", { ascending: true });

  if (error) {
    return { ok: false, error: "No se pudieron cargar tus unidades.", unidades: [] };
  }

  const unidades = (data || []).map((u) => ({
    id: u.id,
    nombre: u.nombre,
    espacio_nombre: u.espacio?.nombre || "",
  }));

  return { ok: true, unidades };
}

export async function listarFotosGaleriaFlora(
  supabase,
  usuarioId,
  {
    limite = 12,
    cursorFecha = "",
    cursorId = "",
    unidadId = "",
    busqueda = "",
    fechaDesde = "",
    fechaHasta = "",
  } = {},
) {
  const rango = rangoFechasGaleriaValido(fechaDesde, fechaHasta);
  if (!rango.ok) {
    return { ok: false, error: rango.error, fotos: [], hay_mas: false, cursor: null };
  }

  const unidadFiltro = esUuidGaleria(unidadId) ? unidadId.trim() : "";
  const beneficios = await resolverBeneficiosFlora(supabase, usuarioId, { unidadCultivoId: unidadFiltro });
  const limiteTanda = acotarLimiteTandaGaleria(limite, beneficios.tandaGaleria);

  const cursorParseado = parsearCursorGaleria(cursorFecha, cursorId);
  if (cursorParseado?.invalido) {
    return { ok: false, error: "El cursor de paginación no es válido.", fotos: [], hay_mas: false, cursor: null };
  }

  const termino = normalizarTextoBusqueda(busqueda);
  const filtros = {
    unidadId: unidadFiltro,
    fechaDesde: rango.desde,
    fechaHasta: rango.hasta,
    busqueda: termino,
    busquedaLower: termino.toLowerCase(),
  };

  let registroIdsBusqueda = null;
  if (termino) {
    const busquedaRegistros = await registroIdsParaBusqueda(supabase, termino);
    if (!busquedaRegistros.ok) {
      return { ok: false, error: "No se pudo aplicar la búsqueda.", fotos: [], hay_mas: false, cursor: null };
    }
    registroIdsBusqueda = busquedaRegistros.ids;
    if (registroIdsBusqueda.length === 0) {
      return {
        ok: true,
        fotos: [],
        hay_mas: false,
        cursor: null,
        beneficios,
        sin_coincidencias: true,
        sin_fotos_cuenta: false,
        hay_filtros: hayFiltrosActivosGaleria(filtros),
      };
    }
  }

  const lote = await consultarLoteFotos(supabase, {
    limite: limiteTanda,
    filtros,
    cursor: cursorParseado,
    registroIdsBusqueda,
  });

  if (!lote.ok) {
    return { ok: false, error: lote.error, fotos: [], hay_mas: false, cursor: null, beneficios };
  }

  let filas = lote.filas;
  if (termino && registroIdsBusqueda) {
    filas = filas.filter((fila) => registroCoincideBusqueda(fila.registro, filtros.busquedaLower));
    filas.sort(compararFotosGaleria);
  }

  const hayMas = filas.length > limiteTanda;
  const visibles = hayMas ? filas.slice(0, limiteTanda) : filas;
  const fotosBase = visibles.map(mapaFotoDesdeFila);
  const urls = await firmarRutas(supabase, fotosBase.map((f) => f.ruta_miniatura), 600);
  const fotos = fotosBase.map(({ ruta_miniatura: _ruta, ...f }) => ({
    ...f,
    url_miniatura: urls.get(_ruta) || "",
  }));

  const sinFotosCuenta = fotos.length === 0 && !hayFiltrosActivosGaleria(filtros) && !cursorParseado;

  return {
    ok: true,
    fotos,
    hay_mas: hayMas,
    cursor: hayMas ? cursorDesdeUltimaFoto(fotos) : null,
    beneficios,
    sin_coincidencias: fotos.length === 0 && hayFiltrosActivosGaleria(filtros),
    sin_fotos_cuenta: sinFotosCuenta,
    hay_filtros: hayFiltrosActivosGaleria(filtros),
    limite: limiteTanda,
  };
}

export async function cuentaTieneFotosGaleria(supabase) {
  const { count, error } = await supabase
    .from("registro_fotos")
    .select("id", { count: "exact", head: true });
  if (error) return { ok: false, tiene: false };
  return { ok: true, tiene: (count || 0) > 0 };
}
