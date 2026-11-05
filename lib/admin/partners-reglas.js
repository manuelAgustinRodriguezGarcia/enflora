/**
 * Consulta, validación y forma pública del módulo de partners.
 * Puro: no habla con Supabase y no publica una campaña por sí solo.
 */

const ZONA = "America/Argentina/Buenos_Aires";
const DESPLAZAMIENTO = "-03:00";
const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAXIMO_DIAS = 366;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TEXTO = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}\n\r\t]*$/u;

export const RPC_RESUMEN_PARTNERS = "resumen_partners_admin";
export const RPC_LISTAR_COMERCIOS = "listar_comercios_partners_admin";
export const RPC_DETALLE_COMERCIO = "detalle_comercio_partners_admin";
export const RPC_ALTA_COMERCIO = "alta_comercio_partners_admin";
export const RPC_EDITAR_COMERCIO = "editar_comercio_partners_admin";
export const RPC_ESTADO_COMERCIO = "estado_comercio_partners_admin";
export const RPC_LISTAR_SOLICITUDES = "listar_solicitudes_partners_admin";
export const RPC_DETALLE_SOLICITUD = "detalle_solicitud_partners_admin";
export const RPC_GESTIONAR_SOLICITUD = "gestionar_solicitud_partners_admin";
export const RPC_LISTAR_CAMPANAS = "listar_campanas_partners_admin";
export const RPC_DETALLE_CAMPANA = "detalle_campana_partners_admin";
export const RPC_ALTA_CAMPANA = "alta_campana_partners_admin";
export const RPC_EDITAR_CAMPANA = "editar_campana_partners_admin";
export const RPC_ESTADO_CAMPANA = "estado_campana_partners_admin";

export const LIMITE_PARTNERS = 20;
export const PLANES_COMERCIO = Object.freeze(["presencia", "visibilidad", "inteligente"]);
export const ESTADOS_COMERCIO = Object.freeze(["todos", "pendiente", "aprobado", "rechazado", "activo", "inactivo"]);
export const ACCIONES_COMERCIO = Object.freeze(["aprobar", "rechazar", "activar", "desactivar"]);
export const ESTADOS_SOLICITUD = Object.freeze(["todos", "recibida", "en_revision", "aprobada", "rechazada", "cerrada"]);
export const ESTADOS_CAMPANA = Object.freeze(["borrador", "programada", "activa", "pausada", "finalizada"]);
export const ESTADOS_CAMPANA_FILTRO = Object.freeze(["todos", ...ESTADOS_CAMPANA]);
export const UBICACION_BANNER = "listado_cultivos";
export const PERIODOS_PARTNERS = Object.freeze(["7", "30", "90", "personalizado"]);

const TRANSICIONES = Object.freeze({
  borrador: Object.freeze(["programada", "activa"]),
  programada: Object.freeze(["borrador", "activa", "pausada", "finalizada"]),
  activa: Object.freeze(["pausada", "finalizada"]),
  pausada: Object.freeze(["activa", "finalizada"]),
  finalizada: Object.freeze([]),
});

const CLAVES_RESUMEN = Object.freeze([
  "activos",
  "aprobados",
  "campanas_activas",
  "campanas_borrador",
  "campanas_finalizadas",
  "campanas_pausadas",
  "campanas_programadas",
  "clics",
  "comercios",
  "desde",
  "hasta",
  "impresiones",
  "medido_en",
  "ok",
  "pendientes",
  "por_ubicacion",
  "publicidad_en_flora",
  "rechazados",
  "serie",
  "solicitudes",
  "solicitudes_recibidas",
]);

const MENSAJE_MIGRACION =
  "Partners todavía no está operativo en el panel: falta aplicar supabase/admin-partners.sql. Hasta entonces no se muestran cifras ni se guardan cambios.";
const MENSAJE_ERROR = "No pudimos completar la operación de partners. No se muestran datos parciales.";
const MENSAJE_CONSULTA = "Revisá los datos. Las direcciones nuevas tienen que empezar con https://.";

export function mensajePartners(estado) {
  if (estado === "migracion") return MENSAJE_MIGRACION;
  if (estado === "consulta" || estado === "incompleta" || estado === "transicion" || estado === "no_aprobado") return MENSAJE_CONSULTA;
  if (estado === "error") return MENSAJE_ERROR;
  return "";
}

