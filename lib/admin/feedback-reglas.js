/**
 * Consulta y forma pública del panel de feedback.
 * Puro: no habla con Supabase. Descarta correos completos, notas en el listado
 * y cualquier clave que no esté declarada.
 */

import { esUuid } from "./reglas.js";
import {
  clasificarErrorEnvioFeedback,
  IDS_CATEGORIA_FEEDBACK,
  IDS_ESTADO_FEEDBACK,
  IDS_PRIORIDAD_FEEDBACK,
  LIMITE_MENSAJE_FEEDBACK,
  LIMITE_NOTA_FEEDBACK,
  LIMITE_RESUMEN_FEEDBACK,
  MINIMO_MENSAJE_FEEDBACK,
  textoPlanoFeedback,
} from "../feedback/reglas.js";

export const RPC_LISTADO_FEEDBACK = "listar_feedback_admin";
export const RPC_DETALLE_FEEDBACK = "detalle_feedback_admin";
export const RPC_GESTION_FEEDBACK = "gestionar_feedback_admin";
export const TAMANO_PAGINA_FEEDBACK = 20;

export const FILTRO_CATEGORIAS_FEEDBACK = Object.freeze(["todos", ...IDS_CATEGORIA_FEEDBACK]);
export const FILTRO_ESTADOS_FEEDBACK = Object.freeze(["todos", ...IDS_ESTADO_FEEDBACK]);
export const FILTRO_PRIORIDADES_FEEDBACK = Object.freeze(["todos", ...IDS_PRIORIDAD_FEEDBACK]);

const MASCARA_CORREO = /^.\*\*\*@[^@\s]+$/u;
const CLAVES_LISTADO = Object.freeze(["contadores", "filas", "limite", "offset", "ok", "total"]);
const CLAVES_CONTADORES = Object.freeze(["en_revision", "nuevo", "resueltos"]);
const CLAVES_FILA = Object.freeze([
  "categoria",
  "correo",
  "creado_en",
  "estado",
  "id",
  "nombre",
  "nombre_usuario",
  "prioridad",
  "resumen",
]);
const CLAVES_DETALLE = Object.freeze([
  "actualizado_en",
  "categoria",
  "correo",
  "creado_en",
  "estado",
  "id",
  "mensaje",
  "nombre",
  "nombre_usuario",
  "nota_admin",
  "prioridad",
  "revisado_en",
]);
const CLAVES_GESTION = Object.freeze(["cambio", "ok"]);
const CLAVES_PROHIBIDAS = Object.freeze([
  "apellido",
  "chat",
  "email",
  "foto",
  "genetica",
  "html",
  "observacion",
  "prompt",
  "telefono",
  "usuario_id",
]);

const MENSAJE_MIGRACION =
  "Feedback todavía no está operativo: falta aplicar supabase/feedback-usuarios.sql. Hasta entonces no se muestra la bandeja.";
const MENSAJE_ERROR = "No pudimos leer el feedback. No se muestran datos parciales.";
const MENSAJE_FILTRO = "El filtro de categoría, estado o prioridad no es válido.";
const MENSAJE_PAGINA = "La página no es válida.";
const MENSAJE_GESTION = "No se pudieron guardar los cambios. Los datos del formulario siguen acá.";
const MENSAJE_PERMISO = "No tenés permiso para gestionar feedback.";
const MENSAJE_PERMISO_BASE = "La base rechazó el permiso de esta operación. Los datos del formulario siguen acá.";

export function mensajeFeedback(estado) {
  if (estado === "migracion") return MENSAJE_MIGRACION;
  if (estado === "error") return MENSAJE_ERROR;
  if (estado === "permiso") return MENSAJE_PERMISO_BASE;
  if (estado === "consulta") return MENSAJE_FILTRO;
  if (estado === "denegado") return MENSAJE_PERMISO;
  return "";
}

export function clasificarErrorFeedback(error) {
  return clasificarErrorEnvioFeedback(error);
}

export function codigoFeedbackConocido(data) {
  if (!data || typeof data !== "object" || data.ok !== false) return "";
  if (data.codigo === "consulta_invalida" || data.codigo === "no_encontrado") return data.codigo;
  return "desconocido";
}

export function mensajeCodigoFeedback(codigo) {
  if (codigo === "consulta_invalida") return MENSAJE_FILTRO;
  if (codigo === "no_encontrado") return "";
  return MENSAJE_ERROR;
}

export function mensajeGestionFeedback(codigo) {
  if (codigo === "denegado") return MENSAJE_PERMISO;
  if (codigo === "permiso") return MENSAJE_PERMISO_BASE;
  if (codigo === "migracion") return MENSAJE_MIGRACION;
  if (codigo === "consulta") return MENSAJE_FILTRO;
  return MENSAJE_GESTION;
}

function falloConsulta(error) {
  return { ok: false, error };
}

function textoCorto(valor, maximo = 40) {
  if (valor === undefined || valor === null || valor === "") return "";
  if (typeof valor === "string") return valor.length <= maximo ? valor : null;
  if (Array.isArray(valor) && valor.length === 1 && typeof valor[0] === "string" && valor[0].length <= maximo) {
    return valor[0];
  }
  return null;
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
  if (typeof valor !== "string" || !textoPlanoFeedback(valor, maximo)) return undefined;
  return valor;
}

