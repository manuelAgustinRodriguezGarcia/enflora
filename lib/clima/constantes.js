/** Tope de WeatherAPI para condiciones actuales. El pronóstico admite 24 h. */
export const TOPE_CACHE_CONDICION_MS = 60 * 60 * 1000;
export const TOPE_CACHE_PRONOSTICO_MS = 24 * 60 * 60 * 1000;

/** Una sola respuesta trae actual y pronóstico: la caché no puede pasar de 60 min. */
export const TTL_PRONOSTICO_MS = 30 * 60 * 1000;
export const TTL_BUSQUEDA_MS = 12 * 60 * 60 * 1000;
export const DIAS_PRONOSTICO = 4;
export const TOLERANCIA_COORDENADAS = 0.75;
export const PROVEEDOR_CLIMA = Object.freeze({
  id: "weatherapi",
  nombre: "WeatherAPI.com",
  url: "https://www.weatherapi.com/",
});

export const TEXTO_ATRIBUCION = "Datos meteorológicos de WeatherAPI.com.";
export const TEXTO_DESCARGO =
  "El pronóstico es estimativo y puede cambiar. No lo uses como única referencia para decisiones de seguridad. Consultá los avisos del servicio meteorológico oficial.";
export const TEXTO_AVISO_ENFLORA =
  "Aviso calculado por ENFLORA a partir del pronóstico. No es una alerta meteorológica oficial.";
export const TEXTO_ALERTA_OFICIAL =
  "Alerta emitida por un servicio meteorológico oficial y retransmitida por WeatherAPI.com. ENFLORA no la calcula.";

const UMBRAL_FRIO = 5;
const UMBRAL_CALOR = 35;
const UMBRAL_LLUVIA = 20;
const UMBRAL_VIENTO = 50;

function entero(env, clave, defecto, min, max) {
  const bruto = env?.[clave];
  if (bruto === undefined || String(bruto).trim() === "") return defecto;
  const valor = Number(bruto);
  if (!Number.isInteger(valor) || valor < min || valor > max) return defecto;
  return valor;
}

function decimal(env, clave, defecto, min, max) {
  const bruto = env?.[clave];
  if (bruto === undefined || String(bruto).trim() === "") return defecto;
  const valor = Number(bruto);
  if (!Number.isFinite(valor) || valor < min || valor > max) return defecto;
  return valor;
}

export function umbralesClima(env = process.env) {
  let temperaturaBajaC = decimal(env, "CLIMA_UMBRAL_FRIO_C", UMBRAL_FRIO, -40, 20);
  let calorC = decimal(env, "CLIMA_UMBRAL_CALOR_C", UMBRAL_CALOR, 25, 55);
  if (calorC <= temperaturaBajaC) {
    temperaturaBajaC = UMBRAL_FRIO;
    calorC = UMBRAL_CALOR;
  }
  return Object.freeze({
    temperaturaBajaC,
    calorC,
    lluviaMm: decimal(env, "CLIMA_UMBRAL_LLUVIA_MM", UMBRAL_LLUVIA, 1, 200),
    vientoKph: decimal(env, "CLIMA_UMBRAL_VIENTO_KPH", UMBRAL_VIENTO, 20, 200),
  });
}

export function limitesClima(env = process.env) {
  return Object.freeze({
    globalDia: entero(env, "CLIMA_LIMITE_GLOBAL_DIA", 2000, 1, 3000),
    usuarioDia: entero(env, "CLIMA_LIMITE_USUARIO_DIA", 48, 1, 200),
    busquedaHora: entero(env, "CLIMA_LIMITE_BUSQUEDA_HORA", 30, 1, 100),
  });
}

export function mensajeClima(codigo) {
  switch (codigo) {
    case "sin_configuracion":
      return "El clima no está configurado en el servidor.";
    case "sin_acceso":
      return "WeatherAPI rechazó la clave. Revisá que WEATHERAPI_KEY sea la del panel de weatherapi.com.";
    case "limite":
      return "Se alcanzó el límite de consultas meteorológicas. Probá más tarde.";
    case "cuota_proveedor":
      return "El proveedor meteorológico alcanzó su límite. No hay datos para mostrar.";
    case "proveedor":
      return "El servicio meteorológico no respondió. No hay datos para mostrar.";
    case "respuesta_invalida":
      return "La respuesta del servicio meteorológico no se pudo usar. No hay datos para mostrar.";
    case "ubicacion_invalida":
      return "Esa localidad no es válida. Buscá otra vez.";
    case "sin_resultados":
      return "No encontramos localidades con ese nombre.";
    case "consulta_invalida":
      return "Escribí al menos 2 letras de la ciudad.";
    case "sin_sesion":
      return "Tenés que iniciar sesión.";
    case "no_disponible":
      return "Falta aplicar la migración de clima en la base.";
    case "espacio_invalido":
      return "El clima corresponde a espacios exteriores.";
    case "sin_datos":
      return "No hay datos meteorológicos para mostrar.";
    default: {
      const agotado = codigo;
      void agotado;
      return "No se pudo completar la consulta de clima.";
    }
  }
}
