import { formatearFecha } from "@/lib/etapas";
import {
  compararFotosGaleria,
  cursorDesdeUltimaFoto,
  esUuidGaleria,
  indiceDespuesCursorGaleria,
  parsearCursorGaleria,
} from "@/lib/flora-galeria-fotos";
import { diaArgentina, esUuid } from "@/lib/historial-registros";

export const TAMANO_PAGINA_GALERIA = 30;
export const TAMANO_MAXIMO_PAGINA_GALERIA = 60;
export const VALOR_FILTRO_TODOS = "todos";

// Solo fotos de registros. Las portadas viven en unidades_cultivo, no en esta consulta.
export const SELECT_GALERIA_FLORA = `
  id,
  ruta_miniatura,
  ancho,
  alto,
  registro_id,
  registro:registros!inner (
    id,
    fecha_evento,
    espacio_id,
    unidad_cultivo_id,
    espacio:espacios ( id, nombre ),
    unidad:unidades_cultivo ( id, nombre )
  )
`;

export function limitePaginaGaleria(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) return TAMANO_PAGINA_GALERIA;
  return Math.min(n, TAMANO_MAXIMO_PAGINA_GALERIA);
}

export function normalizarFiltrosGaleria({ espacioId = "", unidadId = "" } = {}) {
  const espacioTexto = String(espacioId || "").trim();
  const unidadTexto = String(unidadId || "").trim();
  if (espacioTexto && !esUuid(espacioTexto)) {
    return { ok: false, error: "El espacio no es válido." };
  }
  if (unidadTexto && !esUuid(unidadTexto)) {
    return { ok: false, error: "La unidad no es válida." };
  }
  return { ok: true, espacioId: espacioTexto, unidadId: unidadTexto };
}

export function hayFiltrosGaleria({ espacioId = "", unidadId = "" } = {}) {
  return Boolean(espacioId || unidadId);
}

export function filtrosTrasCambioEspacio({ espacioId = "", unidadId = "", unidades = [] } = {}) {
  const espacio = esUuid(espacioId) ? String(espacioId).trim() : "";
  const unidad = esUuid(unidadId) ? String(unidadId).trim() : "";
  if (!unidad || !espacio) return { espacioId: espacio, unidadId: unidad };
  const encontrada = (unidades || []).find((item) => item.id === unidad);
  if (!encontrada || encontrada.espacio_id !== espacio) {
    return { espacioId: espacio, unidadId: "" };
  }
  return { espacioId: espacio, unidadId: unidad };
}

export function etiquetaUnidadGaleria(unidad, { conEspacio = false } = {}) {
  const nombre = String(unidad?.nombre || "Unidad");
  if (!conEspacio) return nombre;
  const espacio = String(unidad?.espacio_nombre || "").trim();
  return espacio ? `${nombre} · ${espacio}` : nombre;
}

