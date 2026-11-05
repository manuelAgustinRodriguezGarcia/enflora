/**
 * Consulta y forma pública de la auditoría administrativa.
 * Puro: no habla con Supabase y no escribe eventos.
 */

const ZONA = "America/Argentina/Buenos_Aires";
const DESPLAZAMIENTO = "-03:00";
const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAXIMO_DIAS = 366;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECURSO = /^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z0-9_-]{1,40}$/;
const CODIGO = /^[a-z_]{1,40}$/;
const MOTIVO = /^[a-z0-9_]{0,40}$/;

export const RPC_RESUMEN_AUDITORIA = "resumen_auditoria_admin";
export const RPC_DETALLE_AUDITORIA = "detalle_auditoria_admin";
export const LIMITE_AUDITORIA = 20;
export const PERIODOS_AUDITORIA = Object.freeze(["7", "30", "90", "personalizado"]);
export const RESULTADOS_AUDITORIA = Object.freeze(["exito", "rechazo", "error"]);

export const MODULOS_AUDITORIA = Object.freeze([
  Object.freeze({ id: "usuarios", etiqueta: "Usuarios" }),
  Object.freeze({ id: "partners", etiqueta: "Partners" }),
  Object.freeze({ id: "expo", etiqueta: "Expo Cannabis" }),
  Object.freeze({ id: "planes", etiqueta: "Planes" }),
  Object.freeze({ id: "flora_ia", etiqueta: "Flora IA" }),
  Object.freeze({ id: "almacenamiento", etiqueta: "Almacenamiento" }),
  Object.freeze({ id: "notificaciones", etiqueta: "Notificaciones" }),
  Object.freeze({ id: "feedback", etiqueta: "Feedback" }),
  Object.freeze({ id: "dashboard", etiqueta: "Dashboard" }),
  Object.freeze({ id: "auditoria", etiqueta: "Auditoría" }),
]);

export const ACCIONES_AUDITORIA = Object.freeze([
  Object.freeze({ id: "listado", etiqueta: "Consulta del listado" }),
  Object.freeze({ id: "detalle", etiqueta: "Apertura de ficha" }),
  Object.freeze({ id: "alta_comercio", etiqueta: "Alta de comercio" }),
  Object.freeze({ id: "edicion_comercio", etiqueta: "Edición de comercio" }),
  Object.freeze({ id: "estado_comercio", etiqueta: "Estado de comercio" }),
  Object.freeze({ id: "alta_campana", etiqueta: "Alta de campaña" }),
  Object.freeze({ id: "edicion_campana", etiqueta: "Edición de campaña" }),
  Object.freeze({ id: "estado_campana", etiqueta: "Estado de campaña" }),
  Object.freeze({ id: "estado_solicitud", etiqueta: "Estado de solicitud" }),
  Object.freeze({ id: "entrega", etiqueta: "Entrega de Expo" }),
  Object.freeze({ id: "inventario", etiqueta: "Inventario de Expo" }),
  Object.freeze({ id: "reinicio", etiqueta: "Reinicio de participantes" }),
  Object.freeze({ id: "alta_contacto", etiqueta: "Alta de contacto" }),
  Object.freeze({ id: "edicion_contacto", etiqueta: "Edición de contacto" }),
  Object.freeze({ id: "eliminacion_contacto", etiqueta: "Eliminación de contacto" }),
  Object.freeze({ id: "consentimiento", etiqueta: "Cambio de consentimiento" }),
  Object.freeze({ id: "exportacion", etiqueta: "Exportación de contactos" }),
]);

const CLAVES_FILA = Object.freeze([
  "id",
  "operacion_id",
  "administrador_id",
  "modulo",
  "accion",
  "recurso_tipo",
  "recurso_id",
  "resultado",
  "motivo",
  "creada_en",
  "cobertura",
]);
const PROHIBIDAS = new Set([
  "correo",
  "email",
  "mensaje",
  "nota",
  "nota_interna",
  "ip",
  "token",
  "payload",
  "telefono",
  "nombre",
  "password",
  "secreto",
  "antes",
  "despues",
]);
const MENSAJE_CONSULTA = "La consulta no es válida. No se muestran eventos.";
const MENSAJE_MIGRACION = "Falta aplicar supabase/admin-auditoria.sql. No se muestran eventos.";
const MENSAJE_ERROR = "No pudimos leer la auditoría. No se muestran eventos parciales.";

const IDS_MODULO = new Set(MODULOS_AUDITORIA.map((item) => item.id));
const IDS_ACCION = new Set(ACCIONES_AUDITORIA.map((item) => item.id));

function texto(valor, maximo = 80) {
  if (valor === undefined || valor === null || valor === "") return "";
  if (typeof valor === "string") return valor.length <= maximo ? valor : null;
  if (Array.isArray(valor) && valor.length === 1 && typeof valor[0] === "string" && valor[0].length <= maximo) return valor[0];
  return null;
}

