import { LIMITE_NOTA_FEEDBACK, TEXTO_PLANO_FEEDBACK } from "../feedback/reglas.js";
import { esUuid } from "./reglas.js";

/**
 * Política de acceso a datos de cada módulo administrativo y validador de solicitudes HTTP.
 * Puro (sin I/O): lo usa el transporte de servicio.js y los tests.
 *
 * LÍMITE DE SEGURIDAD — leer antes de confiar en esto:
 *  - Esto es una barrera en JavaScript, dentro del mismo proceso. Reduce el daño de un uso
 *    incorrecto o de una consulta armada con datos del usuario, y cierra las elusiones conocidas
 *    del cliente PostgREST (mutar la URL, usar `fetch` interno, relaciones embebidas, cambiar
 *    de esquema, métodos o columnas no previstos). NO reemplaza los controles de base de datos.
 *  - El service role omite RLS: Postgres no puede restringirlo. Un control efectivo en la base
 *    exige un rol dedicado con permisos mínimos (o funciones SECURITY DEFINER por operación),
 *    lo que requiere una migración y queda como tarea pendiente (ver el documento del sprint).
 *  - Los controles que SÍ existen en la base y siguen vigentes: tablas con RLS y sin permisos
 *    para anon/authenticated, y RPC con `grant execute … to service_role` únicamente.
 *  - Código que ya tenga ejecución arbitraria en el servidor podría leer SUPABASE_SERVICE_ROLE_KEY
 *    de `process.env` directamente; esta política no lo impide.
 */

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;
const BUSQUEDA_USUARIOS = /^[\p{L}\p{N} @._+-]*$/u;
const MODELO_FLORA = /^[0-9A-Za-z._:+-]+$/;
const CLAVES_RESERVADAS = new Set(["select", "order", "limit", "offset", "or", "and"]);
const CLAVES_UNICAS = new Set(["select", "limit", "offset", "or", "and"]);
const OPERADOR = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd)\./;
const ORDEN = /^([a-z_][a-z0-9_]*)(\.(asc|desc))?(\.(nullsfirst|nullslast))?$/;
const ENTERO = /^\d{1,9}$/;
const ACCEPT_PERMITIDO = /^(application\/json|application\/vnd\.pgrst\.object\+json|\*\/\*)(\s*;.*)?$/i;
const MAXIMO_CUERPO = 20_000;
const MAXIMO_VALOR_PARAMETRO = 500;

const COLUMNAS_CONTACTOS = Object.freeze([
  "id",
  "nombre",
  "email",
  "telefono",
  "origen_inicial",
  "origenes",
  "consentimiento_marketing",
  "consentimiento_fecha",
  "consentimiento_version",
  "created_at",
  "updated_at",
]);

/**
 * Tablas y RPC que cada módulo puede tocar, con el detalle de lo permitido:
 *  - metodos: métodos HTTP de PostgREST (GET lee, PATCH actualiza, DELETE borra).
 *  - columnas: únicas columnas que se pueden pedir, filtrar u ordenar.
 *  - embebidos: relaciones que se pueden pedir dentro de `select` (con sus columnas).
 *  - columnasEscritura: columnas que PATCH puede modificar.
 *  - escrituraPorId: PATCH/DELETE exigen un único filtro `id=eq.<uuid>` (nunca masivos).
 * Un módulo nuevo no tiene acceso a datos hasta que se declare acá y se revise.
 */
