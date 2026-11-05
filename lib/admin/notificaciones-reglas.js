/**
 * Consulta y forma pública del monitoreo de notificaciones.
 * Puro: no habla con Supabase y no inventa aperturas ni envíos.
 */

const ZONA = "America/Argentina/Buenos_Aires";
const DESPLAZAMIENTO = "-03:00";
const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAXIMO_DIAS = 366;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLAVE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$/;

export const RPC_RESUMEN_NOTIFICACIONES = "resumen_notificaciones_admin";
export const RPC_LISTAR_CAMPANAS = "listar_campanas_notificaciones_admin";
export const RPC_DETALLE_CAMPANA = "detalle_campana_notificaciones_admin";
export const PERIODOS_NOTIFICACIONES = Object.freeze(["7", "30", "90", "personalizado"]);
export const ESTADOS_CAMPANA = Object.freeze(["borrador", "programada", "en_curso", "completada", "cancelada", "error"]);
export const ESTADOS_FILTRO = Object.freeze(["todos", ...ESTADOS_CAMPANA]);
export const LIMITE_CAMPANAS = 20;
export const PLATAFORMAS = Object.freeze(["android", "desconocida", "escritorio", "ios"]);
export const MOTIVOS_BAJA = Object.freeze(["credenciales", "expirada", "otro", "reemplazada", "sin_motivo", "usuario"]);
export const CATEGORIAS_ERROR = Object.freeze([
  "credenciales",
  "interrumpido",
  "omitido",
  "otro",
  "suscripcion_invalida",
  "temporal",
]);

const CLAVES_RESUMEN = Object.freeze([
  "aceptados",
  "aceptados_periodo",
  "activas",
  "altas_periodo",
  "aperturas_disponibles",
  "desde",
  "dispositivos_sin_cuenta",
  "envio_masivo_habilitado",
  "envios",
  "envios_campana",
  "envios_periodo",
  "envios_prueba",
  "errores",
  "errores_periodo",
  "expirados",
  "expirados_periodo",
  "hasta",
  "inactivas",
  "invalidadas",
  "medido_en",
  "ok",
  "omitidos",
  "omitidos_periodo",
  "pendientes",
  "por_baja",
  "por_error",
  "por_plataforma",
  "serie",
  "suscripciones",
  "ultima_actividad",
  "usuarios_activos",
]);

const CLAVES_LISTA = Object.freeze(["filas", "limite", "offset", "ok", "total"]);
const CLAVES_CAMPANA = Object.freeze([
  "aceptados",
  "clave",
  "creada_en",
  "dispositivos",
  "envios",
  "errores",
  "estado",
  "expirados",
  "finalizada_en",
  "habilitada",
  "id",
  "iniciada_en",
  "omitidos",
  "pendientes",
  "programada_para",
  "titulo",
]);

const CLAVES_PROHIBIDAS = Object.freeze([
  "auth",
  "clave_idempotencia",
  "email",
  "endpoint",
  "error",
  "mensaje",
  "p256dh",
  "recibo_hash",
  "token",
  "url",
  "user_agent",
  "usuario_id",
  "vapid",
]);

const MENSAJE_MIGRACION =
  "Notificaciones todavía no está operativo en el panel: falta aplicar supabase/admin-notificaciones.sql. Hasta entonces no se muestran cifras. La prueba a tus propios dispositivos sigue disponible.";
const MENSAJE_ERROR = "No pudimos leer las notificaciones. No se muestran cifras parciales.";
const MENSAJE_PERIODO = "El período o el estado no es válido. Usá 7, 30 o 90 días, o un rango de hasta 366 días.";

export function idCampanaValido(id) {
  return typeof id === "string" && UUID.test(id);
}

export function mensajeNotificaciones(estado) {
  if (estado === "migracion") return MENSAJE_MIGRACION;
  if (estado === "error") return MENSAJE_ERROR;
  if (estado === "consulta") return MENSAJE_PERIODO;
  return "";
}

export function clasificarErrorNotificaciones(error) {
  const codigo = String(error?.code || "");
  const mensaje = String(error?.message || "");
  if (codigo === "PGRST202" || /could not find the function|schema cache/i.test(mensaje)) return "migracion";
  return "error";
}