export function opcionesEspaciosGaleria(espacios) {
  return [...(espacios || [])]
    .filter((espacio) => espacio?.id)
    .map((espacio) => ({
      valor: espacio.id,
      etiqueta: String(espacio.nombre || "Espacio"),
    }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
}

export function opcionesUnidadesGaleria(unidades, espacioId = "") {
  const lista = (unidades || []).filter((unidad) => unidad?.id && (!espacioId || unidad.espacio_id === espacioId));
  lista.sort((a, b) => {
    if (!espacioId) {
      const porEspacio = String(a.espacio_nombre || "").localeCompare(String(b.espacio_nombre || ""), "es");
      if (porEspacio !== 0) return porEspacio;
    }
    const porNumero = (Number(a.numero) || 0) - (Number(b.numero) || 0);
    if (porNumero !== 0) return porNumero;
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
  });
  return lista.map((unidad) => ({
    valor: unidad.id,
    etiqueta: etiquetaUnidadGaleria(unidad, { conEspacio: !espacioId }),
  }));
}

export function textoFechaGaleria(fechaIso) {
  const dia = diaArgentina(fechaIso);
  return dia ? formatearFecha(dia) : "";
}

export function textoLugarGaleria(foto) {
  const unidad = String(foto?.unidad_nombre || "").trim();
  const espacio = String(foto?.espacio_nombre || "").trim();
  if (unidad && espacio) return `${unidad} en ${espacio}`;
  return unidad || espacio;
}

export function etiquetaFotoGaleria(foto) {
  const fecha = textoFechaGaleria(foto?.fecha_evento);
  const lugar = [foto?.espacio_nombre, foto?.unidad_nombre].filter(Boolean).join(", ");
  const detalle = [fecha ? `del ${fecha}` : "", lugar].filter(Boolean).join(", ");
  return detalle ? `Ver foto ${detalle}` : "Ver foto";
}

export function hrefRegistroGaleria(registroId) {
  return esUuid(registroId) ? `/registros?editar=${String(registroId).trim()}` : "";
}

export function mensajeGaleriaFlora({ error = "", sinFotos = false, sinCoincidencias = false } = {}) {
  if (error) return error;
  if (sinCoincidencias) return "Ninguna foto coincide con estos filtros.";
  if (sinFotos) return "Todavía no hay fotos en tus registros.";
  return "";
}

function enteroPositivo(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function objetoAnidado(valor) {
  if (Array.isArray(valor)) return valor[0] || null;
  return valor || null;
}

export function mapearFilaGaleria(fila) {
  const registro = objetoAnidado(fila?.registro) || {};
  const espacio = objetoAnidado(registro.espacio);
  const unidad = objetoAnidado(registro.unidad);
  return {
    id: String(fila?.id || ""),
    registro_id: String(fila?.registro_id || registro.id || ""),
    fecha_evento: registro.fecha_evento ? String(registro.fecha_evento) : "",
    espacio_id: String(registro.espacio_id || espacio?.id || ""),
    espacio_nombre: String(espacio?.nombre || ""),
    unidad_id: String(registro.unidad_cultivo_id || unidad?.id || ""),
    unidad_nombre: String(unidad?.nombre || ""),
    ancho: enteroPositivo(fila?.ancho),
    alto: enteroPositivo(fila?.alto),
    ruta_miniatura: String(fila?.ruta_miniatura || ""),
  };
}

export function paginaDesdeLote(filas, limite) {
  const ordenadas = [...(filas || [])].sort(compararFotosGaleria);
  const fotos = [];
  const vistos = new Set();
  for (const fila of ordenadas) {
    if (!fila?.id || vistos.has(fila.id)) continue;
    vistos.add(fila.id);
    fotos.push(fila);
  }
  const hayMas = fotos.length > limite;
  const visibles = hayMas ? fotos.slice(0, limite) : fotos;
  const cursor = hayMas ? cursorDesdeUltimaFoto(visibles) : null;
  return { fotos: visibles, hayMas: Boolean(hayMas && cursor), cursor };
}

export function cortarPaginaGaleria(filasOrdenadas, cursor, limite) {
  const inicio = indiceDespuesCursorGaleria(filasOrdenadas, cursor);
  return paginaDesdeLote((filasOrdenadas || []).slice(inicio), limite);
}

export function anexarFotosGaleria(previas, nuevas) {
  const fotos = [];
  const vistos = new Set();
  for (const foto of [...(previas || []), ...(nuevas || [])]) {
    if (!foto?.id || vistos.has(foto.id)) continue;
    vistos.add(foto.id);
    fotos.push(foto);
  }
  return fotos;
}

export function publicarFotosGaleria(fotos, urls) {
  const mapa = urls instanceof Map ? urls : new Map();
  return (fotos || []).map((foto) => ({
    id: foto.id,
    registro_id: foto.registro_id || "",
    fecha_evento: foto.fecha_evento || "",
    espacio_id: foto.espacio_id || "",
    espacio_nombre: foto.espacio_nombre || "",
    unidad_id: foto.unidad_id || "",
    unidad_nombre: foto.unidad_nombre || "",
    ancho: foto.ancho ?? null,
    alto: foto.alto ?? null,
    url_miniatura: mapa.get(foto.ruta_miniatura) || "",
  }));
}

function resultadoError(error) {
  return {
    ok: false,
    error,
    fotos: [],
    hay_mas: false,
    cursor: null,
    total: null,
    unidad_invalida: false,
    sin_coincidencias: false,
  };
}

function resultadoVacio({ unidadInvalida = false, sinCoincidencias = true } = {}) {
  return {
    ok: true,
    fotos: [],
    hay_mas: false,
    cursor: null,
    total: 0,
    unidad_invalida: unidadInvalida,
    sin_coincidencias: sinCoincidencias,
  };
}

function conFiltrosRegistro(consulta, filtros) {
  if (filtros.espacioId) consulta = consulta.eq("registro.espacio_id", filtros.espacioId);
  if (filtros.unidadId) consulta = consulta.eq("registro.unidad_cultivo_id", filtros.unidadId);
  return consulta;
}

export async function leerContextosGaleria(supabase) {
  const [espaciosRes, unidadesRes] = await Promise.all([
    supabase.from("espacios").select("id, nombre").order("nombre", { ascending: true }),
    supabase
      .from("unidades_cultivo")
      .select("id, nombre, espacio_id, numero, espacio:espacios(nombre)")
      .order("numero", { ascending: true }),
  ]);

  if (espaciosRes.error || unidadesRes.error) {
    return { ok: false, error: "No se pudieron cargar los espacios.", espacios: [], unidades: [] };
  }

  const espacios = (espaciosRes.data || [])
    .filter((fila) => fila?.id)
    .map((fila) => ({ id: fila.id, nombre: String(fila.nombre || "Espacio") }));

  const unidades = (unidadesRes.data || [])
    .filter((fila) => fila?.id)
    .map((fila) => {
      const espacio = objetoAnidado(fila.espacio);
      return {
        id: fila.id,
        nombre: String(fila.nombre || "Unidad"),
        espacio_id: String(fila.espacio_id || ""),
        espacio_nombre: String(espacio?.nombre || ""),
        numero: Number(fila.numero) || 0,
      };
    });

  return { ok: true, espacios, unidades };
}

export async function leerRutaMiniaturaGaleria(supabase, usuarioId, fotoId) {
  if (!esUuid(usuarioId) || !esUuidGaleria(fotoId)) {
    return { ok: false, error: "No se encontró la foto.", ruta: "" };
  }

  const { data, error } = await supabase
    .from("registro_fotos")
    .select("ruta_miniatura")
    .eq("id", fotoId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (error || !data?.ruta_miniatura) {
    return { ok: false, error: "No se encontró la foto.", ruta: "" };
  }

  return { ok: true, ruta: String(data.ruta_miniatura) };
}

const TAMANO_LOTE_FOTOS = 1000;

async function leerFilasFotos(supabase, usuarioId, filtros) {
  const filas = [];
  for (let lote = 0; lote < 5; lote += 1) {
    const desde = lote * TAMANO_LOTE_FOTOS;
    let consulta = supabase.from("registro_fotos").select(SELECT_GALERIA_FLORA).eq("usuario_id", usuarioId);
    consulta = conFiltrosRegistro(consulta, filtros);
    const { data, error } = await consulta.range(desde, desde + TAMANO_LOTE_FOTOS - 1);
    if (error) return { error };
    const pagina = data || [];
    filas.push(...pagina);
    if (pagina.length < TAMANO_LOTE_FOTOS) return { data: filas };
  }
  return { data: filas };
}

export async function leerPaginaGaleria(supabase, usuarioId, entrada = {}) {
  if (!esUuid(usuarioId)) return resultadoError("No hay sesión.");

  const filtros = normalizarFiltrosGaleria(entrada);
  if (!filtros.ok) return resultadoError(filtros.error);

  const cursor = entrada.cursorFecha || entrada.cursorId
    ? parsearCursorGaleria(entrada.cursorFecha, entrada.cursorId)
    : null;

  if (cursor?.invalido) return resultadoError("El cursor de paginación no es válido.");

  const limite = limitePaginaGaleria(entrada.limite);

  if (filtros.espacioId) {
    const espacio = await supabase
      .from("espacios")
      .select("id")
      .eq("id", filtros.espacioId)
      .eq("usuario_id", usuarioId)
      .maybeSingle();
    if (espacio.error) return resultadoError("No se pudieron cargar las fotos.");
    if (!espacio.data) return resultadoVacio();
  }

  if (filtros.unidadId) {
    const unidad = await supabase
      .from("unidades_cultivo")
      .select("id, espacio_id")
      .eq("id", filtros.unidadId)
      .maybeSingle();
    if (unidad.error) return resultadoError("No se pudieron cargar las fotos.");
    if (!unidad.data) return resultadoVacio();
    if (filtros.espacioId && unidad.data.espacio_id !== filtros.espacioId) {
      return resultadoVacio({ unidadInvalida: true });
    }
  }

  let conteo = supabase
    .from("registro_fotos")
    .select("id, registro:registros!inner(id)", { count: "exact", head: true })
    .eq("usuario_id", usuarioId);
  conteo = conFiltrosRegistro(conteo, filtros);

  const [listaRes, conteoRes] = await Promise.all([
    leerFilasFotos(supabase, usuarioId, filtros),
    conteo,
  ]);
  if (listaRes.error) return resultadoError("No se pudieron cargar las fotos.");

  const mapeadas = (listaRes.data || []).map(mapearFilaGaleria).filter((foto) => foto.id);
  const ordenadas = [...mapeadas].sort(compararFotosGaleria);
  const pagina = cortarPaginaGaleria(ordenadas, cursor, limite);
  const total = conteoRes.error ? null : Number(conteoRes.count) || 0;

  return {
    ok: true,
    fotos: pagina.fotos,
    hay_mas: pagina.hayMas,
    cursor: pagina.cursor,
    total,
    unidad_invalida: false,
    sin_coincidencias: pagina.fotos.length === 0 && hayFiltrosGaleria(filtros),
  };
}