export const ACCESO_DATOS_ADMIN = Object.freeze({
  expo: Object.freeze({
    tablas: Object.freeze({
      expo_inventario: Object.freeze({
        metodos: Object.freeze(["GET"]),
        columnas: Object.freeze(["slug", "nombre", "stock_total", "entregados", "reservados", "updated_at"]),
        embebidos: Object.freeze({}),
        columnasEscritura: Object.freeze([]),
        escrituraPorId: false,
      }),
      contactos_enflora: Object.freeze({
        metodos: Object.freeze(["GET", "PATCH", "DELETE"]),
        columnas: COLUMNAS_CONTACTOS,
        embebidos: Object.freeze({
          contactos_origenes: Object.freeze(["origen", "detalle", "veces", "primera_vez", "ultima_vez"]),
          contactos_consentimientos: Object.freeze(["acepta", "version", "origen", "registrado_en"]),
        }),
        columnasEscritura: Object.freeze(["nombre", "email", "telefono"]),
        escrituraPorId: true,
      }),
    }),
    rpcs: Object.freeze([
      "actualizar_consentimiento_contacto",
      "consentimiento_expo_auditado",
      "contacto_expo_auditado",
      "edicion_contacto_expo_auditada",
      "eliminacion_contacto_expo_auditada",
      "entrega_expo_auditada",
      "exportacion_expo_auditada",
      "guardar_inventario_expo",
      "inventario_expo_auditado",
      "registrar_contacto_enflora",
      "registrar_entrega_expo",
      "reiniciar_participantes_expo",
      "reinicio_expo_auditado",
      "resumen_contactos_enflora",
      "resumen_participantes_expo",
    ]),
  }),
  dashboard: Object.freeze({
    tablas: Object.freeze({}),
    rpcs: Object.freeze(["resumen_dashboard_admin"]),
    rpcSinArgumentos: Object.freeze(["resumen_dashboard_admin"]),
  }),
  planes: Object.freeze({
    tablas: Object.freeze({}),
    rpcs: Object.freeze([
      "resumen_planes_admin",
      "operaciones_planes_admin",
      "detalle_operacion_planes_admin",
      "suscripciones_planes_admin",
      "detalle_suscripcion_planes_admin",
      "licencias_planes_admin",
      "detalle_licencia_planes_admin",
    ]),
    rpcArgumentos: Object.freeze({
      resumen_planes_admin: Object.freeze(["p_ambiente", "p_desde", "p_hasta"]),
      operaciones_planes_admin: Object.freeze([
        "p_ambiente",
        "p_desde",
        "p_estado",
        "p_hasta",
        "p_limite",
        "p_offset",
        "p_producto",
      ]),
      detalle_operacion_planes_admin: Object.freeze(["p_id", "p_origen"]),
      suscripciones_planes_admin: Object.freeze(["p_ambiente", "p_estado", "p_limite", "p_offset"]),
      detalle_suscripcion_planes_admin: Object.freeze(["p_id"]),
      licencias_planes_admin: Object.freeze(["p_ambiente", "p_estado", "p_limite", "p_offset"]),
      detalle_licencia_planes_admin: Object.freeze(["p_id"]),
    }),
  }),
  usuarios: Object.freeze({
    tablas: Object.freeze({}),
    rpcs: Object.freeze(["detalle_usuario_admin", "listar_usuarios_admin"]),
    rpcArgumentos: Object.freeze({
      detalle_usuario_admin: Object.freeze(["p_admin", "p_id"]),
      listar_usuarios_admin: Object.freeze([
        "p_admin",
        "p_busqueda",
        "p_confirmacion",
        "p_desde",
        "p_hasta",
        "p_limite",
        "p_offset",
        "p_plan",
      ]),
    }),
    rpcTexto: Object.freeze({
      listar_usuarios_admin: Object.freeze({
        p_busqueda: Object.freeze({ maximo: 80, patron: BUSQUEDA_USUARIOS }),
      }),
    }),
  }),
  flora_ia: Object.freeze({
    tablas: Object.freeze({}),
    rpcs: Object.freeze(["resumen_flora_admin"]),
    rpcArgumentos: Object.freeze({
      resumen_flora_admin: Object.freeze(["p_desde", "p_hasta", "p_modelo", "p_operacion"]),
    }),
    rpcTexto: Object.freeze({
      resumen_flora_admin: Object.freeze({
        p_modelo: Object.freeze({ maximo: 64, patron: MODELO_FLORA }),
      }),
    }),
  }),
  almacenamiento: Object.freeze({
    tablas: Object.freeze({}),
    rpcs: Object.freeze(["resumen_almacenamiento_admin"]),
    rpcArgumentos: Object.freeze({
      resumen_almacenamiento_admin: Object.freeze(["p_desde", "p_hasta"]),
    }),
  }),
  notificaciones: Object.freeze({
    tablas: Object.freeze({}),
    rpcs: Object.freeze([
      "detalle_campana_notificaciones_admin",
      "listar_campanas_notificaciones_admin",
      "resumen_notificaciones_admin",
      "resumen_recordatorios_calendario_admin",
    ]),
    rpcSinArgumentos: Object.freeze(["resumen_recordatorios_calendario_admin"]),
    rpcArgumentos: Object.freeze({
      detalle_campana_notificaciones_admin: Object.freeze(["p_id"]),
      listar_campanas_notificaciones_admin: Object.freeze(["p_desde", "p_estado", "p_hasta", "p_limite", "p_offset"]),
      resumen_notificaciones_admin: Object.freeze(["p_desde", "p_hasta"]),
    }),
  }),
  partners: Object.freeze({
    tablas: Object.freeze({}),
    rpcs: Object.freeze([
      "alta_campana_partners_admin",
      "alta_comercio_partners_admin",
      "detalle_campana_partners_admin",
      "detalle_comercio_partners_admin",
      "detalle_solicitud_partners_admin",
      "editar_campana_partners_admin",
      "editar_comercio_partners_admin",
      "estado_campana_partners_admin",
      "estado_comercio_partners_admin",
      "gestionar_solicitud_partners_admin",
      "listar_campanas_partners_admin",
      "listar_comercios_partners_admin",
      "listar_solicitudes_partners_admin",
      "resumen_partners_admin",
    ]),
    rpcArgumentos: Object.freeze({
      alta_campana_partners_admin: Object.freeze(["p_admin", "p_comercio", "p_enlace", "p_fin", "p_inicio", "p_nombre", "p_pieza", "p_prioridad", "p_ubicacion"]),
      alta_comercio_partners_admin: Object.freeze(["p_admin", "p_banner", "p_enlace", "p_fin", "p_inicio", "p_logo", "p_nombre", "p_plan", "p_rubro", "p_sitio"]),
      detalle_campana_partners_admin: Object.freeze(["p_admin", "p_id"]),
      detalle_comercio_partners_admin: Object.freeze(["p_admin", "p_id"]),
      detalle_solicitud_partners_admin: Object.freeze(["p_admin", "p_id"]),
      editar_campana_partners_admin: Object.freeze(["p_admin", "p_comercio", "p_enlace", "p_fin", "p_id", "p_inicio", "p_nombre", "p_pieza", "p_prioridad", "p_ubicacion"]),
      editar_comercio_partners_admin: Object.freeze(["p_admin", "p_banner", "p_enlace", "p_fin", "p_id", "p_inicio", "p_logo", "p_nombre", "p_plan", "p_rubro", "p_sitio"]),
      estado_campana_partners_admin: Object.freeze(["p_admin", "p_estado", "p_id"]),
      estado_comercio_partners_admin: Object.freeze(["p_accion", "p_admin", "p_id"]),
      gestionar_solicitud_partners_admin: Object.freeze(["p_admin", "p_estado", "p_id", "p_nota"]),
      listar_campanas_partners_admin: Object.freeze(["p_admin", "p_estado", "p_limite", "p_offset"]),
      listar_comercios_partners_admin: Object.freeze(["p_admin", "p_busqueda", "p_estado", "p_limite", "p_offset"]),
      listar_solicitudes_partners_admin: Object.freeze(["p_admin", "p_busqueda", "p_estado", "p_limite", "p_offset"]),
      resumen_partners_admin: Object.freeze(["p_desde", "p_hasta"]),
    }),
    rpcTexto: Object.freeze({
      alta_campana_partners_admin: Object.freeze({
        p_enlace: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
        p_fin: Object.freeze({ maximo: 10, patron: /^$|^\d{4}-\d{2}-\d{2}$/ }),
        p_nombre: Object.freeze({ maximo: 120, patron: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}]+$/u }),
        p_pieza: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
      }),
      alta_comercio_partners_admin: Object.freeze({
        p_banner: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
        p_enlace: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
        p_fin: Object.freeze({ maximo: 10, patron: /^$|^\d{4}-\d{2}-\d{2}$/ }),
        p_logo: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
        p_nombre: Object.freeze({ maximo: 120, patron: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}]+$/u }),
        p_rubro: Object.freeze({ maximo: 80, patron: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}]*$/u }),
        p_sitio: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
      }),
      editar_campana_partners_admin: Object.freeze({
        p_enlace: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
        p_fin: Object.freeze({ maximo: 10, patron: /^$|^\d{4}-\d{2}-\d{2}$/ }),
        p_nombre: Object.freeze({ maximo: 120, patron: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}]+$/u }),
        p_pieza: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
      }),
      editar_comercio_partners_admin: Object.freeze({
        p_banner: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
        p_enlace: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
        p_fin: Object.freeze({ maximo: 10, patron: /^$|^\d{4}-\d{2}-\d{2}$/ }),
        p_logo: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
        p_nombre: Object.freeze({ maximo: 120, patron: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}]+$/u }),
        p_rubro: Object.freeze({ maximo: 80, patron: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}]*$/u }),
        p_sitio: Object.freeze({ maximo: 500, patron: /^$|^https:\/\/[^\s@\\]+$/ }),
      }),
      gestionar_solicitud_partners_admin: Object.freeze({
        p_nota: Object.freeze({ maximo: 2000, patron: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}\n\r\t]*$/u }),
      }),
      listar_comercios_partners_admin: Object.freeze({
        p_busqueda: Object.freeze({ maximo: 80, patron: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}]*$/u }),
      }),
      listar_solicitudes_partners_admin: Object.freeze({
        p_busqueda: Object.freeze({ maximo: 80, patron: /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Z}@.]*$/u }),
      }),
    }),
  }),
  feedback: Object.freeze({
    tablas: Object.freeze({}),
    rpcs: Object.freeze(["detalle_feedback_admin", "gestionar_feedback_admin", "listar_feedback_admin"]),
    rpcArgumentos: Object.freeze({
      detalle_feedback_admin: Object.freeze(["p_admin", "p_id"]),
      gestionar_feedback_admin: Object.freeze(["p_admin", "p_estado", "p_id", "p_nota", "p_prioridad"]),
      listar_feedback_admin: Object.freeze([
        "p_admin",
        "p_categoria",
        "p_estado",
        "p_limite",
        "p_offset",
        "p_prioridad",
      ]),
    }),
    rpcTexto: Object.freeze({
      gestionar_feedback_admin: Object.freeze({
        p_nota: Object.freeze({ maximo: LIMITE_NOTA_FEEDBACK, patron: TEXTO_PLANO_FEEDBACK }),
      }),
    }),
  }),
  auditoria: Object.freeze({
    tablas: Object.freeze({}),
    rpcs: Object.freeze(["detalle_auditoria_admin", "resumen_auditoria_admin"]),
    rpcArgumentos: Object.freeze({
      detalle_auditoria_admin: Object.freeze(["p_admin", "p_id"]),
      resumen_auditoria_admin: Object.freeze([
        "p_accion",
        "p_admin",
        "p_administrador",
        "p_desde",
        "p_hasta",
        "p_limite",
        "p_modulo",
        "p_offset",
        "p_resultado",
      ]),
    }),
    rpcTexto: Object.freeze({
      resumen_auditoria_admin: Object.freeze({
        p_accion: Object.freeze({ maximo: 40, patron: /^$|^[a-z_]{1,40}$/ }),
        p_administrador: Object.freeze({
          maximo: 36,
          patron: /^$|^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        }),
        p_modulo: Object.freeze({
          maximo: 20,
          patron: /^$|^(dashboard|usuarios|planes|flora_ia|almacenamiento|notificaciones|feedback|partners|expo|auditoria)$/,
        }),
        p_resultado: Object.freeze({ maximo: 8, patron: /^$|^(exito|rechazo|error)$/ }),
      }),
    }),
  }),
});

