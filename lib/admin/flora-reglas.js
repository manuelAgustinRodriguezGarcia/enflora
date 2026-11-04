/**
 * Consulta y forma pública del panel de Flora IA.
 * Puro: no habla con Supabase y no rellena tokens ni costos ausentes.
 */

const ZONA = "America/Argentina/Buenos_Aires";
const DESPLAZAMIENTO = "-03:00";
const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MODELO = /^[0-9A-Za-z._:+-]{1,64}$/;
const MAXIMO_DIAS = 366;

export const RPC_RESUMEN_FLORA = "resumen_flora_admin";
export const PERIODOS_FLORA = Object.freeze(["7", "30", "90", "personalizado"]);
export const OPERACIONES_FLORA = Object.freeze(["todos", "chat", "chat_imagen"]);

const CLAVES = Object.freeze([
  "cancelaciones",
  "costo_promedio_usuario_usd",
  "costo_usd",
  "desde",
  "duracion_p50_ms",
  "duracion_p95_ms",
  "duracion_promedio_ms",
  "errores",
  "exitos",
  "facturado_disponible",
  "hasta",
  "muestras_latencia",
  "ok",
  "por_modelo",
  "por_operacion",
  "serie",
  "solicitudes",
  "solicitudes_con_costo",
  "solicitudes_sin_costo",
  "solicitudes_sin_entrada",
  "solicitudes_sin_salida",
  "solicitudes_sin_total",
  "tokens_cache",
  "tokens_entrada",
  "tokens_herramientas",
  "tokens_pensamiento",
  "tokens_salida",
  "tokens_total",
  "usuarios",
  "usuarios_con_costo",
]);

const CLAVES_PROHIBIDAS = Object.freeze([
  "apellido",
  "email",
  "genetica",
  "imagen",
  "mensaje",
  "nombre",
  "observacion",
  "prompt",
  "respuesta",
  "telefono",
  "usuario_id",
]);

const MENSAJE_MIGRACION =
  "Flora IA todavía no está operativa en el panel: falta aplicar supabase/admin-flora.sql. Hasta entonces no se muestran métricas.";
const MENSAJE_ERROR = "No pudimos leer las métricas de Flora. No se muestran cifras parciales.";
const MENSAJE_PERIODO = "El período no es válido. Usá 7, 30 o 90 días, o un rango de hasta 366 días.";
const MENSAJE_FILTRO = "El modelo o el tipo de operación no es válido.";

export function mensajeFlora(estado) {
  if (estado === "migracion") return MENSAJE_MIGRACION;
  if (estado === "error") return MENSAJE_ERROR;
  if (estado === "consulta") return MENSAJE_PERIODO;
  return "";
}

export function clasificarErrorFlora(error) {
  const codigo = String(error?.code || "");
  const mensaje = String(error?.message || "");
  if (codigo === "PGRST202" || /could not find the function|schema cache/i.test(mensaje)) return "migracion";
  return "error";
}

export function codigoFloraConocido(data) {
  if (!data || typeof data !== "object" || data.ok !== false) return "";
  if (data.codigo === "consulta_invalida") return data.codigo;
  return "desconocido";
}

function falloConsulta(error) {
  return { ok: false, error };
}

function textoCorto(valor, maximo = 40) {
  if (valor === undefined || valor === null || valor === "") return "";
  if (typeof valor === "string") return valor.length <= maximo ? valor : null;
  if (Array.isArray(valor) && valor.length === 1 && typeof valor[0] === "string" && valor[0].length <= maximo) return valor[0];
  return null;
}

export function diaArgentina(fecha) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

export function sumarDiasCalendario(dia, cantidad) {
  const coincidencia = RE_DIA.exec(dia);
  if (!coincidencia) return null;
  const fecha = new Date(Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]) + cantidad));
  return fecha.toISOString().slice(0, 10);
}

export function inicioDiaArgentina(dia) {
  if (!RE_DIA.test(dia)) return null;
  const fecha = new Date(`${dia}T00:00:00.000${DESPLAZAMIENTO}`);
  if (Number.isNaN(fecha.getTime())) return null;
  if (diaArgentina(fecha) !== dia) return null;
  return fecha.toISOString();
}

