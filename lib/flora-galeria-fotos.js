import { citaFiltro } from "@/lib/historial-registros";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const LIMITE_MAXIMO_TANDA_GALERIA = 36;
export const LIMITE_MAXIMO_BUSQUEDA_REGISTROS = 2500;

export function esUuidGaleria(valor) {
  return UUID.test(String(valor || "").trim());
}

export function normalizarTextoBusqueda(valor) {
  return String(valor || "").trim().slice(0, 80);
}

/** Fecha civil YYYY-MM-DD (Argentina) para filtros de galería. */
export function parsearFechaFiltroGaleria(valor) {
  const texto = String(valor || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return "";
  const [y, m, d] = texto.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  if (fecha.getUTCFullYear() !== y || fecha.getUTCMonth() + 1 !== m || fecha.getUTCDate() !== d) return "";
  return texto;
}

/** Normaliza selección del calendario (YYYY-MM-DD) a filtro de galería. */
export function rangoConfirmadoFechaGaleria(desde, hasta) {
  const d = parsearFechaFiltroGaleria(desde);
  const h = parsearFechaFiltroGaleria(hasta || desde);
  if (!d) return { desde: "", hasta: "" };
  if (!h) return { desde: d, hasta: d };
  if (d <= h) return { desde: d, hasta: h };
  return { desde: h, hasta: d };
}

export function rangoFechasGaleriaValido(desde, hasta) {
  if (!desde && !hasta) return { ok: true, desde: "", hasta: "" };
  const d = parsearFechaFiltroGaleria(desde);
  const h = parsearFechaFiltroGaleria(hasta);
  if (desde && !d) return { ok: false, error: "La fecha desde no es válida." };
  if (hasta && !h) return { ok: false, error: "La fecha hasta no es válida." };
  if (d && h && d > h) return { ok: false, error: "La fecha desde no puede ser posterior a la hasta." };
  return { ok: true, desde: d, hasta: h };
}

export function parsearCursorGaleria(cursorFecha, cursorId) {
  const fecha = String(cursorFecha || "").trim();
  const id = esUuidGaleria(cursorId) ? String(cursorId).trim() : "";
  if (!fecha && !id) return null;
  if (!fecha || !id) return { invalido: true };
  return { fecha_evento: fecha, id };
}

export function cadenaFiltroCursorKeysetGaleria(cursor) {
  if (!cursor?.fecha_evento || !cursor?.id) return null;
  const f = citaFiltro(cursor.fecha_evento);
  const id = citaFiltro(cursor.id);
  return `registro.fecha_evento.lt.${f},and(registro.fecha_evento.eq.${f},id.lt.${id})`;
}

export function fechaEventoOrdenGaleria(fila) {
  return String(fila?.fecha_evento || fila?.registro?.fecha_evento || "");
}

export function marcaTiempoOrdenGaleria(fila) {
  const ms = Date.parse(fechaEventoOrdenGaleria(fila));
  return Number.isNaN(ms) ? 0 : ms;
}

export function idOrdenGaleria(fila) {
  return String(fila?.id || "");
}

/** Keyset descendente por (fecha_evento del registro, id de la foto). */
export function fotoAntesEnOrdenGaleria(foto, cursor) {
  if (!cursor) return true;
  const fecha = fechaEventoOrdenGaleria(foto);
  const tFoto = Date.parse(fecha);
  const tCursor = Date.parse(String(cursor.fecha_evento || ""));
  if (!Number.isNaN(tFoto) && !Number.isNaN(tCursor) && tFoto !== tCursor) {
    return tFoto < tCursor;
  }
  if (fecha < String(cursor.fecha_evento || "")) return true;
  if (fecha > String(cursor.fecha_evento || "")) return false;
  return idOrdenGaleria(foto) < String(cursor.id || "");
}

export function compararFotosGaleria(a, b) {
  const diff = marcaTiempoOrdenGaleria(b) - marcaTiempoOrdenGaleria(a);
  if (diff !== 0) return diff;
  return idOrdenGaleria(b).localeCompare(idOrdenGaleria(a));
}

export function cursorDesdeUltimaFoto(fotos) {
  const ultima = fotos?.[fotos.length - 1];
  if (!ultima?.id || !ultima?.fecha_evento) return null;
  return { fecha_evento: ultima.fecha_evento, id: ultima.id };
}

/** Índice de la siguiente tanda en un arreglo ya ordenado con compararFotosGaleria. */
export function indiceDespuesCursorGaleria(filasOrdenadas, cursor) {
  if (!cursor?.id || !cursor?.fecha_evento) return 0;
  const exacto = (filasOrdenadas || []).findIndex((f) => idOrdenGaleria(f) === String(cursor.id));
  if (exacto >= 0) return exacto + 1;
  for (let i = 0; i < (filasOrdenadas || []).length; i++) {
    if (fotoAntesEnOrdenGaleria(filasOrdenadas[i], cursor)) return i;
  }
  return (filasOrdenadas || []).length;
}

export function mensajeGaleriaVacia({ errorCarga, sinCoincidencias, sinFotosEnCuenta }) {
  if (errorCarga) return "";
  if (sinCoincidencias) return "Ninguna foto coincide con los filtros. Probá ampliar la búsqueda o limpiar filtros.";
  if (sinFotosEnCuenta) {
    return "Guardá imágenes en tus registros para luego poder mostrárselas a Flora.";
  }
  return "No hay fotos para mostrar.";
}

export function hayFiltrosActivosGaleria(filtros = {}) {
  return Boolean(
    normalizarTextoBusqueda(filtros.busqueda) ||
      (filtros.unidadId && esUuidGaleria(filtros.unidadId)) ||
      parsearFechaFiltroGaleria(filtros.fechaDesde) ||
      parsearFechaFiltroGaleria(filtros.fechaHasta),
  );
}

export function filasPlantasRegistro(registro) {
  return registro?.registro_plantas || registro?.plantas || [];
}

export function nombrePlantaDesdeRegistro(registro) {
  const filas = filasPlantasRegistro(registro);
  if (filas.length === 1) {
    const fila = filas[0];
    const desdePlanta = String(fila?.planta?.nombre || "").trim();
    if (desdePlanta) return desdePlanta;
    return String(fila?.nombre_planta || "").trim();
  }
  if (filas.length > 1) return "Varias plantas";
  return "";
}