const OK = Object.freeze({ ok: true });
const NO = (motivo) => ({ ok: false, motivo });

function dividirNivelSuperior(texto) {
  const partes = [];
  let profundidad = 0;
  let actual = "";
  for (const caracter of texto) {
    if (caracter === "(") profundidad += 1;
    if (caracter === ")") profundidad -= 1;
    if (profundidad < 0) return null;
    if (caracter === "," && profundidad === 0) {
      partes.push(actual.trim());
      actual = "";
    } else {
      actual += caracter;
    }
  }
  if (profundidad !== 0) return null;
  partes.push(actual.trim());
  return partes;
}

/** `select` solo con columnas explícitas y relaciones embebidas declaradas (un nivel, con columnas permitidas). */
function validarSelect(texto, tabla) {
  if (typeof texto !== "string" || !texto.trim()) return NO("select_obligatorio");
  const partes = dividirNivelSuperior(texto);
  if (!partes) return NO("select_invalido");
  for (const parte of partes) {
    if (!parte.includes("(")) {
      if (!IDENTIFICADOR.test(parte) || !tabla.columnas.includes(parte)) return NO("columna_no_permitida");
      continue;
    }
    const coincidencia = /^(?:([a-z_][a-z0-9_]*):)?([a-z_][a-z0-9_]*)\(([^()]*)\)$/.exec(parte);
    if (!coincidencia) return NO("embebido_invalido");
    const columnasEmbebido = Object.hasOwn(tabla.embebidos, coincidencia[2]) ? tabla.embebidos[coincidencia[2]] : null;
    if (!columnasEmbebido) return NO("embebido_no_permitido");
    const internas = coincidencia[3].split(",").map((columna) => columna.trim());
    if (!internas.every((columna) => IDENTIFICADOR.test(columna) && columnasEmbebido.includes(columna))) {
      return NO("columna_embebida_no_permitida");
    }
  }
  return OK;
}

