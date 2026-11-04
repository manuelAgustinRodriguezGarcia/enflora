/**
 * Consulta y forma pública de Gestión de usuarios.
 * Puro: no habla con Supabase y no completa datos que la RPC no envió.
 *
 * El correo solo se acepta enmascarado. Una clave de más, un correo completo
 * o un dato de cultivo descarta la respuesta entera.
 */

import { esUuid } from "./reglas.js";

export const RPC_LISTADO_USUARIOS = "listar_usuarios_admin";
export const RPC_DETALLE_USUARIO = "detalle_usuario_admin";

export const TAMANO_PAGINA_USUARIOS = 25;
export const ZONA_USUARIOS = "America/Argentina/Buenos_Aires";
const DESPLAZAMIENTO = "-03:00";
const INICIO_HISTORICO = "2015-01-01";
const MAXIMO_DIAS = 366;
const MAXIMO_BUSQUEDA = 80;

export const PERIODOS_USUARIOS = Object.freeze(["todos", "7", "30", "90", "personalizado"]);
export const CONFIRMACIONES_USUARIOS = Object.freeze(["todos", "confirmado", "sin_confirmar"]);
export const PLANES_FILTRO_USUARIOS = Object.freeze(["todos", "gratuito", "plus", "licencia"]);
export const PLANES_USUARIOS = Object.freeze(["gratuito", "plus", "licencia", "plus_y_licencia"]);

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const BUSQUEDA = /^[\p{L}\p{N} @._+-]*$/u;
const MASCARA_CORREO = /^.\*\*\*@[^@\s]+$/u;
const CLAVES_PROHIBIDAS = Object.freeze([
  "apellido",
  "contenido",
  "email",
  "foto",
  "genetica",
  "mensaje",
  "observacion",
  "ruta",
  "telefono",
]);

const CLAVES_LISTADO = Object.freeze(["filas", "limite", "offset", "ok", "total"]);
const CLAVES_FILA = Object.freeze([
  "alta",
  "confirmado",
  "correo",
  "espacios",
  "id",
  "nombre",
  "nombre_usuario",
  "plan",
  "plantas",
  "registros",
  "ultima_actividad",
  "ultima_conexion",
  "unidades",
]);
const CLAVES_DETALLE = Object.freeze([
  ...CLAVES_FILA,
  "plantas_activas",
  "plantas_finalizadas",
  "registros_30",
]);

const MENSAJE_MIGRACION =
  "Gestión de usuarios todavía no está operativa: falta aplicar supabase/admin-usuarios.sql. Hasta entonces no se muestra el listado.";
const MENSAJE_ERROR = "No pudimos leer las cuentas. No se muestran datos parciales.";
const MENSAJE_PERIODO =
  "La fecha de alta no es válida. Usá todo el historial, 7, 30 o 90 días, o un rango de hasta 366 días.";
const MENSAJE_BUSQUEDA = "La búsqueda acepta hasta 80 letras, números, espacios y los signos @ . _ + -.";
const MENSAJE_FILTRO = "El filtro de confirmación o de plan no es válido.";
const MENSAJE_PAGINA = "La página no es válida.";

export function mensajeUsuarios(estado) {
  if (estado === "migracion") return MENSAJE_MIGRACION;
  if (estado === "error") return MENSAJE_ERROR;
  if (estado === "consulta") return MENSAJE_PERIODO;
  return "";
}

export function clasificarErrorUsuarios(error) {
  const codigo = String(error?.code || "");
  const mensaje = String(error?.message || "");
  if (codigo === "PGRST202" || /could not find the function|schema cache/i.test(mensaje)) return "migracion";
  return "error";
}

export function codigoUsuariosConocido(data) {
  if (!data || typeof data !== "object" || data.ok !== false) return "";
  if (data.codigo === "consulta_invalida" || data.codigo === "no_encontrada") return data.codigo;
  return "desconocido";
}

export function mensajeCodigoUsuarios(codigo) {
  if (codigo === "consulta_invalida") return MENSAJE_PERIODO;
  return MENSAJE_ERROR;
}

function falloConsulta(error) {
  return { ok: false, error };
}

function textoCorto(valor) {
  if (valor === undefined || valor === null || valor === "") return "";
  if (typeof valor === "string") return valor.length <= 40 ? valor : null;
  if (Array.isArray(valor) && valor.length === 1 && typeof valor[0] === "string" && valor[0].length <= 40) return valor[0];
  return null;
}