export function clasificarErrorPartners(error) {
  const codigo = String(error?.code || "");
  const mensaje = String(error?.message || "");
  if (codigo === "PGRST202" || /could not find the function|schema cache/i.test(mensaje)) return "migracion";
  return "error";
}

export function codigoPartnersConocido(data) {
  if (!data || typeof data !== "object" || data.ok !== false) return "";
  if (["consulta_invalida", "no_encontrado", "no_aprobado", "incompleta", "transicion", "limite", "no_visible"].includes(data.codigo)) {
    return data.codigo;
  }
  return "desconocido";
}

export function urlPartners(valor, obligatoria = false) {
  const limpio = typeof valor === "string" ? valor.trim() : "";
  if (!limpio) return obligatoria ? null : "";
  if (limpio.length > 500 || !limpio.toLowerCase().startsWith("https://")) return null;
  if (limpio.includes("@") || limpio.includes("\\") || /\s/.test(limpio)) return null;
  try {
    const parsed = new URL(limpio);
    if (parsed.protocol !== "https:" || !parsed.hostname.includes(".")) return null;
  } catch {
    return null;
  }
  return limpio;
}

export function transicionCampanaPermitida(actual, siguiente) {
  return Array.isArray(TRANSICIONES[actual]) && TRANSICIONES[actual].includes(siguiente);
}

export function campanaPuedeActivarse({ plan, revision, pieza, enlace, fin, hoy }) {
  if (revision !== "aprobado" || !PLANES_COMERCIO.slice(1).includes(plan)) return false;
  if (!urlPartners(pieza, true) || !urlPartners(enlace, true)) return false;
  if (fin && fin < hoy) return false;
  return true;
}

export function tasaClics(impresiones, clics) {
  if (!impresiones) return null;
  return clics / impresiones;
}

function fallo(error) {
  return { ok: false, error };
}

function texto(valor, maximo = 80) {
  if (valor === undefined || valor === null || valor === "") return "";
  if (typeof valor === "string") return valor.length <= maximo ? valor : null;
  if (Array.isArray(valor) && valor.length === 1 && typeof valor[0] === "string" && valor[0].length <= maximo) return valor[0];
  return null;
}

function plano(valor, maximo) {
  const limpio = typeof valor === "string" ? valor.trim() : "";
  if (limpio.length > maximo || !TEXTO.test(limpio) || limpio.includes("\0")) return null;
  return limpio;
}

export function diaArgentina(fecha) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
}

export function sumarDiasCalendario(dia, cantidad) {
  const coincidencia = RE_DIA.exec(dia);
  if (!coincidencia) return null;
  const fecha = new Date(Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]) + cantidad));
  return fecha.toISOString().slice(0, 10);
}