function validarOrden(texto, tabla) {
  if (typeof texto !== "string" || !texto) return NO("orden_invalido");
  for (const parte of texto.split(",")) {
    const coincidencia = ORDEN.exec(parte.trim());
    if (!coincidencia || !tabla.columnas.includes(coincidencia[1])) return NO("orden_no_permitido");
  }
  return OK;
}

/** `or=(col.op.valor,col.op.valor)`: solo columnas de la tabla, sin anidar. */
function validarCombinado(texto, tabla) {
  if (!/^\(.*\)$/s.test(texto)) return NO("filtro_combinado_invalido");
  const cuerpo = texto.slice(1, -1);
  if (cuerpo.includes("(") || cuerpo.includes(")")) return NO("filtro_combinado_invalido");
  for (const condicion of cuerpo.split(",")) {
    const coincidencia = /^([a-z_][a-z0-9_]*)\.(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd)\./.exec(condicion);
    if (!coincidencia || !tabla.columnas.includes(coincidencia[1])) return NO("filtro_combinado_no_permitido");
  }
  return OK;
}

function validarParametros(url, tabla, metodo) {
  for (const clave of new Set(url.searchParams.keys())) {
    const valores = url.searchParams.getAll(clave);
    if (CLAVES_UNICAS.has(clave) && valores.length > 1) return NO("parametro_repetido");
    if (valores.some((valor) => valor.length > MAXIMO_VALOR_PARAMETRO)) return NO("parametro_demasiado_largo");

    if (clave === "select") {
      const veredicto = validarSelect(valores[0], tabla);
      if (!veredicto.ok) return veredicto;
    } else if (clave === "order") {
      const veredicto = valores.length === 1 ? validarOrden(valores[0], tabla) : NO("parametro_repetido");
      if (!veredicto.ok) return veredicto;
    } else if (clave === "limit" || clave === "offset") {
      if (!ENTERO.test(valores[0])) return NO("paginacion_invalida");
    } else if (clave === "or" || clave === "and") {
      const veredicto = validarCombinado(valores[0], tabla);
      if (!veredicto.ok) return veredicto;
    } else {
      if (CLAVES_RESERVADAS.has(clave) || !tabla.columnas.includes(clave)) return NO("filtro_no_permitido");
      if (!valores.every((valor) => OPERADOR.test(valor))) return NO("operador_no_permitido");
    }
  }

  if (metodo === "GET" && !url.searchParams.has("select")) return NO("select_obligatorio");
  return OK;
}