function listarDias(desdeDia, hastaDia) {
  const dias = [];
  let cursor = desdeDia;
  while (cursor <= hastaDia) {
    dias.push(cursor);
    cursor = sumarDiasCalendario(cursor, 1);
    if (!cursor || dias.length > MAXIMO_DIAS) return null;
  }
  return dias;
}

function rangoEntreDias(desdeDia, hastaDia) {
  const dias = listarDias(desdeDia, hastaDia);
  if (!dias) return null;
  const hastaExclusivo = sumarDiasCalendario(hastaDia, 1);
  const desde = inicioDiaArgentina(desdeDia);
  const hasta = inicioDiaArgentina(hastaExclusivo);
  if (!desde || !hasta) return null;
  return { desdeDia, hastaDia, desde, hasta, dias };
}

function resolverPeriodo(bruto, ahora) {
  const periodo = bruto.periodo === "" ? "30" : bruto.periodo;
  if (periodo === null || !PERIODOS_FLORA.includes(periodo)) return falloConsulta(MENSAJE_PERIODO);
  if (periodo !== "personalizado") {
    const hoy = diaArgentina(ahora);
    const desdeDia = sumarDiasCalendario(hoy, -(Number(periodo) - 1));
    const rango = rangoEntreDias(desdeDia, hoy);
    if (!rango) return falloConsulta(MENSAJE_PERIODO);
    return { ok: true, periodo, ...rango };
  }
  if (!RE_DIA.test(bruto.desde) || !RE_DIA.test(bruto.hasta)) return falloConsulta(MENSAJE_PERIODO);
  const rango = rangoEntreDias(bruto.desde, bruto.hasta);
  if (!rango) return falloConsulta(MENSAJE_PERIODO);
  return { ok: true, periodo, ...rango };
}

export function interpretarConsultaFlora(parametros, ahora = new Date()) {
  const fuente = parametros && typeof parametros === "object" ? parametros : {};
  const bruto = {
    periodo: textoCorto(fuente.periodo),
    desde: textoCorto(fuente.desde),
    hasta: textoCorto(fuente.hasta),
    modelo: textoCorto(fuente.modelo, 64),
    operacion: textoCorto(fuente.operacion),
  };
  if (Object.values(bruto).some((valor) => valor === null)) return falloConsulta(MENSAJE_PERIODO);
  const periodo = resolverPeriodo(bruto, ahora);
  if (!periodo.ok) return periodo;
  const modelo = bruto.modelo === "" ? "todos" : bruto.modelo;
  if (!MODELO.test(modelo)) return falloConsulta(MENSAJE_FILTRO);
  const operacion = bruto.operacion === "" ? "todos" : bruto.operacion;
  if (!OPERACIONES_FLORA.includes(operacion)) return falloConsulta(MENSAJE_FILTRO);
  return {
    ok: true,
    consulta: {
      periodo: periodo.periodo,
      desdeDia: periodo.desdeDia,
      hastaDia: periodo.hastaDia,
      desde: periodo.desde,
      hasta: periodo.hasta,
      dias: periodo.dias,
      modelo,
      operacion,
    },
  };
}

export function prepararConsultaFlora(parametros, ahora = new Date()) {
  const interpretado = interpretarConsultaFlora(parametros, ahora);
  const consulta = interpretado.ok ? interpretado.consulta : interpretarConsultaFlora({}, ahora).consulta;
  return { interpretado, consulta };
}

export function parametrosConsultaFlora(consulta) {
  const params = new URLSearchParams();
  if (consulta.periodo !== "30") params.set("periodo", consulta.periodo);
  if (consulta.periodo === "personalizado") {
    params.set("desde", consulta.desdeDia);
    params.set("hasta", consulta.hastaDia);
  }
  if (consulta.modelo !== "todos") params.set("modelo", consulta.modelo);
  if (consulta.operacion !== "todos") params.set("operacion", consulta.operacion);
  return params.toString();
}

export function argumentosResumenFlora(consulta) {
  return {
    p_desde: consulta.desde,
    p_hasta: consulta.hasta,
    p_modelo: consulta.modelo,
    p_operacion: consulta.operacion,
  };
}

