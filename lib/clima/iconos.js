export const ICONO_RESPALDO = "not-available";

// condition.code de WeatherAPI. El texto traducido no identifica el icono.
// Un string vale para día y noche. Un par es [día, noche].
const ICONOS_POR_CODIGO = {
  1000: ["clear-day", "clear-night"],
  1003: ["partly-cloudy-day", "partly-cloudy-night"],
  1006: "cloudy",
  1009: ["overcast-day", "overcast-night"],
  1030: "mist",
  1063: ["partly-cloudy-day-rain", "partly-cloudy-night-rain"],
  1066: ["partly-cloudy-day-snow", "partly-cloudy-night-snow"],
  1069: "sleet",
  1072: "drizzle",
  1087: ["thunderstorms-day", "thunderstorms-night"],
  1114: "snow",
  1117: "snow",
  1135: ["fog-day", "fog-night"],
  1147: ["fog-day", "fog-night"],
  1150: "drizzle",
  1153: "drizzle",
  1168: "drizzle",
  1171: "drizzle",
  1180: ["partly-cloudy-day-rain", "partly-cloudy-night-rain"],
  1183: "rain",
  1186: "rain",
  1189: "rain",
  1192: "extreme-rain",
  1195: "extreme-rain",
  1198: "sleet",
  1201: "sleet",
  1204: "sleet",
  1207: "sleet",
  1210: ["partly-cloudy-day-snow", "partly-cloudy-night-snow"],
  1213: "snow",
  1216: "snow",
  1219: "snow",
  1222: "snow",
  1225: "snow",
  1237: "hail",
  1240: ["partly-cloudy-day-rain", "partly-cloudy-night-rain"],
  1243: "rain",
  1246: "extreme-rain",
  1249: "sleet",
  1252: "sleet",
  1255: ["partly-cloudy-day-snow", "partly-cloudy-night-snow"],
  1258: "snow",
  1261: "hail",
  1264: "hail",
  1273: ["thunderstorms-day-rain", "thunderstorms-night-rain"],
  1276: ["thunderstorms-day-rain", "thunderstorms-night-rain"],
  1279: ["thunderstorms-day-snow", "thunderstorms-night-snow"],
  1282: ["thunderstorms-day-snow", "thunderstorms-night-snow"],
};

export const CODIGOS_CLIMA = Object.keys(ICONOS_POR_CODIGO).map(Number);

export function iconoClima(codigo, momento) {
  if (typeof codigo !== "number" || !Number.isInteger(codigo)) return ICONO_RESPALDO;
  const icono = ICONOS_POR_CODIGO[codigo];
  if (!icono) return ICONO_RESPALDO;
  if (typeof icono === "string") return icono;
  return momento === "noche" ? icono[1] : icono[0];
}

// El día de pronóstico no trae is_day. Se ilustra con la variante diurna.
export function iconoPronostico(codigo) {
  return iconoClima(codigo, "dia");
}
