/**
 * Forma pública del resumen del dashboard. Puro: descarta cualquier campo que no sea un conteo
 * o una fecha. Si la respuesta no cierra, no se rellenan ceros.
 */

export const RPC_DASHBOARD = "resumen_dashboard_admin";

const ENTERO = Number.MAX_SAFE_INTEGER;
const CLAVES = Object.freeze([
  "generado_en",
  "periodo_corto",
  "periodo_largo",
  "usuarios_total",
  "usuarios_nuevos_7",
  "usuarios_nuevos_30",
  "espacios",
  "unidades",
  "plantas",
  "registros_total",
  "registros_7",
  "registros_30",
  "usuarios_con_registros_7",
  "usuarios_con_registros_30",
  "fotos_registros",
  "bytes_fotos_originales",
  "serie",
]);

const MENSAJE_MIGRACION =
  "El dashboard todavía no está operativo: falta aplicar supabase/admin-dashboard.sql. Hasta entonces no se muestran cifras.";
const MENSAJE_ERROR = "No pudimos leer el resumen. No se muestran cifras parciales.";

export function mensajeDashboard(estado) {
  if (estado === "migracion") return MENSAJE_MIGRACION;
  if (estado === "error") return MENSAJE_ERROR;
  return "";
}

export function clasificarErrorDashboard(error) {
  const codigo = String(error?.code || "");
  const mensaje = String(error?.message || "");
  if (codigo === "PGRST202" || /could not find the function|schema cache/i.test(mensaje)) return "migracion";
  return "error";
}

function entero(valor) {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 0 || valor > ENTERO) return null;
  return valor;
}

function fechaUtc(dia) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!coincidencia) return null;
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const diaMes = Number(coincidencia[3]);
  const utc = Date.UTC(anio, mes - 1, diaMes);
  const fecha = new Date(utc);
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== diaMes) return null;
  return utc;
}

function instante(valor) {
  if (typeof valor !== "string" || valor.length > 40) return null;
  const ms = Date.parse(valor);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * @returns {{ ok: true, resumen: object } | { ok: false }}
 */
export function presentarResumen(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false };
  const claves = Object.keys(data);
  if (claves.length !== CLAVES.length || CLAVES.some((clave) => !Object.hasOwn(data, clave))) return { ok: false };

  const generadoEn = instante(data.generado_en);
  if (!generadoEn) return { ok: false };
  if (data.periodo_corto !== 7 || data.periodo_largo !== 30) return { ok: false };

  const numeros = {};
  for (const clave of CLAVES) {
    if (clave === "generado_en" || clave === "periodo_corto" || clave === "periodo_largo" || clave === "serie") continue;
    const valor = entero(data[clave]);
    if (valor === null) return { ok: false };
    numeros[clave] = valor;
  }

  if (numeros.usuarios_nuevos_7 > numeros.usuarios_nuevos_30) return { ok: false };
  if (numeros.usuarios_nuevos_30 > numeros.usuarios_total) return { ok: false };
  if (numeros.registros_7 > numeros.registros_30 || numeros.registros_30 > numeros.registros_total) return { ok: false };
  if (numeros.usuarios_con_registros_7 > numeros.usuarios_con_registros_30) return { ok: false };
  if (numeros.usuarios_con_registros_7 > numeros.registros_7) return { ok: false };
  if (numeros.usuarios_con_registros_30 > numeros.registros_30) return { ok: false };
  if (numeros.fotos_registros === 0 && numeros.bytes_fotos_originales !== 0) return { ok: false };
  if (numeros.fotos_registros > 0 && numeros.bytes_fotos_originales < numeros.fotos_registros) return { ok: false };

  if (!Array.isArray(data.serie) || data.serie.length !== 30) return { ok: false };
  const serie = [];
  let anterior = null;
  for (const punto of data.serie) {
    if (!punto || typeof punto !== "object" || Array.isArray(punto)) return { ok: false };
    if (Object.keys(punto).length !== 3) return { ok: false };
    const diaMs = fechaUtc(punto.dia);
    const usuariosNuevos = entero(punto.usuarios_nuevos);
    const registros = entero(punto.registros);
    if (diaMs === null || usuariosNuevos === null || registros === null) return { ok: false };
    if (anterior !== null && diaMs - anterior !== 86_400_000) return { ok: false };
    anterior = diaMs;
    serie.push({ dia: punto.dia, usuariosNuevos, registros });
  }

  return {
    ok: true,
    resumen: {
      generadoEn,
      periodoCorto: 7,
      periodoLargo: 30,
      usuariosTotal: numeros.usuarios_total,
      usuariosNuevos7: numeros.usuarios_nuevos_7,
      usuariosNuevos30: numeros.usuarios_nuevos_30,
      espacios: numeros.espacios,
      unidades: numeros.unidades,
      plantas: numeros.plantas,
      registrosTotal: numeros.registros_total,
      registros7: numeros.registros_7,
      registros30: numeros.registros_30,
      usuariosConRegistros7: numeros.usuarios_con_registros_7,
      usuariosConRegistros30: numeros.usuarios_con_registros_30,
      fotosRegistros: numeros.fotos_registros,
      bytesFotosOriginales: numeros.bytes_fotos_originales,
      serie,
    },
  };
}