function clavesExactas(dato, claves) {
  if (!dato || typeof dato !== "object" || Array.isArray(dato)) return false;
  const presentes = Object.keys(dato);
  return presentes.length === claves.length && claves.every((clave) => Object.hasOwn(dato, clave));
}

function tieneClaveProhibida(valor) {
  if (!valor || typeof valor !== "object") return false;
  if (Array.isArray(valor)) return valor.some((item) => tieneClaveProhibida(item));
  return Object.keys(valor).some((clave) => CLAVES_PROHIBIDAS.includes(clave) || tieneClaveProhibida(valor[clave]));
}

function entero(valor) {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= Number.MAX_SAFE_INTEGER;
}

function enteroONulo(valor) {
  if (valor === null) return null;
  return entero(valor) ? valor : undefined;
}

function dinero(valor) {
  if (valor === null) return null;
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0 || valor > 1_000_000) return undefined;
  return Math.round(valor * 1e8) / 1e8;
}

function instante(valor) {
  if (typeof valor !== "string" || valor.length < 20 || valor.length > 40) return null;
  const ms = Date.parse(valor);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function inicioSemana(dia) {
  const [anio, mes, diaMes] = dia.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, diaMes));
  const desplazamiento = fecha.getUTCDay() === 0 ? 6 : fecha.getUTCDay() - 1;
  fecha.setUTCDate(fecha.getUTCDate() - desplazamiento);
  return fecha.toISOString().slice(0, 10);
}

function agruparSerie(serie, claveDe) {
  const grupos = [];
  for (const punto of serie) {
    const clave = claveDe(punto.dia);
    let grupo = grupos.at(-1);
    if (!grupo || grupo.clave !== clave) {
      grupo = { clave, dia: clave, solicitudes: 0, errores: 0, tokensTotal: null, costoUsd: null };
      grupos.push(grupo);
    }
    grupo.solicitudes += punto.solicitudes;
    grupo.errores += punto.errores;
    if (punto.tokensTotal != null) grupo.tokensTotal = (grupo.tokensTotal || 0) + punto.tokensTotal;
    if (punto.costoUsd != null) grupo.costoUsd = Math.round(((grupo.costoUsd || 0) + punto.costoUsd) * 1e8) / 1e8;
  }
  return grupos.map((grupo) => ({
    dia: grupo.dia,
    solicitudes: grupo.solicitudes,
    errores: grupo.errores,
    tokensTotal: grupo.tokensTotal,
    costoUsd: grupo.costoUsd,
  }));
}