function correoEnmascarado(valor) {
  if (valor === null) return null;
  if (typeof valor !== "string" || !MASCARA_CORREO.test(valor) || valor.includes("\0")) return undefined;
  return valor;
}

function resolverPagina(valor) {
  if (valor === "") return { ok: true, pagina: 1, offset: 0 };
  if (valor === null || !/^\d{1,6}$/.test(valor)) return falloConsulta(MENSAJE_PAGINA);
  const pagina = Number(valor);
  const offset = (pagina - 1) * TAMANO_PAGINA_FEEDBACK;
  if (!Number.isInteger(pagina) || pagina < 1 || offset > 100_000) return falloConsulta(MENSAJE_PAGINA);
  return { ok: true, pagina, offset };
}

export function interpretarConsultaFeedback(parametros) {
  const fuente = parametros && typeof parametros === "object" ? parametros : {};
  const bruto = {
    categoria: textoCorto(fuente.categoria),
    estado: textoCorto(fuente.estado),
    prioridad: textoCorto(fuente.prioridad),
    pagina: textoCorto(fuente.pagina),
  };
  if (Object.values(bruto).some((valor) => valor === null)) return falloConsulta(MENSAJE_FILTRO);
  const categoria = bruto.categoria === "" ? "todos" : bruto.categoria;
  const estado = bruto.estado === "" ? "todos" : bruto.estado;
  const prioridad = bruto.prioridad === "" ? "todos" : bruto.prioridad;
  if (!FILTRO_CATEGORIAS_FEEDBACK.includes(categoria)) return falloConsulta(MENSAJE_FILTRO);
  if (!FILTRO_ESTADOS_FEEDBACK.includes(estado)) return falloConsulta(MENSAJE_FILTRO);
  if (!FILTRO_PRIORIDADES_FEEDBACK.includes(prioridad)) return falloConsulta(MENSAJE_FILTRO);
  const pagina = resolverPagina(bruto.pagina);
  if (!pagina.ok) return pagina;
  return {
    ok: true,
    consulta: {
      categoria,
      estado,
      prioridad,
      pagina: pagina.pagina,
      offset: pagina.offset,
    },
  };
}

export function prepararConsultaFeedback(parametros) {
  const interpretado = interpretarConsultaFeedback(parametros);
  const consulta = interpretado.ok ? interpretado.consulta : interpretarConsultaFeedback({}).consulta;
  return { interpretado, consulta };
}

export function parametrosConsultaFeedback(consulta, pagina = consulta.pagina) {
  const params = new URLSearchParams();
  if (consulta.categoria !== "todos") params.set("categoria", consulta.categoria);
  if (consulta.estado !== "todos") params.set("estado", consulta.estado);
  if (consulta.prioridad !== "todos") params.set("prioridad", consulta.prioridad);
  if (pagina > 1) params.set("pagina", String(pagina));
  return params.toString();
}

export function enlaceFeedback(consulta, pagina = consulta.pagina) {
  const texto = parametrosConsultaFeedback(consulta, pagina);
  return texto ? `/admin/feedback?${texto}` : "/admin/feedback";
}

export function enlaceDetalleFeedback(consulta, id) {
  const texto = parametrosConsultaFeedback(consulta);
  return texto ? `/admin/feedback/${id}?${texto}` : `/admin/feedback/${id}`;
}

export function argumentosListadoFeedback(adminId, consulta) {
  return {
    p_admin: adminId,
    p_categoria: consulta.categoria,
    p_estado: consulta.estado,
    p_limite: TAMANO_PAGINA_FEEDBACK,
    p_offset: consulta.offset,
    p_prioridad: consulta.prioridad,
  };
}

export function argumentosDetalleFeedback(adminId, id) {
  return { p_admin: adminId, p_id: id };
}

export function argumentosGestionFeedback(adminId, gestion) {
  return {
    p_admin: adminId,
    p_estado: gestion.estado,
    p_id: gestion.id,
    p_nota: gestion.nota,
    p_prioridad: gestion.prioridad,
  };
}

export function validarGestionFeedback(entrada) {
  const fuente = entrada && typeof entrada === "object" ? entrada : {};
  const id = typeof fuente.id === "string" ? fuente.id.trim().toLowerCase() : "";
  const estado = typeof fuente.estado === "string" ? fuente.estado : "";
  const prioridad = typeof fuente.prioridad === "string" ? fuente.prioridad : "";
  const nota = typeof fuente.nota === "string" ? fuente.nota.trim() : null;
  if (!esUuid(id) || !IDS_ESTADO_FEEDBACK.includes(estado) || !IDS_PRIORIDAD_FEEDBACK.includes(prioridad)) {
    return { ok: false, error: MENSAJE_FILTRO };
  }
  if (nota === null || !textoPlanoFeedback(nota, LIMITE_NOTA_FEEDBACK)) {
    return { ok: false, error: "La nota interna no es válida." };
  }
  return { ok: true, id, estado, prioridad, nota };
}