export function codigoNotificacionesConocido(data) {
  if (!data || typeof data !== "object" || data.ok !== false) return "";
  if (data.codigo === "consulta_invalida" || data.codigo === "no_encontrada") return data.codigo;
  return "desconocido";
}

/** Misma clasificación que el SQL: nunca devuelve el texto crudo del fallo. */
export function clasificarFalloEnvio({ estado, codigo, error }) {
  if (estado === "aceptado" || estado === "pendiente" || estado === "enviando") return null;
  if (codigo === 404 || codigo === 410 || estado === "expirado") return "suscripcion_invalida";
  if (codigo === 401 || codigo === 403) return "credenciales";
  if (codigo === 408 || codigo === 429 || (typeof codigo === "number" && codigo >= 500)) return "temporal";
  if (estado === "error" && error === "interrumpido") return "interrumpido";
  if (estado === "omitido") return "omitido";
  return "otro";
}

export function tasaErrorNotificaciones(resumen) {
  const cerrados = resumen.aceptados_periodo + resumen.errores_periodo + resumen.expirados_periodo + resumen.omitidos_periodo;
  if (cerrados === 0) return null;
  return resumen.errores_periodo / cerrados;
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
  if (periodo === null || !PERIODOS_NOTIFICACIONES.includes(periodo)) return falloConsulta(MENSAJE_PERIODO);
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

function resolverEstado(bruto) {
  const estado = bruto === "" ? "todos" : bruto;
  if (estado === null || !ESTADOS_FILTRO.includes(estado)) return null;
  return estado;
}

function resolverOffset(bruto) {
  if (bruto === "") return 0;
  if (bruto === null || !/^[0-9]{1,6}$/.test(bruto)) return null;
  const numero = Number(bruto);
  if (!Number.isInteger(numero) || numero > 100000) return null;
  return numero;
}

export function interpretarConsultaNotificaciones(parametros, ahora = new Date()) {
  const fuente = parametros && typeof parametros === "object" ? parametros : {};
  const bruto = {
    periodo: textoCorto(fuente.periodo),
    desde: textoCorto(fuente.desde),
    hasta: textoCorto(fuente.hasta),
    estado: textoCorto(fuente.estado),
    offset: textoCorto(fuente.offset),
  };
  if (Object.values(bruto).some((valor) => valor === null)) return falloConsulta(MENSAJE_PERIODO);
  const periodo = resolverPeriodo(bruto, ahora);
  if (!periodo.ok) return periodo;
  const estado = resolverEstado(bruto.estado);
  const offset = resolverOffset(bruto.offset);
  if (estado === null || offset === null) return falloConsulta(MENSAJE_PERIODO);
  return {
    ok: true,
    consulta: {
      periodo: periodo.periodo,
      desdeDia: periodo.desdeDia,
      hastaDia: periodo.hastaDia,
      desde: periodo.desde,
      hasta: periodo.hasta,
      dias: periodo.dias,
      estado,
      offset,
    },
  };
}

export function prepararConsultaNotificaciones(parametros, ahora = new Date()) {
  const interpretado = interpretarConsultaNotificaciones(parametros, ahora);
  const consulta = interpretado.ok ? interpretado.consulta : interpretarConsultaNotificaciones({}, ahora).consulta;
  return { interpretado, consulta };
}

export function argumentosResumenNotificaciones(consulta) {
  return { p_desde: consulta.desde, p_hasta: consulta.hasta };
}

export function argumentosListarCampanas(consulta) {
  return {
    p_desde: consulta.desde,
    p_hasta: consulta.hasta,
    p_estado: consulta.estado,
    p_limite: LIMITE_CAMPANAS,
    p_offset: consulta.offset,
  };
}

export function argumentosDetalleCampana(id) {
  return { p_id: id };
}

export function enlaceNotificaciones(consulta, extra = {}) {
  const params = new URLSearchParams();
  if (consulta.periodo && consulta.periodo !== "30") params.set("periodo", consulta.periodo);
  if (consulta.periodo === "personalizado") {
    params.set("desde", consulta.desdeDia);
    params.set("hasta", consulta.hastaDia);
  }
  if (consulta.estado && consulta.estado !== "todos") params.set("estado", consulta.estado);
  const offset = Object.hasOwn(extra, "offset") ? extra.offset : consulta.offset;
  if (offset) params.set("offset", String(offset));
  const consultaTexto = params.toString();
  const base = extra.id ? `/admin/notificaciones/${extra.id}` : "/admin/notificaciones";
  return consultaTexto ? `${base}?${consultaTexto}` : base;
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

function textoSensible(valor) {
  if (typeof valor !== "string") return false;
  const texto = valor.toLowerCase();
  return texto.includes("http://") || texto.includes("https://") || texto.includes("endpoint") || texto.includes("vapid");
}

function entero(valor) {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= Number.MAX_SAFE_INTEGER;
}

function instante(valor, obligatorio) {
  if (valor === null) return !obligatorio;
  return typeof valor === "string" && valor.length <= 40 && !Number.isNaN(Date.parse(valor));
}

function mismoInstante(valor, esperado) {
  const leido = Date.parse(valor);
  const pedido = Date.parse(esperado);
  return Number.isFinite(leido) && leido === pedido;
}

function suma(filas, clave) {
  return filas.reduce((total, fila) => total + fila[clave], 0);
}

function grupo(filas, clavesEsperadas, clave, valores) {
  if (!Array.isArray(filas) || filas.length !== valores.length) return false;
  const vistos = new Set();
  for (const fila of filas) {
    if (!clavesExactas(fila, clavesEsperadas) || !valores.includes(fila[clave]) || vistos.has(fila[clave])) return false;
    vistos.add(fila[clave]);
  }
  return vistos.size === valores.length;
}

export function presentarResumenNotificaciones(data, consulta) {
  if (!data || typeof data !== "object" || data.ok !== true) return { ok: false };
  if (tieneClaveProhibida(data) || !clavesExactas(data, CLAVES_RESUMEN)) return { ok: false };
  if (data.aperturas_disponibles !== false || data.envio_masivo_habilitado !== false) return { ok: false };
  if (!mismoInstante(data.desde, consulta.desde) || !mismoInstante(data.hasta, consulta.hasta)) return { ok: false };
  const numeros = [
    "aceptados",
    "aceptados_periodo",
    "activas",
    "altas_periodo",
    "dispositivos_sin_cuenta",
    "envios",
    "envios_campana",
    "envios_periodo",
    "envios_prueba",
    "errores",
    "errores_periodo",
    "expirados",
    "expirados_periodo",
    "inactivas",
    "invalidadas",
    "omitidos",
    "omitidos_periodo",
    "pendientes",
    "suscripciones",
    "usuarios_activos",
  ];
  if (numeros.some((clave) => !entero(data[clave]))) return { ok: false };
  if (!instante(data.medido_en, true) || !instante(data.ultima_actividad, false)) return { ok: false };
  if (data.activas + data.inactivas !== data.suscripciones) return { ok: false };
  if (data.usuarios_activos > data.activas || data.dispositivos_sin_cuenta > data.activas) return { ok: false };
  if (data.invalidadas > data.inactivas) return { ok: false };
  if (data.envios_prueba + data.envios_campana !== data.envios) return { ok: false };
  if (data.aceptados + data.errores + data.expirados + data.omitidos + data.pendientes !== data.envios) return { ok: false };
  if (data.envios_periodo > data.envios || data.aceptados_periodo > data.envios_periodo) return { ok: false };
  if (data.errores_periodo > data.envios_periodo || data.expirados_periodo > data.envios_periodo) return { ok: false };
  if (data.omitidos_periodo > data.envios_periodo || data.altas_periodo > data.suscripciones) return { ok: false };
  if (
    !grupo(data.por_plataforma, ["activas", "plataforma", "suscripciones"], "plataforma", PLATAFORMAS) ||
    !grupo(data.por_baja, ["motivo", "suscripciones"], "motivo", MOTIVOS_BAJA) ||
    !grupo(data.por_error, ["categoria", "envios"], "categoria", CATEGORIAS_ERROR)
  ) {
    return { ok: false };
  }
  if (data.por_plataforma.some((fila) => !entero(fila.suscripciones) || !entero(fila.activas) || fila.activas > fila.suscripciones)) {
    return { ok: false };
  }
  if (data.por_baja.some((fila) => !entero(fila.suscripciones)) || data.por_error.some((fila) => !entero(fila.envios))) {
    return { ok: false };
  }
  if (suma(data.por_plataforma, "suscripciones") !== data.suscripciones) return { ok: false };
  if (suma(data.por_plataforma, "activas") !== data.activas) return { ok: false };
  if (suma(data.por_baja, "suscripciones") !== data.inactivas) return { ok: false };
  if (suma(data.por_error, "envios") !== data.errores + data.expirados + data.omitidos) return { ok: false };
  if (!Array.isArray(data.serie) || data.serie.length !== consulta.dias.length) return { ok: false };
  for (let i = 0; i < data.serie.length; i += 1) {
    const punto = data.serie[i];
    if (!clavesExactas(punto, ["aceptados", "dia", "envios", "suscripciones"])) return { ok: false };
    if (punto.dia !== consulta.dias[i]) return { ok: false };
    if (!entero(punto.suscripciones) || !entero(punto.envios) || !entero(punto.aceptados)) return { ok: false };
    if (punto.aceptados > punto.envios || punto.suscripciones > data.altas_periodo) return { ok: false };
  }
  if (suma(data.serie, "suscripciones") !== data.altas_periodo) return { ok: false };
  if (suma(data.serie, "envios") !== data.envios_periodo) return { ok: false };
  if (suma(data.serie, "aceptados") !== data.aceptados_periodo) return { ok: false };
  return { ok: true, resumen: data };
}

function campanaValida(fila) {
  if (!clavesExactas(fila, CLAVES_CAMPANA)) return false;
  if (textoSensible(fila.clave) || textoSensible(fila.titulo) || textoSensible(fila.id)) return false;
  if (typeof fila.id !== "string" || !UUID.test(fila.id)) return false;
  if (typeof fila.clave !== "string" || !CLAVE.test(fila.clave)) return false;
  if (typeof fila.titulo !== "string" || fila.titulo.length < 1 || fila.titulo.length > 120) return false;
  if (!ESTADOS_CAMPANA.includes(fila.estado) || typeof fila.habilitada !== "boolean") return false;
  if (!instante(fila.creada_en, true) || !instante(fila.programada_para, true)) return false;
  if (!instante(fila.iniciada_en, false) || !instante(fila.finalizada_en, false)) return false;
  const numeros = ["aceptados", "dispositivos", "envios", "errores", "expirados", "omitidos", "pendientes"];
  if (numeros.some((clave) => !entero(fila[clave]))) return false;
  if (fila.dispositivos > fila.envios) return false;
  return fila.aceptados + fila.errores + fila.expirados + fila.omitidos + fila.pendientes === fila.envios;
}

export function presentarCampanasNotificaciones(data, consulta) {
  if (!data || typeof data !== "object" || data.ok !== true) return { ok: false };
  if (tieneClaveProhibida(data) || !clavesExactas(data, CLAVES_LISTA)) return { ok: false };
  if (!entero(data.total) || data.limite !== LIMITE_CAMPANAS || data.offset !== consulta.offset) return { ok: false };
  if (!Array.isArray(data.filas) || data.filas.some((fila) => !campanaValida(fila))) return { ok: false };
  if (data.filas.length > LIMITE_CAMPANAS) return { ok: false };
  if (consulta.offset >= data.total && data.filas.length !== 0) return { ok: false };
  if (consulta.offset < data.total && data.filas.length !== Math.min(LIMITE_CAMPANAS, data.total - consulta.offset)) {
    return { ok: false };
  }
  return { ok: true, lista: data };
}

export function presentarDetalleCampana(data) {
  if (!data || typeof data !== "object" || data.ok !== true) return { ok: false };
  if (tieneClaveProhibida(data)) return { ok: false };
  const { ok, ...campana } = data;
  if (ok !== true || !campanaValida(campana)) return { ok: false };
  return { ok: true, campana };
}