export function presentarResumenFlora(data, consulta) {
  if (!clavesExactas(data, CLAVES) || data.ok !== true || data.facturado_disponible !== false || tieneClaveProhibida(data)) {
    return { ok: false };
  }
  const desde = instante(data.desde);
  const hasta = instante(data.hasta);
  if (!desde || !hasta || desde !== new Date(consulta.desde).toISOString() || hasta !== new Date(consulta.hasta).toISOString()) {
    return { ok: false };
  }
  const conteos = [
    data.solicitudes,
    data.usuarios,
    data.exitos,
    data.errores,
    data.cancelaciones,
    data.muestras_latencia,
    data.solicitudes_con_costo,
    data.solicitudes_sin_costo,
    data.solicitudes_sin_entrada,
    data.solicitudes_sin_salida,
    data.solicitudes_sin_total,
    data.usuarios_con_costo,
  ];
  if (!conteos.every(entero)) return { ok: false };
  if (data.exitos + data.errores + data.cancelaciones !== data.solicitudes) return { ok: false };
  const tokens = [
    data.tokens_entrada,
    data.tokens_salida,
    data.tokens_total,
    data.tokens_pensamiento,
    data.tokens_cache,
    data.tokens_herramientas,
  ].map(enteroONulo);
  if (tokens.some((valor) => valor === undefined)) return { ok: false };
  const latencias = [data.duracion_promedio_ms, data.duracion_p50_ms, data.duracion_p95_ms].map(enteroONulo);
  if (latencias.some((valor) => valor === undefined)) return { ok: false };
  if (data.muestras_latencia < 20 && (latencias[1] != null || latencias[2] != null)) return { ok: false };
  const costo = dinero(data.costo_usd);
  const promedio = dinero(data.costo_promedio_usuario_usd);
  if (costo === undefined || promedio === undefined) return { ok: false };
  if (data.solicitudes_con_costo === 0 && (costo != null || promedio != null)) return { ok: false };
  if (!Array.isArray(data.serie) || !Array.isArray(data.por_modelo) || !Array.isArray(data.por_operacion)) return { ok: false };
  if (data.serie.length !== consulta.dias.length) return { ok: false };
  const serie = [];
  for (let i = 0; i < data.serie.length; i += 1) {
    const punto = data.serie[i];
    if (!punto || typeof punto !== "object" || tieneClaveProhibida(punto)) return { ok: false };
    if (!clavesExactas(punto, ["costo_usd", "dia", "errores", "solicitudes", "tokens_total"])) return { ok: false };
    if (punto.dia !== consulta.dias[i] || !entero(punto.solicitudes) || !entero(punto.errores) || punto.errores > punto.solicitudes) {
      return { ok: false };
    }
    const tokensDia = enteroONulo(punto.tokens_total);
    const costoDia = dinero(punto.costo_usd);
    if (tokensDia === undefined || costoDia === undefined) return { ok: false };
    serie.push({
      dia: punto.dia,
      solicitudes: punto.solicitudes,
      errores: punto.errores,
      tokensTotal: tokensDia,
      costoUsd: costoDia,
    });
  }
  const porModelo = [];
  for (const fila of data.por_modelo) {
    if (!clavesExactas(fila, ["costo_usd", "modelo", "solicitudes", "tokens_total"]) || !MODELO.test(fila.modelo)) return { ok: false };
    const tokensModelo = enteroONulo(fila.tokens_total);
    const costoModelo = dinero(fila.costo_usd);
    if (!entero(fila.solicitudes) || tokensModelo === undefined || costoModelo === undefined) return { ok: false };
    porModelo.push({ modelo: fila.modelo, solicitudes: fila.solicitudes, tokensTotal: tokensModelo, costoUsd: costoModelo });
  }
  const porOperacion = [];
  for (const fila of data.por_operacion) {
    if (!clavesExactas(fila, ["costo_usd", "operacion", "solicitudes", "tokens_total"])) return { ok: false };
    if (!["chat", "chat_imagen"].includes(fila.operacion)) return { ok: false };
    const tokensOperacion = enteroONulo(fila.tokens_total);
    const costoOperacion = dinero(fila.costo_usd);
    if (!entero(fila.solicitudes) || tokensOperacion === undefined || costoOperacion === undefined) return { ok: false };
    porOperacion.push({
      operacion: fila.operacion,
      solicitudes: fila.solicitudes,
      tokensTotal: tokensOperacion,
      costoUsd: costoOperacion,
    });
  }
  return {
    ok: true,
    resumen: {
      solicitudes: data.solicitudes,
      usuarios: data.usuarios,
      exitos: data.exitos,
      errores: data.errores,
      cancelaciones: data.cancelaciones,
      muestrasLatencia: data.muestras_latencia,
      duracionPromedioMs: latencias[0],
      duracionP50Ms: latencias[1],
      duracionP95Ms: latencias[2],
      tokensEntrada: tokens[0],
      tokensSalida: tokens[1],
      tokensTotal: tokens[2],
      tokensPensamiento: tokens[3],
      tokensCache: tokens[4],
      tokensHerramientas: tokens[5],
      solicitudesSinEntrada: data.solicitudes_sin_entrada,
      solicitudesSinSalida: data.solicitudes_sin_salida,
      solicitudesSinTotal: data.solicitudes_sin_total,
      costoUsd: costo,
      costoPromedioUsuarioUsd: promedio,
      solicitudesConCosto: data.solicitudes_con_costo,
      solicitudesSinCosto: data.solicitudes_sin_costo,
      usuariosConCosto: data.usuarios_con_costo,
      facturadoDisponible: false,
      porModelo,
      porOperacion,
      serie,
      serieSemana: agruparSerie(serie, inicioSemana),
      serieMes: agruparSerie(serie, (dia) => dia.slice(0, 7)),
    },
  };
}