function textoBusqueda(valor) {
  if (valor === undefined || valor === null || valor === "") return "";
  const bruto = typeof valor === "string" ? valor : Array.isArray(valor) && valor.length === 1 ? valor[0] : null;
  if (bruto === null) return null;
  const texto = bruto.trim();
  if (texto.length > MAXIMO_BUSQUEDA || !BUSQUEDA.test(texto)) return null;
  return texto;
}

export function diaArgentina(fecha) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_USUARIOS,
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
  return { desdeDia, hastaDia, desde, hasta };
}

function resolverPeriodo(bruto, ahora) {
  const periodo = bruto.periodo === "" ? "todos" : bruto.periodo;
  if (periodo === null || !PERIODOS_USUARIOS.includes(periodo)) return falloConsulta(MENSAJE_PERIODO);
  if (periodo === "todos") {
    const hoy = diaArgentina(ahora);
    const hastaDia = sumarDiasCalendario(hoy, 1);
    const desde = inicioDiaArgentina(INICIO_HISTORICO);
    const hasta = inicioDiaArgentina(hastaDia);
    if (!desde || !hasta) return falloConsulta(MENSAJE_PERIODO);
    return { ok: true, periodo, desdeDia: INICIO_HISTORICO, hastaDia: hoy, desde, hasta };
  }
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

function resolverLista(valor, permitidos, mensaje) {
  if (valor === "") return { ok: true, valor: "todos" };
  if (valor === null || !permitidos.includes(valor)) return falloConsulta(mensaje);
  return { ok: true, valor };
}

function resolverPagina(valor) {
  if (valor === "") return { ok: true, pagina: 1, offset: 0 };
  if (valor === null || !/^\d{1,5}$/.test(valor)) return falloConsulta(MENSAJE_PAGINA);
  const pagina = Number(valor);
  const offset = (pagina - 1) * TAMANO_PAGINA_USUARIOS;
  if (!Number.isInteger(pagina) || pagina < 1 || offset > 100_000) return falloConsulta(MENSAJE_PAGINA);
  return { ok: true, pagina, offset };
}

export function interpretarConsultaUsuarios(parametros, ahora = new Date()) {
  const fuente = parametros && typeof parametros === "object" ? parametros : {};
  const bruto = {
    periodo: textoCorto(fuente.periodo),
    desde: textoCorto(fuente.desde),
    hasta: textoCorto(fuente.hasta),
    confirmacion: textoCorto(fuente.confirmacion),
    plan: textoCorto(fuente.plan),
    pagina: textoCorto(fuente.pagina),
  };
  const busqueda = textoBusqueda(fuente.q);
  if (busqueda === null) return falloConsulta(MENSAJE_BUSQUEDA);
  if (Object.values(bruto).some((valor) => valor === null)) return falloConsulta(MENSAJE_PERIODO);

  const periodo = resolverPeriodo(bruto, ahora);
  const confirmacion = resolverLista(bruto.confirmacion, CONFIRMACIONES_USUARIOS, MENSAJE_FILTRO);
  const plan = resolverLista(bruto.plan, PLANES_FILTRO_USUARIOS, MENSAJE_FILTRO);
  const pagina = resolverPagina(bruto.pagina);
  const primero = [periodo, confirmacion, plan, pagina].find((item) => !item.ok);
  if (primero) return primero;

  return {
    ok: true,
    consulta: {
      periodo: periodo.periodo,
      desdeDia: periodo.desdeDia,
      hastaDia: periodo.hastaDia,
      desde: periodo.desde,
      hasta: periodo.hasta,
      confirmacion: confirmacion.valor,
      plan: plan.valor,
      busqueda,
      pagina: pagina.pagina,
      offset: pagina.offset,
    },
  };
}

export function prepararConsultaUsuarios(parametros, ahora = new Date()) {
  const interpretado = interpretarConsultaUsuarios(parametros, ahora);
  const consulta = interpretado.ok ? interpretado.consulta : interpretarConsultaUsuarios({}, ahora).consulta;
  return { interpretado, consulta };
}

export function parametrosConsultaUsuarios(consulta, pagina = consulta.pagina) {
  const params = new URLSearchParams();
  if (consulta.periodo !== "todos") params.set("periodo", consulta.periodo);
  if (consulta.periodo === "personalizado") {
    params.set("desde", consulta.desdeDia);
    params.set("hasta", consulta.hastaDia);
  }
  if (consulta.confirmacion !== "todos") params.set("confirmacion", consulta.confirmacion);
  if (consulta.plan !== "todos") params.set("plan", consulta.plan);
  if (consulta.busqueda) params.set("q", consulta.busqueda);
  if (pagina > 1) params.set("pagina", String(pagina));
  return params.toString();
}

export function enlaceUsuarios(consulta, pagina = consulta.pagina) {
  const texto = parametrosConsultaUsuarios(consulta, pagina);
  return texto ? `/admin/usuarios?${texto}` : "/admin/usuarios";
}

export function enlaceDetalleUsuario(consulta, id) {
  const texto = parametrosConsultaUsuarios(consulta);
  return texto ? `/admin/usuarios/${id}?${texto}` : `/admin/usuarios/${id}`;
}

export function argumentosListadoUsuarios(adminId, consulta) {
  return {
    p_admin: adminId,
    p_busqueda: consulta.busqueda,
    p_confirmacion: consulta.confirmacion,
    p_desde: consulta.desde,
    p_hasta: consulta.hasta,
    p_limite: TAMANO_PAGINA_USUARIOS,
    p_offset: consulta.offset,
    p_plan: consulta.plan,
  };
}

export function argumentosDetalleUsuario(adminId, id) {
  return { p_admin: adminId, p_id: id };
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

function instante(valor) {
  if (valor === null) return null;
  if (typeof valor !== "string" || valor.length < 20 || valor.length > 40) return undefined;
  const ms = Date.parse(valor);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString();
}

function textoOpcional(valor, maximo) {
  if (valor === null) return null;
  if (typeof valor !== "string" || valor.length > maximo) return undefined;
  return valor;
}

function correoEnmascarado(valor) {
  if (valor === null) return null;
  if (typeof valor !== "string" || !MASCARA_CORREO.test(valor)) return undefined;
  return valor;
}

function filaUsuarios(fila, detalle) {
  const claves = detalle ? CLAVES_DETALLE : CLAVES_FILA;
  if (!clavesExactas(fila, claves) || tieneClaveProhibida(fila) || !esUuid(fila.id)) return null;
  const nombre = textoOpcional(fila.nombre, 200);
  const nombreUsuario = textoOpcional(fila.nombre_usuario, 80);
  const correo = correoEnmascarado(fila.correo);
  const alta = instante(fila.alta);
  const ultimaConexion = instante(fila.ultima_conexion);
  const ultimaActividad = instante(fila.ultima_actividad);
  if (nombre === undefined || nombreUsuario === undefined || correo === undefined) return null;
  if (alta === undefined || ultimaConexion === undefined || ultimaActividad === undefined) return null;
  if (typeof fila.confirmado !== "boolean" || !PLANES_USUARIOS.includes(fila.plan)) return null;
  if (![fila.espacios, fila.unidades, fila.plantas, fila.registros].every(entero)) return null;
  const base = {
    id: fila.id.toLowerCase(),
    nombre,
    nombreUsuario,
    correo,
    alta,
    ultimaConexion,
    confirmado: fila.confirmado,
    plan: fila.plan,
    espacios: fila.espacios,
    unidades: fila.unidades,
    plantas: fila.plantas,
    registros: fila.registros,
    ultimaActividad,
  };
  if (!detalle) return base;
  if (![fila.plantas_activas, fila.plantas_finalizadas, fila.registros_30].every(entero)) return null;
  return {
    ...base,
    plantasActivas: fila.plantas_activas,
    plantasFinalizadas: fila.plantas_finalizadas,
    registros30: fila.registros_30,
  };
}

export function presentarListadoUsuarios(data, consulta) {
  if (!clavesExactas(data, CLAVES_LISTADO) || data.ok !== true || tieneClaveProhibida(data)) return { ok: false };
  if (!Array.isArray(data.filas) || data.filas.length > TAMANO_PAGINA_USUARIOS) return { ok: false };
  if (data.limite !== TAMANO_PAGINA_USUARIOS || data.offset !== consulta.offset) return { ok: false };
  if (!entero(data.total) || data.filas.length > data.total) return { ok: false };
  const filas = [];
  for (const fila of data.filas) {
    const presentada = filaUsuarios(fila, false);
    if (!presentada) return { ok: false };
    filas.push(presentada);
  }
  const paginas = data.total === 0 ? 1 : Math.ceil(data.total / TAMANO_PAGINA_USUARIOS);
  return {
    ok: true,
    total: data.total,
    pagina: data.offset / TAMANO_PAGINA_USUARIOS + 1,
    paginas,
    filas,
  };
}

export function presentarDetalleUsuario(data) {
  if (!data || typeof data !== "object" || data.ok !== true || !clavesExactas(data, ["ok", "usuario"])) return { ok: false };
  if (tieneClaveProhibida(data)) return { ok: false };
  const usuario = filaUsuarios(data.usuario, true);
  if (!usuario) return { ok: false };
  return { ok: true, usuario };
}