function validarEscritura(metodo, url, cuerpo, tabla) {
  if (tabla.escrituraPorId) {
    const filtros = url.searchParams.getAll("id");
    if (filtros.length !== 1) return NO("escritura_sin_id");
    const coincidencia = /^eq\.(.+)$/.exec(filtros[0]);
    if (!coincidencia || !esUuid(coincidencia[1])) return NO("escritura_sin_id");
  }
  if (metodo !== "PATCH") return OK;

  let datos;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return NO("cuerpo_invalido");
  }
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return NO("cuerpo_invalido");
  const claves = Object.keys(datos);
  if (!claves.length || !claves.every((clave) => tabla.columnasEscritura.includes(clave))) {
    return NO("columna_escritura_no_permitida");
  }
  return OK;
}

const ARGUMENTO_TEXTO = /^[0-9A-Za-z:._+-]+$/;

/** Cuerpo JSON con exactamente las claves de la RPC. Sin objetos anidados ni texto libre. */
function validarArgumentosRpc(cuerpo, permitidas, textos) {
  let datos;
  try {
    datos = JSON.parse(cuerpo);
  } catch {
    return NO("cuerpo_invalido");
  }
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return NO("cuerpo_invalido");
  const claves = Object.keys(datos);
  if (claves.length !== permitidas.length || permitidas.some((clave) => !Object.hasOwn(datos, clave))) {
    return NO("argumentos_no_permitidos");
  }
  for (const clave of claves) {
    const valor = datos[clave];
    const texto = textos && Object.hasOwn(textos, clave) ? textos[clave] : null;
    if (texto) {
      if (typeof valor !== "string" || valor.length > texto.maximo || !texto.patron.test(valor)) {
        return NO("argumentos_no_permitidos");
      }
      continue;
    }
    if (typeof valor === "number") {
      if (!Number.isInteger(valor) || valor < 0 || valor > 100_000) return NO("argumentos_no_permitidos");
      continue;
    }
    if (typeof valor === "string" && valor.length > 0 && valor.length <= 40 && ARGUMENTO_TEXTO.test(valor)) continue;
    return NO("argumentos_no_permitidos");
  }
  return OK;
}

