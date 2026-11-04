import { DIAS_PRONOSTICO, TOLERANCIA_COORDENADAS } from "@/lib/clima/constantes";
import { coordenadasCercanas, coordenadaValida, zonaHorariaValida } from "@/lib/clima/validar";

function numero(valor, min, max) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return null;
  if (valor < min || valor > max) return null;
  return valor;
}

function textoCorto(valor, maximo) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto || texto.length > maximo) return "";
  return texto;
}

function fechaValida(valor) {
  const texto = typeof valor === "string" ? valor : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return "";
  const [anio, mes, dia] = texto.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return "";
  return texto;
}

function condicion(valor) {
  return textoCorto(valor?.text, 80);
}

function codigoCondicion(valor) {
  const codigo = valor?.code;
  if (!Number.isInteger(codigo) || codigo < 1000 || codigo > 1282) return null;
  return codigo;
}

function esDeDia(valor) {
  if (valor === 1) return true;
  if (valor === 0) return false;
  return null;
}

function normalizarDia(dia) {
  const fecha = fechaValida(dia?.date);
  if (!fecha) return null;
  return {
    fecha,
    maximaC: numero(dia?.day?.maxtemp_c, -80, 60),
    minimaC: numero(dia?.day?.mintemp_c, -80, 60),
    probabilidadLluvia: numero(dia?.day?.daily_chance_of_rain, 0, 100),
    precipitacionMm: numero(dia?.day?.totalprecip_mm, 0, 2000),
    nieveCm: numero(dia?.day?.totalsnow_cm, 0, 500),
    vientoKph: numero(dia?.day?.maxwind_kph, 0, 400),
    condicion: condicion(dia?.day?.condition),
    codigo: codigoCondicion(dia?.day?.condition),
    esPronostico: true,
  };
}

function normalizarAlerta(alerta) {
  const titulo = textoCorto(alerta?.headline, 180) || textoCorto(alerta?.event, 180);
  if (!titulo) return null;
  const descripcion = textoCorto(alerta?.desc, 400);
  const indicacion = textoCorto(alerta?.instruction, 400);
  return {
    origen: "oficial",
    titulo,
    evento: textoCorto(alerta?.event, 180),
    severidad: textoCorto(alerta?.severity, 40),
    desde: textoCorto(alerta?.effective, 40),
    hasta: textoCorto(alerta?.expires, 40),
    descripcion,
    indicacion,
  };
}

function normalizarAlertas(alerts, incluirAlertas) {
  if (!incluirAlertas) return null;
  if (!Array.isArray(alerts?.alert)) return null;
  return alerts.alert.map(normalizarAlerta).filter(Boolean);
}

export function normalizarPronostico(cuerpo, { latitud, longitud, incluirAlertas, zonaConocida = "" }) {
  if (!cuerpo || typeof cuerpo !== "object" || cuerpo.error) return null;
  const pedidas = coordenadaValida(latitud, longitud);
  const recibidas = coordenadaValida(cuerpo.location?.lat, cuerpo.location?.lon);
  if (!pedidas || !recibidas || !coordenadasCercanas(pedidas, recibidas, TOLERANCIA_COORDENADAS)) return null;

  const actual = cuerpo.current
    ? {
        temperaturaC: numero(cuerpo.current.temp_c, -80, 60),
        sensacionC: numero(cuerpo.current.feelslike_c, -80, 60),
        humedad: numero(cuerpo.current.humidity, 0, 100),
        condicion: condicion(cuerpo.current.condition),
        codigo: codigoCondicion(cuerpo.current.condition),
        esDia: esDeDia(cuerpo.current.is_day),
        vientoKph: numero(cuerpo.current.wind_kph, 0, 400),
        precipitacionMm: numero(cuerpo.current.precip_mm, 0, 2000),
        actualizadoEn: textoCorto(cuerpo.current.last_updated, 25),
      }
    : null;

  const dias = (Array.isArray(cuerpo.forecast?.forecastday) ? cuerpo.forecast.forecastday : [])
    .map(normalizarDia)
    .filter(Boolean)
    .slice(0, DIAS_PRONOSTICO);

  const actualUtil = actual && (actual.temperaturaC !== null || actual.condicion || actual.humedad !== null);
  if (!actualUtil && dias.length === 0) return null;

  return {
    localidad: {
      nombre: textoCorto(cuerpo.location?.name, 80),
      region: textoCorto(cuerpo.location?.region, 80),
      pais: textoCorto(cuerpo.location?.country, 80),
      latitud: recibidas.latitud,
      longitud: recibidas.longitud,
      zonaHoraria: zonaHorariaValida(cuerpo.location?.tz_id) || zonaHorariaValida(zonaConocida),
    },
    actual: actualUtil ? actual : null,
    dias,
    alertasOficiales: normalizarAlertas(cuerpo.alerts, incluirAlertas),
  };
}

export function normalizarBusqueda(cuerpo) {
  if (!Array.isArray(cuerpo)) return null;
  const lugares = [];
  for (const item of cuerpo) {
    const id = typeof item?.id === "number" && Number.isSafeInteger(item.id) && item.id > 0 ? item.id : 0;
    const coords = coordenadaValida(item?.lat, item?.lon);
    const nombre = textoCorto(item?.name, 80);
    if (!id || !coords || !nombre) continue;
    lugares.push({
      id,
      nombre,
      region: textoCorto(item?.region, 80),
      pais: textoCorto(item?.country, 80),
      latitud: coords.latitud,
      longitud: coords.longitud,
    });
    if (lugares.length === 8) break;
  }
  return lugares;
}

export function climaGuardadoValido(valor) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const coords = coordenadaValida(valor.localidad?.latitud, valor.localidad?.longitud);
  if (!coords) return null;
  if (!Array.isArray(valor.dias) || valor.dias.length > DIAS_PRONOSTICO) return null;
  if (valor.dias.some((dia) => dia?.esPronostico !== true || !fechaValida(dia?.fecha))) return null;
  if (!valor.actual && valor.dias.length === 0) return null;
  if (valor.actual && typeof valor.actual !== "object") return null;
  if (valor.actual?.temperaturaC != null && typeof valor.actual.temperaturaC !== "number") return null;
  if (!codigoGuardado(valor.actual?.codigo)) return null;
  if (valor.actual?.esDia != null && typeof valor.actual.esDia !== "boolean") return null;
  if (valor.dias.some((dia) => !codigoGuardado(dia?.codigo))) return null;
  return valor;
}

function codigoGuardado(valor) {
  if (valor == null) return true;
  return Number.isInteger(valor) && valor >= 1000 && valor <= 1282;
}