function fallo(error) {
  return { ok: false, error };
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

export function etiquetaModulo(id) {
  return MODULOS_AUDITORIA.find((item) => item.id === id)?.etiqueta || id;
}

export function etiquetaAccion(id) {
  return ACCIONES_AUDITORIA.find((item) => item.id === id)?.etiqueta || id;
}

export function etiquetaCobertura(id) {
  if (id === "heredada") return "Registro del módulo";
  if (id === "central") return "Registro central";
  return id;
}

export function etiquetaResultado(id) {
  if (id === "exito") return "Éxito";
  if (id === "rechazo") return "Rechazo";
  if (id === "error") return "Error";
  return id;
}

export function interpretarAuditoria(parametros, ahora = new Date()) {
  const fuente = parametros && typeof parametros === "object" ? parametros : {};
  const periodo = texto(fuente.periodo) === "" ? "30" : texto(fuente.periodo);
  if (periodo === null || !PERIODOS_AUDITORIA.includes(periodo)) return fallo(MENSAJE_CONSULTA);
  const calculado = periodo === "personalizado"
    ? rango(texto(fuente.desde) || "", texto(fuente.hasta) || "")
    : rango(sumarDiasCalendario(diaArgentina(ahora), -(Number(periodo) - 1)), diaArgentina(ahora));
  if (!calculado) return fallo(MENSAJE_CONSULTA);

  const modulo = texto(fuente.modulo, 20);
  const accion = texto(fuente.accion, 40);
  const resultado = texto(fuente.resultado, 8);
  const administrador = texto(fuente.administrador, 36);
  const offsetTexto = texto(fuente.offset, 6);
  if (modulo === null || accion === null || resultado === null || administrador === null || offsetTexto === null) {
    return fallo(MENSAJE_CONSULTA);
  }
  if (modulo !== "" && !IDS_MODULO.has(modulo)) return fallo(MENSAJE_CONSULTA);
  if (accion !== "" && !IDS_ACCION.has(accion)) return fallo(MENSAJE_CONSULTA);
  if (resultado !== "" && !RESULTADOS_AUDITORIA.includes(resultado)) return fallo(MENSAJE_CONSULTA);
  if (administrador !== "" && !UUID.test(administrador)) return fallo(MENSAJE_CONSULTA);
  const offset = offsetTexto === "" ? 0 : Number(offsetTexto);
  if (!/^[0-9]{0,6}$/.test(offsetTexto) || !Number.isInteger(offset) || offset > 100000 || offset % LIMITE_AUDITORIA !== 0) {
    return fallo(MENSAJE_CONSULTA);
  }
  return {
    ok: true,
    consulta: {
      periodo,
      ...calculado,
      modulo,
      accion,
      resultado,
      administrador: administrador.toLowerCase(),
      offset,
    },
  };
}

export function argumentosResumenAuditoria(adminId, consulta) {
  return {
    p_accion: consulta.accion,
    p_admin: adminId,
    p_administrador: consulta.administrador,
    p_desde: consulta.desde,
    p_hasta: consulta.hasta,
    p_limite: LIMITE_AUDITORIA,
    p_modulo: consulta.modulo,
    p_offset: consulta.offset,
    p_resultado: consulta.resultado,
  };
}

export function argumentosDetalleAuditoria(adminId, id) {
  return { p_admin: adminId, p_id: id };
}

export function clasificarErrorAuditoria(error) {
  const codigo = String(error?.code || "");
  const mensaje = String(error?.message || "");
  if (codigo === "PGRST202" || /could not find the function|schema cache/i.test(mensaje)) return "migracion";
  return "error";
}

export function codigoAuditoriaConocido(data) {
  if (!data || typeof data !== "object" || data.ok !== false) return "";
  if (data.codigo === "consulta_invalida" || data.codigo === "no_encontrado") return data.codigo;
  return "desconocido";
}

export function mensajeAuditoria(estado) {
  if (estado === "migracion") return MENSAJE_MIGRACION;
  if (estado === "consulta") return MENSAJE_CONSULTA;
  return MENSAJE_ERROR;
}

function entero(valor) {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= 1_000_000_000;
}

function mismoInstante(valor, esperado) {
  const leido = Date.parse(valor);
  const base = Date.parse(esperado);
  return Number.isFinite(leido) && Number.isFinite(base) && leido === base;
}

function clavesLimpias(valor) {
  if (!valor || typeof valor !== "object") return false;
  return Object.keys(valor).every((clave) => !PROHIBIDAS.has(clave) && !clave.includes("@"));
}

function filaValida(fila) {
  if (!clavesLimpias(fila)) return false;
  if (CLAVES_FILA.some((clave) => !Object.hasOwn(fila, clave))) return false;
  if (!UUID.test(String(fila.id)) || !UUID.test(String(fila.operacion_id)) || !UUID.test(String(fila.administrador_id))) return false;
  if (!IDS_MODULO.has(fila.modulo) || !CODIGO.test(fila.accion) || !CODIGO.test(fila.recurso_tipo)) return false;
  if (typeof fila.recurso_id !== "string" || !RECURSO.test(fila.recurso_id) || fila.recurso_id.includes("@")) return false;
  if (!RESULTADOS_AUDITORIA.includes(fila.resultado) || typeof fila.motivo !== "string" || !MOTIVO.test(fila.motivo)) return false;
  if (fila.cobertura !== "heredada" && fila.cobertura !== "central") return false;
  if (!Number.isFinite(Date.parse(fila.creada_en))) return false;
  return true;
}

function suma(lista, clave) {
  return lista.reduce((total, item) => total + item[clave], 0);
}

export function presentarResumenAuditoria(data, consulta) {
  if (!data || data.ok !== true || !clavesLimpias(data)) return { ok: false };
  if (!mismoInstante(data.desde, consulta.desde) || !mismoInstante(data.hasta, consulta.hasta)) return { ok: false };
  if (!Number.isFinite(Date.parse(data.medido_en))) return { ok: false };
  const numeros = ["total_registrado", "total", "exitos", "rechazos", "errores", "heredados", "centrales", "limite", "offset"];
  if (numeros.some((clave) => !entero(data[clave]))) return { ok: false };
  if (data.limite !== LIMITE_AUDITORIA || data.offset !== consulta.offset) return { ok: false };
  if (data.exitos + data.rechazos + data.errores !== data.total) return { ok: false };
  if (data.heredados + data.centrales !== data.total) return { ok: false };
  if (data.total_registrado < data.total) return { ok: false };
  if (!Array.isArray(data.por_modulo) || !Array.isArray(data.por_accion) || !Array.isArray(data.administradores) || !Array.isArray(data.filas)) {
    return { ok: false };
  }
  if (data.administradores.length > 50 || data.filas.length > LIMITE_AUDITORIA) return { ok: false };
  if (data.offset >= data.total ? data.filas.length !== 0 : data.filas.length > data.total - data.offset) return { ok: false };
  if (!data.por_modulo.every((item) => item && IDS_MODULO.has(item.modulo) && entero(item.total) && clavesLimpias(item))) return { ok: false };
  if (!data.por_accion.every((item) => item && CODIGO.test(item.accion) && entero(item.total) && clavesLimpias(item))) return { ok: false };
  if (suma(data.por_modulo, "total") !== data.total || suma(data.por_accion, "total") !== data.total) return { ok: false };
  if (!data.administradores.every((id) => UUID.test(String(id)))) return { ok: false };
  if (!data.filas.every(filaValida)) return { ok: false };
  return {
    ok: true,
    resumen: {
      totalRegistrado: data.total_registrado,
      total: data.total,
      exitos: data.exitos,
      rechazos: data.rechazos,
      errores: data.errores,
      heredados: data.heredados,
      centrales: data.centrales,
      porModulo: data.por_modulo.map((item) => ({ modulo: item.modulo, etiqueta: etiquetaModulo(item.modulo), total: item.total })),
      porAccion: data.por_accion.map((item) => ({ accion: item.accion, etiqueta: etiquetaAccion(item.accion), total: item.total })),
      administradores: data.administradores.map((id) => String(id)),
      filas: data.filas.map(presentarFila),
      limite: data.limite,
      offset: data.offset,
    },
  };
}

function presentarFila(fila) {
  return {
    id: String(fila.id),
    operacionId: String(fila.operacion_id),
    administradorId: String(fila.administrador_id),
    modulo: fila.modulo,
    moduloEtiqueta: etiquetaModulo(fila.modulo),
    accion: fila.accion,
    accionEtiqueta: etiquetaAccion(fila.accion),
    recursoTipo: fila.recurso_tipo,
    recursoId: fila.recurso_id,
    resultado: fila.resultado,
    resultadoEtiqueta: etiquetaResultado(fila.resultado),
    motivo: fila.motivo,
    creadaEn: fila.creada_en,
    cobertura: fila.cobertura,
    coberturaEtiqueta: etiquetaCobertura(fila.cobertura),
  };
}

export function presentarDetalleAuditoria(data) {
  if (!data || data.ok !== true || !clavesLimpias(data) || !filaValida(data.evento)) return { ok: false };
  return { ok: true, evento: presentarFila(data.evento) };
}

export function enlaceAuditoria(consulta, cambios = {}) {
  const estado = { ...consulta, ...cambios };
  const parametros = new URLSearchParams();
  parametros.set("periodo", estado.periodo);
  if (estado.periodo === "personalizado") {
    parametros.set("desde", estado.desdeDia);
    parametros.set("hasta", estado.hastaDia);
  }
  if (estado.modulo) parametros.set("modulo", estado.modulo);
  if (estado.accion) parametros.set("accion", estado.accion);
  if (estado.resultado) parametros.set("resultado", estado.resultado);
  if (estado.administrador) parametros.set("administrador", estado.administrador);
  if (estado.offset) parametros.set("offset", String(estado.offset));
  const consultaTexto = parametros.toString();
  return consultaTexto ? `/admin/auditoria?${consultaTexto}` : "/admin/auditoria";
}
