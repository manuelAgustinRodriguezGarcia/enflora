import { DIAS_PRONOSTICO } from "@/lib/clima/constantes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUuid(valor) {
  return UUID.test(String(valor || ""));
}

export function coordenadaValida(latitud, longitud) {
  const lat = typeof latitud === "number" ? latitud : Number.NaN;
  const lon = typeof longitud === "number" ? longitud : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { latitud: lat, longitud: lon };
}

export function coordenadaLeida(latitud, longitud) {
  const lat = typeof latitud === "string" ? Number(latitud) : latitud;
  const lon = typeof longitud === "string" ? Number(longitud) : longitud;
  return coordenadaValida(lat, lon);
}

export function redondearCoordenada(valor) {
  return Math.round(valor * 100) / 100;
}

export function clavePronostico(latitud, longitud) {
  const lat = redondearCoordenada(latitud);
  const lon = redondearCoordenada(longitud);
  return `pronostico:es:d${DIAS_PRONOSTICO}:${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export function claveBusqueda(consulta) {
  return `busqueda:${String(consulta || "").toLowerCase()}`;
}

export function normalizarConsulta(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

export function consultaValida(valor) {
  const texto = normalizarConsulta(valor);
  if (texto.length < 2 || texto.length > 80) return "";
  if (!/^[\p{L}\p{N}\s,.'-]+$/u.test(texto)) return "";
  if (!/\p{L}/u.test(texto)) return "";
  return texto;
}

export function idLugarValido(valor) {
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) return 0;
  return numero;
}

export function zonaHorariaValida(zona) {
  const texto = String(zona || "").trim();
  if (!texto || texto.length > 80 || texto === "UTC") return texto === "UTC" ? "" : "";
  if (!/^[A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(texto)) return "";
  try {
    Intl.DateTimeFormat("es-AR", { timeZone: texto }).format(0);
    return texto;
  } catch {
    return "";
  }
}

export function ventanaDia(epoch) {
  const fecha = new Date(epoch);
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())).toISOString();
}

export function ventanaHora(epoch) {
  const fecha = new Date(epoch);
  return new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), fecha.getUTCHours())
  ).toISOString();
}

export function puedeAsociarUbicacion({ usuarioId, duenoId, tipo }) {
  return Boolean(usuarioId) && usuarioId === duenoId && tipo === "exterior";
}

export function coordenadasCercanas(origen, destino, tolerancia) {
  if (!origen || !destino) return false;
  return (
    Math.abs(origen.latitud - destino.latitud) <= tolerancia &&
    Math.abs(origen.longitud - destino.longitud) <= tolerancia
  );
}

export function tablaClimaAusente(error) {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (/ubicaciones_clima|preferencias_clima/i.test(texto)) return true;
  return ["PGRST200", "PGRST205", "42P01"].includes(error?.code);
}

export function filtrarUbicaciones(filas, usuarioId) {
  return (filas || []).filter((fila) => fila && fila.usuario_id === usuarioId);
}