function filaFeedback(fila) {
  if (!clavesExactas(fila, CLAVES_FILA) || tieneClaveProhibida(fila) || !esUuid(fila.id)) return null;
  if (!IDS_CATEGORIA_FEEDBACK.includes(fila.categoria)) return null;
  if (!IDS_ESTADO_FEEDBACK.includes(fila.estado) || !IDS_PRIORIDAD_FEEDBACK.includes(fila.prioridad)) return null;
  const nombre = textoOpcional(fila.nombre, 200);
  const nombreUsuario = textoOpcional(fila.nombre_usuario, 80);
  const correo = correoEnmascarado(fila.correo);
  const creadoEn = instante(fila.creado_en);
  const resumen = textoOpcional(fila.resumen, LIMITE_RESUMEN_FEEDBACK + 1);
  if (nombre === undefined || nombreUsuario === undefined || correo === undefined || !creadoEn) return null;
  if (!resumen || resumen.length < MINIMO_MENSAJE_FEEDBACK) return null;
  return {
    id: fila.id.toLowerCase(),
    categoria: fila.categoria,
    resumen,
    creadoEn,
    estado: fila.estado,
    prioridad: fila.prioridad,
    nombre,
    nombreUsuario,
    correo,
  };
}

export function presentarListadoFeedback(data, consulta) {
  if (!clavesExactas(data, CLAVES_LISTADO) || data.ok !== true || tieneClaveProhibida(data)) return { ok: false };
  if (!clavesExactas(data.contadores, CLAVES_CONTADORES)) return { ok: false };
  if (!["nuevo", "en_revision", "resueltos"].every((clave) => entero(data.contadores[clave]))) return { ok: false };
  if (!Array.isArray(data.filas) || data.filas.length > TAMANO_PAGINA_FEEDBACK) return { ok: false };
  if (data.limite !== TAMANO_PAGINA_FEEDBACK || data.offset !== consulta.offset) return { ok: false };
  if (!entero(data.total) || data.filas.length > data.total) return { ok: false };
  const filas = [];
  for (const fila of data.filas) {
    const presentada = filaFeedback(fila);
    if (!presentada) return { ok: false };
    filas.push(presentada);
  }
  const paginas = data.total === 0 ? 1 : Math.ceil(data.total / TAMANO_PAGINA_FEEDBACK);
  return {
    ok: true,
    total: data.total,
    pagina: data.offset / TAMANO_PAGINA_FEEDBACK + 1,
    paginas,
    contadores: {
      nuevo: data.contadores.nuevo,
      enRevision: data.contadores.en_revision,
      resueltos: data.contadores.resueltos,
    },
    filas,
  };
}

export function presentarDetalleFeedback(data) {
  if (!data || typeof data !== "object" || data.ok !== true || !clavesExactas(data, ["feedback", "ok"])) return { ok: false };
  if (tieneClaveProhibida(data) || tieneClaveProhibida(data.feedback)) return { ok: false };
  const fila = data.feedback;
  if (!clavesExactas(fila, CLAVES_DETALLE) || !esUuid(fila.id)) return { ok: false };
  if (!IDS_CATEGORIA_FEEDBACK.includes(fila.categoria)) return { ok: false };
  if (!IDS_ESTADO_FEEDBACK.includes(fila.estado) || !IDS_PRIORIDAD_FEEDBACK.includes(fila.prioridad)) return { ok: false };
  const nombre = textoOpcional(fila.nombre, 200);
  const nombreUsuario = textoOpcional(fila.nombre_usuario, 80);
  const correo = correoEnmascarado(fila.correo);
  const creadoEn = instante(fila.creado_en);
  const actualizadoEn = instante(fila.actualizado_en);
  const revisadoEn = instante(fila.revisado_en);
  const nota = textoOpcional(fila.nota_admin, LIMITE_NOTA_FEEDBACK);
  if (typeof fila.mensaje !== "string" || !textoPlanoFeedback(fila.mensaje, LIMITE_MENSAJE_FEEDBACK)) return { ok: false };
  if (fila.mensaje.length < MINIMO_MENSAJE_FEEDBACK) return { ok: false };
  if ([nombre, nombreUsuario, correo, creadoEn, actualizadoEn, revisadoEn, nota].some((valor) => valor === undefined)) {
    return { ok: false };
  }
  if (!creadoEn || !actualizadoEn) return { ok: false };
  return {
    ok: true,
    feedback: {
      id: fila.id.toLowerCase(),
      categoria: fila.categoria,
      mensaje: fila.mensaje,
      creadoEn,
      actualizadoEn,
      estado: fila.estado,
      prioridad: fila.prioridad,
      nota,
      nombre,
      nombreUsuario,
      correo,
      revisadoEn,
    },
  };
}

export function presentarGestionFeedback(data) {
  if (!clavesExactas(data, CLAVES_GESTION) || data.ok !== true || tieneClaveProhibida(data)) return { ok: false };
  if (data.cambio !== true && data.cambio !== false) return { ok: false };
  return { ok: true, cambio: data.cambio };
}
