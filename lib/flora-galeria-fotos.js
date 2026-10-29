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

/** Keyset descendente por (fecha_evento del registro, id de la foto). */
export function fotoAntesEnOrdenGaleria(foto, cursor) {
  if (!cursor) return true;
  const fecha = String(foto?.fecha_evento || "");
  if (fecha < cursor.fecha_evento) return true;
  if (fecha > cursor.fecha_evento) return false;
  return String(foto?.id || "") < cursor.id;
}

export function compararFotosGaleria(a, b) {
  const cmp = String(b?.fecha_evento || "").localeCompare(String(a?.fecha_evento || ""));
  if (cmp !== 0) return cmp;
  return String(b?.id || "").localeCompare(String(a?.id || ""));
}

export function cursorDesdeUltimaFoto(fotos) {
  const ultima = fotos?.[fotos.length - 1];
  if (!ultima?.id || !ultima?.fecha_evento) return null;
  return { fecha_evento: ultima.fecha_evento, id: ultima.id };
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