function inicioDiaArgentina(dia) {
  if (!RE_DIA.test(dia)) return null;
  const fecha = new Date(`${dia}T00:00:00.000${DESPLAZAMIENTO}`);
  if (Number.isNaN(fecha.getTime()) || diaArgentina(fecha) !== dia) return null;
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

function rango(desdeDia, hastaDia) {
  const dias = listarDias(desdeDia, hastaDia);
  if (!dias) return null;
  const desde = inicioDiaArgentina(desdeDia);
  const hasta = inicioDiaArgentina(sumarDiasCalendario(hastaDia, 1));
  if (!desde || !hasta) return null;
  return { desdeDia, hastaDia, desde, hasta, dias };
}

export function interpretarPeriodoPartners(parametros, ahora = new Date()) {
  const fuente = parametros && typeof parametros === "object" ? parametros : {};
  const periodo = texto(fuente.periodo) === "" ? "30" : texto(fuente.periodo);
  if (periodo === null || !PERIODOS_PARTNERS.includes(periodo)) return fallo(MENSAJE_CONSULTA);
  if (periodo !== "personalizado") {
    const hoy = diaArgentina(ahora);
    const calculado = rango(sumarDiasCalendario(hoy, -(Number(periodo) - 1)), hoy);
    if (!calculado) return fallo(MENSAJE_CONSULTA);
    return { ok: true, consulta: { periodo, ...calculado } };
  }
  const desde = texto(fuente.desde);
  const hasta = texto(fuente.hasta);
  if (!RE_DIA.test(desde || "") || !RE_DIA.test(hasta || "")) return fallo(MENSAJE_CONSULTA);
  const calculado = rango(desde, hasta);
  if (!calculado) return fallo(MENSAJE_CONSULTA);
  return { ok: true, consulta: { periodo, ...calculado } };
}

function paginacion(fuente) {
  const estado = texto(fuente.estado);
  const offsetTexto = texto(fuente.offset);
  const busqueda = texto(fuente.q, 80);
  if (estado === null || busqueda === null || offsetTexto === null) return null;
  const offset = offsetTexto === "" ? 0 : Number(offsetTexto);
  if (!/^[0-9]{0,6}$/.test(offsetTexto) || !Number.isInteger(offset) || offset > 100000) return null;
  return { estado: estado === "" ? "todos" : estado, offset, busqueda };
}

export function interpretarComercios(parametros) {
  const pagina = paginacion(parametros || {});
  if (!pagina || !ESTADOS_COMERCIO.includes(pagina.estado)) return fallo(MENSAJE_CONSULTA);
  return { ok: true, consulta: pagina };
}

export function interpretarSolicitudes(parametros) {
  const pagina = paginacion(parametros || {});
  if (!pagina || !ESTADOS_SOLICITUD.includes(pagina.estado)) return fallo(MENSAJE_CONSULTA);
  return { ok: true, consulta: pagina };
}

export function interpretarCampanas(parametros) {
  const pagina = paginacion(parametros || {});
  if (!pagina || !ESTADOS_CAMPANA_FILTRO.includes(pagina.estado)) return fallo(MENSAJE_CONSULTA);
  return { ok: true, consulta: { estado: pagina.estado, offset: pagina.offset } };
}

export function preparar(interpretar, parametros, ahora) {
  const interpretado = interpretar(parametros, ahora);
  const consulta = interpretado.ok ? interpretado.consulta : interpretar({}, ahora).consulta;
  return { interpretado, consulta };
}

function comercioCampos(entrada) {
  const nombre = plano(entrada.nombre, 120);
  const rubro = plano(entrada.rubro, 80);
  const sitio = urlPartners(entrada.sitio || "");
  const logo = urlPartners(entrada.logo || "");
  const banner = urlPartners(entrada.banner || "");
  const enlace = urlPartners(entrada.enlace || "");
  const plan = entrada.plan;
  const inicio = typeof entrada.inicio === "string" ? entrada.inicio : "";
  const fin = typeof entrada.fin === "string" ? entrada.fin : "";
  if (nombre === null || nombre.length < 2 || rubro === null || sitio === null || logo === null || banner === null || enlace === null) {
    return fallo(MENSAJE_CONSULTA);
  }
  if (!PLANES_COMERCIO.includes(plan) || !RE_DIA.test(inicio) || (fin !== "" && !RE_DIA.test(fin)) || (fin && fin < inicio)) {
    return fallo(MENSAJE_CONSULTA);
  }
  return { ok: true, nombre, rubro, sitio, logo, banner, enlace, plan, inicio, fin };
}

export function validarAltaComercio(entrada) {
  return comercioCampos(entrada || {});
}

export function validarEdicionComercio(entrada) {
  if (!UUID.test(String(entrada?.id || ""))) return fallo(MENSAJE_CONSULTA);
  const campos = comercioCampos(entrada);
  if (!campos.ok) return campos;
  return { ...campos, id: entrada.id };
}

export function validarEstadoComercio(entrada) {
  if (!UUID.test(String(entrada?.id || "")) || !ACCIONES_COMERCIO.includes(entrada?.accion)) return fallo(MENSAJE_CONSULTA);
  return { ok: true, id: entrada.id, accion: entrada.accion };
}

export function validarCampana(entrada, edicion) {
  const nombre = plano(entrada?.nombre, 120);
  const pieza = urlPartners(entrada?.pieza || "");
  const enlace = urlPartners(entrada?.enlace || "");
  const inicio = typeof entrada?.inicio === "string" ? entrada.inicio : "";
  const fin = typeof entrada?.fin === "string" ? entrada.fin : "";
  const prioridad = Number(entrada?.prioridad);
  if (!UUID.test(String(entrada?.comercio || "")) || nombre === null || nombre.length < 2 || pieza === null || enlace === null) {
    return fallo(MENSAJE_CONSULTA);
  }
  if (entrada?.ubicacion !== UBICACION_BANNER || !RE_DIA.test(inicio) || (fin !== "" && !RE_DIA.test(fin)) || (fin && fin < inicio)) {
    return fallo(MENSAJE_CONSULTA);
  }
  if (!Number.isInteger(prioridad) || prioridad < 0 || prioridad > 100) return fallo(MENSAJE_CONSULTA);
  if (edicion && !UUID.test(String(entrada?.id || ""))) return fallo(MENSAJE_CONSULTA);
  return {
    ok: true,
    id: entrada?.id,
    comercio: entrada.comercio,
    nombre,
    pieza,
    enlace,
    ubicacion: UBICACION_BANNER,
    inicio,
    fin,
    prioridad,
  };
}

export function validarGestionSolicitud(entrada) {
  const nota = plano(entrada?.nota ?? "", 2000);
  const estado = entrada?.estado;
  if (!UUID.test(String(entrada?.id || "")) || nota === null || !ESTADOS_SOLICITUD.slice(1).includes(estado)) return fallo(MENSAJE_CONSULTA);
  return { ok: true, id: entrada.id, estado, nota };
}

export function argumentosResumenPartners(consulta) {
  return { p_desde: consulta.desde, p_hasta: consulta.hasta };
}

export function argumentosListarComercios(adminId, consulta) {
  return { p_admin: adminId, p_busqueda: consulta.busqueda, p_estado: consulta.estado, p_limite: LIMITE_PARTNERS, p_offset: consulta.offset };
}

export function argumentosDetalle(adminId, id) {
  return { p_admin: adminId, p_id: id };
}

export function argumentosAltaComercio(adminId, comercio) {
  return {
    p_admin: adminId,
    p_nombre: comercio.nombre,
    p_rubro: comercio.rubro,
    p_sitio: comercio.sitio,
    p_plan: comercio.plan,
    p_inicio: comercio.inicio,
    p_fin: comercio.fin,
    p_logo: comercio.logo,
    p_banner: comercio.banner,
    p_enlace: comercio.enlace,
  };
}

export function argumentosEditarComercio(adminId, comercio) {
  return { ...argumentosAltaComercio(adminId, comercio), p_id: comercio.id };
}

export function argumentosEstadoComercio(adminId, cambio) {
  return { p_admin: adminId, p_id: cambio.id, p_accion: cambio.accion };
}

export function argumentosListarSolicitudes(adminId, consulta) {
  return argumentosListarComercios(adminId, consulta);
}

export function argumentosGestionSolicitud(adminId, gestion) {
  return { p_admin: adminId, p_id: gestion.id, p_estado: gestion.estado, p_nota: gestion.nota };
}

export function argumentosListarCampanas(adminId, consulta) {
  return { p_admin: adminId, p_estado: consulta.estado, p_limite: LIMITE_PARTNERS, p_offset: consulta.offset };
}

export function argumentosAltaCampana(adminId, campana) {
  return {
    p_admin: adminId,
    p_comercio: campana.comercio,
    p_nombre: campana.nombre,
    p_pieza: campana.pieza,
    p_ubicacion: campana.ubicacion,
    p_enlace: campana.enlace,
    p_inicio: campana.inicio,
    p_fin: campana.fin,
    p_prioridad: campana.prioridad,
  };
}

export function argumentosEditarCampana(adminId, campana) {
  return { ...argumentosAltaCampana(adminId, campana), p_id: campana.id };
}

export function argumentosEstadoCampana(adminId, cambio) {
  return { p_admin: adminId, p_id: cambio.id, p_estado: cambio.estado };
}

function clavesExactas(dato, claves) {
  if (!dato || typeof dato !== "object" || Array.isArray(dato)) return false;
  const presentes = Object.keys(dato);
  return presentes.length === claves.length && claves.every((clave) => Object.hasOwn(dato, clave));
}

function entero(valor) {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= Number.MAX_SAFE_INTEGER;
}

function mismoInstante(valor, esperado) {
  const leido = Date.parse(valor);
  const pedido = Date.parse(esperado);
  return Number.isFinite(leido) && leido === pedido;
}

function prohibido(valor) {
  if (!valor || typeof valor !== "object") return false;
  if (Array.isArray(valor)) return valor.some((item) => prohibido(item));
  return Object.keys(valor).some((clave) => ["endpoint", "usuario_id", "ip", "nota_interna", "mensaje", "correo"].includes(clave) || prohibido(valor[clave]));
}

export function presentarResumenPartners(data, consulta) {
  if (!data || data.ok !== true || data.publicidad_en_flora !== false || prohibido(data) || !clavesExactas(data, CLAVES_RESUMEN)) return { ok: false };
  if (!mismoInstante(data.desde, consulta.desde) || !mismoInstante(data.hasta, consulta.hasta)) return { ok: false };
  const numeros = CLAVES_RESUMEN.filter((clave) => !["desde", "hasta", "medido_en", "ok", "por_ubicacion", "publicidad_en_flora", "serie"].includes(clave));
  if (numeros.some((clave) => !entero(data[clave]))) return { ok: false };
  if (data.aprobados + data.pendientes + data.rechazados !== data.comercios || data.activos > data.aprobados) return { ok: false };
  if (data.solicitudes_recibidas > data.solicitudes) return { ok: false };
  if (!Array.isArray(data.serie) || data.serie.length !== consulta.dias.length) return { ok: false };
  for (let i = 0; i < data.serie.length; i += 1) {
    const punto = data.serie[i];
    if (!punto || punto.dia !== consulta.dias[i] || !entero(punto.impresiones) || !entero(punto.clics)) return { ok: false };
  }
  const impresiones = data.serie.reduce((total, punto) => total + punto.impresiones, 0);
  const clics = data.serie.reduce((total, punto) => total + punto.clics, 0);
  if (impresiones !== data.impresiones || clics !== data.clics) return { ok: false };
  if (!Array.isArray(data.por_ubicacion) || data.por_ubicacion.length !== 1 || data.por_ubicacion[0].ubicacion !== UBICACION_BANNER) return { ok: false };
  return { ok: true, resumen: data };
}

function listaValida(data, consulta, filaValida) {
  if (!data || data.ok !== true || !entero(data.total) || data.limite !== LIMITE_PARTNERS || data.offset !== consulta.offset) return { ok: false };
  if (!Array.isArray(data.filas) || data.filas.some((fila) => !filaValida(fila))) return { ok: false };
  if (consulta.offset >= data.total && data.filas.length !== 0) return { ok: false };
  if (consulta.offset < data.total && data.filas.length !== Math.min(LIMITE_PARTNERS, data.total - consulta.offset)) return { ok: false };
  return { ok: true, lista: data };
}

function diaONulo(valor, obligatorio) {
  if (valor === null) return !obligatorio;
  return typeof valor === "string" && RE_DIA.test(valor.slice(0, 10));
}

export function presentarComercios(data, consulta) {
  return listaValida(data, consulta, (fila) => {
    return UUID.test(String(fila?.id || "")) && typeof fila.nombre === "string" && PLANES_COMERCIO.includes(fila.plan)
      && ["pendiente", "aprobado", "rechazado"].includes(fila.estado_revision)
      && typeof fila.activo === "boolean" && typeof fila.aprobado === "boolean"
      && diaONulo(fila.fecha_inicio, true) && diaONulo(fila.fecha_fin, false)
      && !prohibido(fila);
  });
}

export function presentarSolicitudes(data, consulta) {
  return listaValida(data, consulta, (fila) => UUID.test(String(fila?.id || "")) && typeof fila.correo === "string" && fila.correo.includes("@") && ESTADOS_SOLICITUD.slice(1).includes(fila.estado));
}

export function presentarCampanas(data, consulta) {
  return listaValida(data, consulta, (fila) => UUID.test(String(fila?.id || "")) && ESTADOS_CAMPANA.includes(fila.estado) && fila.ubicacion === UBICACION_BANNER && entero(fila.impresiones) && entero(fila.clics) && !("correo" in fila));
}

export function presentarAlta(data) {
  if (!data || data.ok !== true || !UUID.test(String(data.id || ""))) return { ok: false };
  if (Object.hasOwn(data, "estado") && data.estado !== "borrador") return { ok: false };
  return { ok: true, id: data.id, estado: data.estado || "" };
}