function validarCabeceras(cabeceras) {
  for (const nombre of ["accept-profile", "content-profile"]) {
    const valor = cabeceras.get(nombre);
    if (valor !== null && valor.trim().toLowerCase() !== "public") return NO("esquema_no_permitido");
  }
  const accept = cabeceras.get("accept");
  if (accept !== null && !ACCEPT_PERMITIDO.test(accept.trim())) return NO("formato_no_permitido");
  return OK;
}

/**
 * Valida una solicitud saliente hacia PostgREST contra la política de un módulo.
 *
 * @param {object} politica  Entrada de ACCESO_DATOS_ADMIN (p. ej. ACCESO_DATOS_ADMIN.expo).
 * @param {{ metodo: string, url: string, cabeceras: Headers, cuerpo: unknown }} solicitud
 * @param {{ origen: string, prefijo?: string }} destino  Origen configurado (host y protocolo).
 * @returns {{ ok: true } | { ok: false, motivo: string }}
 */
export function evaluarSolicitudAdmin(politica, solicitud, { origen, prefijo = "" }) {
  let url;
  try {
    url = new URL(String(solicitud.url));
  } catch {
    return NO("url_invalida");
  }
  if (url.origin !== origen || url.username || url.password) return NO("destino_no_permitido");

  const metodo = String(solicitud.metodo || "GET").toUpperCase();
  const ruta = url.pathname.startsWith(prefijo) ? url.pathname.slice(prefijo.length) : null;
  if (ruta === null) return NO("ruta_no_permitida");

  const cabeceras = validarCabeceras(solicitud.cabeceras);
  if (!cabeceras.ok) return cabeceras;

  const rpc = /^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)$/.exec(ruta);
  if (rpc) {
    if (!politica.rpcs.includes(rpc[1])) return NO("rpc_no_permitida");
    if (metodo !== "POST") return NO("metodo_no_permitido");
    if (typeof solicitud.cuerpo !== "string" || solicitud.cuerpo.length > MAXIMO_CUERPO) return NO("cuerpo_invalido");
    if (Array.isArray(politica.rpcSinArgumentos) && politica.rpcSinArgumentos.includes(rpc[1])) {
      if (solicitud.cuerpo.trim() !== "{}") return NO("argumentos_no_permitidos");
      return OK;
    }
    if (politica.rpcArgumentos) {
      const permitidas = Object.hasOwn(politica.rpcArgumentos, rpc[1]) ? politica.rpcArgumentos[rpc[1]] : null;
      if (!permitidas) return NO("argumentos_no_permitidos");
      const textos = politica.rpcTexto && Object.hasOwn(politica.rpcTexto, rpc[1]) ? politica.rpcTexto[rpc[1]] : null;
      return validarArgumentosRpc(solicitud.cuerpo, permitidas, textos);
    }
    return OK;
  }

  const coincidencia = /^\/rest\/v1\/([a-z_][a-z0-9_]*)$/.exec(ruta);
  if (!coincidencia || !Object.hasOwn(politica.tablas, coincidencia[1])) return NO("tabla_no_permitida");
  const tabla = politica.tablas[coincidencia[1]];
  if (!tabla.metodos.includes(metodo)) return NO("metodo_no_permitido");

  const tieneCuerpo = solicitud.cuerpo !== undefined && solicitud.cuerpo !== null;
  if (tieneCuerpo) {
    if (metodo !== "PATCH") return NO("cuerpo_invalido");
    if (typeof solicitud.cuerpo !== "string" || solicitud.cuerpo.length > MAXIMO_CUERPO) return NO("cuerpo_invalido");
  }

  const parametros = validarParametros(url, tabla, metodo);
  if (!parametros.ok) return parametros;

  if (metodo === "PATCH" || metodo === "DELETE") return validarEscritura(metodo, url, solicitud.cuerpo, tabla);
  return OK;
}
