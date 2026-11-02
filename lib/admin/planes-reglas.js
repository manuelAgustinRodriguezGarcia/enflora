/**
 * Consulta, forma pública y mensajes de Planes e ingresos.
 * Puro: no habla con Supabase y no inventa importes.
 *
 * Los ingresos que muestra el panel salen de la RPC. Si la respuesta no cierra
 * (clave de más, ambiente cruzado, neto marcado como disponible), se descarta entera.
 */

import { esUuid } from "./reglas.js";

export const RPC_RESUMEN_PLANES = "resumen_planes_admin";
export const RPC_OPERACIONES_PLANES = "operaciones_planes_admin";
export const RPC_DETALLE_OPERACION_PLANES = "detalle_operacion_planes_admin";
export const RPC_SUSCRIPCIONES_PLANES = "suscripciones_planes_admin";
export const RPC_DETALLE_SUSCRIPCION_PLANES = "detalle_suscripcion_planes_admin";
export const RPC_LICENCIAS_PLANES = "licencias_planes_admin";
export const RPC_DETALLE_LICENCIA_PLANES = "detalle_licencia_planes_admin";

export const TAMANO_PAGINA_PLANES = 25;
export const ZONA_PLANES = "America/Argentina/Buenos_Aires";
export const DESPLAZAMIENTO_ARGENTINA = "-03:00";

export const AMBIENTES_PLANES = Object.freeze(["produccion", "prueba"]);
export const PERIODOS_PLANES = Object.freeze(["7", "30", "90", "personalizado"]);
export const PRODUCTOS_PLANES = Object.freeze(["todos", "plus", "pago_unico"]);
export const ESTADOS_OPERACION_PLANES = Object.freeze([
  "todos",
  "creada",
  "pendiente",
  "acreditado",
  "rechazado",
  "cancelado",
  "reembolsado",
  "contracargo",
]);
export const ESTADOS_SUSCRIPCION_PLANES = Object.freeze([
  "todos",
  "borrador",
  "pendiente_checkout",
  "activa",
  "pausada",
  "cancelada",
  "vencida",
  "past_due",
]);
export const ESTADOS_LICENCIA_PLANES = Object.freeze(["todos", "activa", "revocada"]);
export const ORIGENES_OPERACION = Object.freeze(["plus", "cultivo"]);

export const TEXTO_INGRESOS_NETOS =
  "No disponible. No hay un importe de reembolso ni de contracargo distinto del cobro original, y un reembolso parcial usa el mismo estado que uno total.";
export const TEXTO_MRR =
  "No disponible. Una suscripción con estado activa no es un cobro acreditado, y no hay un importe mensual contractual separado de cada pago.";
export const TEXTO_REEMBOLSOS =
  "El conteo de reembolsos y contracargos sale del estado guardado. El importe devuelto no está registrado, así que no se muestra ni se resta.";

const ENTERO = Number.MAX_SAFE_INTEGER;
const MAXIMO_DIAS = 366;
const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_REFERENCIA = /^[A-Za-z0-9_-]{1,64}$/;
const RE_ESTADO_MP = /^[a-z0-9_]{1,40}$/;

const MENSAJE_MIGRACION =
  "Planes e ingresos todavía no está operativo: falta aplicar supabase/admin-planes.sql. Hasta entonces no se muestran cifras.";
const MENSAJE_ERROR = "No pudimos leer los datos de planes. No se muestran cifras parciales.";
const MENSAJE_PERIODO = "El período no es válido. Usá 7, 30 o 90 días, o un rango de hasta 366 días.";
const MENSAJE_AMBIENTE = "El ambiente tiene que ser producción o prueba.";
const MENSAJE_PRODUCTO = "El producto tiene que ser Plus, pago único o todos.";
const MENSAJE_ESTADO = "Ese estado no existe en las operaciones.";
const MENSAJE_PAGINA = "La página no es válida.";

const CLAVES_RESUMEN = Object.freeze([
  "acreditados_sin_fecha",
  "ambiente",
  "clientes_pago_nuevos",
  "cruces_importe",
  "desde",
  "generado_en",
  "hasta",
  "ingresos_acreditados_centavos",
  "ingresos_cultivo_centavos",
  "ingresos_netos_disponibles",
  "ingresos_plus_centavos",
  "licencias_cobertura",
  "licencias_habilitan_pago",
  "licencias_sin_cobro",
  "licencias_sin_pago",
  "moneda",
  "mrr_disponible",
  "ok",
  "pagos_acreditados",
  "pagos_cancelados",
  "pagos_contracargos",
  "pagos_creados",
  "pagos_pendientes",
  "pagos_rechazados",
  "pagos_reembolsados",
  "sin_importe",
  "reembolsos_importe_disponible",
  "serie_dia",
  "serie_mes",
  "suscripciones_activas",
  "suscripciones_activas_sin_pago",
  "suscripciones_canceladas",
  "suscripciones_habilitadas",
]);

const CLAVES_FILA_OPERACION = Object.freeze([
  "ambiente",
  "estado",
  "fecha",
  "id",
  "importe_centavos",
  "moneda",
  "origen",
  "producto",
  "referencia_mp",
  "usuario_id",
]);

const CLAVES_DETALLE_OPERACION = Object.freeze([
  "acreditado_en",
  "ambiente",
  "ciclo_id",
  "creado_en",
  "estado",
  "estado_mp",
  "fecha",
  "id",
  "importe_centavos",
  "importe_cotizado_centavos",
  "incluida_en_totales",
  "moneda",
  "orden_mp",
  "origen",
  "periodo_desde",
  "periodo_hasta",
  "producto",
  "referencia_mp",
  "suscripcion_id",
  "usuario_id",
]);

const CLAVES_SUSCRIPCION = Object.freeze([
  "ambiente",
  "cancelada_en",
  "creada_en",
  "estado_interno",
  "habilitada",
  "id",
  "incidencia",
  "pagos_acreditados",
  "periodo_desde",
  "periodo_hasta",
  "renovaciones",
  "usuario_id",
  "vigente_hasta_fin_periodo",
]);

const CLAVES_PAGO_SUSCRIPCION = Object.freeze([
  "acreditado_en",
  "creado_en",
  "estado",
  "id",
  "importe_centavos",
  "moneda",
  "periodo_desde",
  "periodo_hasta",
  "referencia_mp",
]);

const CLAVES_LICENCIA = Object.freeze([
  "activada_en",
  "ambiente",
  "ciclo_estado",
  "ciclo_id",
  "cobertura",
  "estado",
  "estado_pago",
  "habilita",
  "id",
  "incidencia",
  "pago_id",
  "revocada_en",
  "usuario_id",
]);

export function mensajePlanes(estado) {
  if (estado === "migracion") return MENSAJE_MIGRACION;
  if (estado === "error") return MENSAJE_ERROR;
  if (estado === "consulta") return MENSAJE_PERIODO;
  return "";
}

export function clasificarErrorPlanes(error) {
  const codigo = String(error?.code || "");
  const mensaje = String(error?.message || "");
  if (codigo === "PGRST202" || /could not find the function|schema cache/i.test(mensaje)) return "migracion";
  return "error";
}

function falloConsulta(error) {
  return { ok: false, error };
}

function textoParametro(valor) {
  if (valor === undefined || valor === null || valor === "") return "";
  if (typeof valor === "string") return valor.length <= 40 ? valor : null;
  if (Array.isArray(valor) && valor.length === 1 && typeof valor[0] === "string" && valor[0].length <= 40) return valor[0];
  return null;
}

export function diaArgentina(fecha) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_PLANES,
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
  const fecha = new Date(`${dia}T00:00:00.000${DESPLAZAMIENTO_ARGENTINA}`);
  if (Number.isNaN(fecha.getTime())) return null;
  if (diaArgentina(fecha) !== dia) return null;
  return fecha.toISOString();
}

export function listarDias(desdeDia, hastaDia) {
  const dias = [];
  let cursor = desdeDia;
  while (cursor <= hastaDia) {
    dias.push(cursor);
    cursor = sumarDiasCalendario(cursor, 1);
    if (!cursor || dias.length > MAXIMO_DIAS) return null;
  }
  return dias;
}

function listarMeses(dias) {
  const meses = [];
  for (const dia of dias) {
    const mes = dia.slice(0, 7);
    if (meses.at(-1) !== mes) meses.push(mes);
  }
  return meses;
}

function rangoEntreDias(desdeDia, hastaDia) {
  const dias = listarDias(desdeDia, hastaDia);
  if (!dias) return null;
  const hastaExclusivo = sumarDiasCalendario(hastaDia, 1);
  const desde = inicioDiaArgentina(desdeDia);
  const hasta = inicioDiaArgentina(hastaExclusivo);
  if (!desde || !hasta) return null;
  return { desdeDia, hastaDia, desde, hasta, dias, meses: listarMeses(dias) };
}

function resolverAmbiente(valor) {
  if (valor === "") return { ok: true, ambiente: "produccion" };
  if (valor === null || !AMBIENTES_PLANES.includes(valor)) return falloConsulta(MENSAJE_AMBIENTE);
  return { ok: true, ambiente: valor };
}

function resolverPeriodo(bruto, ahora) {
  const periodo = bruto.periodo === "" ? "30" : bruto.periodo;
  if (periodo === null || !PERIODOS_PLANES.includes(periodo)) return falloConsulta(MENSAJE_PERIODO);
  if (periodo !== "personalizado") {
    const cantidad = Number(periodo);
    const hoy = diaArgentina(ahora);
    const desdeDia = sumarDiasCalendario(hoy, -(cantidad - 1));
    const rango = rangoEntreDias(desdeDia, hoy);
    if (!rango) return falloConsulta(MENSAJE_PERIODO);
    return { ok: true, periodo, ...rango };
  }
  if (!bruto.desde || !bruto.hasta || !RE_DIA.test(bruto.desde) || !RE_DIA.test(bruto.hasta)) {
    return falloConsulta(MENSAJE_PERIODO);
  }
  if (bruto.hasta < bruto.desde) return falloConsulta(MENSAJE_PERIODO);
  const rango = rangoEntreDias(bruto.desde, bruto.hasta);
  if (!rango || rango.dias.length > MAXIMO_DIAS) return falloConsulta(MENSAJE_PERIODO);
  if (bruto.desde < "2020-01-01" || bruto.hasta > "2100-01-01") return falloConsulta(MENSAJE_PERIODO);
  return { ok: true, periodo, ...rango };
}

function resolverLista(valor, permitidos, mensaje) {
  if (valor === "") return { ok: true, valor: "todos" };
  if (valor === null || !permitidos.includes(valor)) return falloConsulta(mensaje);
  return { ok: true, valor };
}

function resolverPagina(valor) {
  if (valor === "") return { ok: true, pagina: 1 };
  if (valor === null || !/^[1-9]\d{0,3}$/.test(valor)) return falloConsulta(MENSAJE_PAGINA);
  const pagina = Number(valor);
  if (pagina > 4000) return falloConsulta(MENSAJE_PAGINA);
  return { ok: true, pagina };
}

/**
 * Lee los searchParams del panel. Un valor ausente usa el default.
 * Un valor presente e inválido no se reemplaza por cifras de otro período.
 */
export function interpretarConsultaPlanes(parametros, ahora = new Date()) {
  const fuente = parametros && typeof parametros === "object" ? parametros : {};
  const bruto = {
    periodo: textoParametro(fuente.periodo),
    ambiente: textoParametro(fuente.ambiente),
    desde: textoParametro(fuente.desde),
    hasta: textoParametro(fuente.hasta),
    producto: textoParametro(fuente.producto),
    estado: textoParametro(fuente.estado),
    pagina: textoParametro(fuente.pagina),
  };
  if (Object.values(bruto).some((valor) => valor === null)) return falloConsulta(MENSAJE_PERIODO);

  const ambiente = resolverAmbiente(bruto.ambiente);
  const periodo = resolverPeriodo(bruto, ahora);
  const producto = resolverLista(bruto.producto, PRODUCTOS_PLANES, MENSAJE_PRODUCTO);
  const estado = resolverLista(bruto.estado, ESTADOS_OPERACION_PLANES, MENSAJE_ESTADO);
  const pagina = resolverPagina(bruto.pagina);
  const primero = [ambiente, periodo, producto, estado, pagina].find((item) => !item.ok);
  if (primero) return primero;

  return {
    ok: true,
    consulta: {
      periodo: periodo.periodo,
      ambiente: ambiente.ambiente,
      desde: periodo.desde,
      hasta: periodo.hasta,
      desdeDia: periodo.desdeDia,
      hastaDia: periodo.hastaDia,
      dias: periodo.dias,
      meses: periodo.meses,
      producto: producto.valor,
      estado: estado.valor,
      pagina: pagina.pagina,
      limite: TAMANO_PAGINA_PLANES,
      offset: (pagina.pagina - 1) * TAMANO_PAGINA_PLANES,
    },
  };
}

export function interpretarEstadoSuscripcion(valor) {
  return resolverLista(textoParametro(valor) ?? "", ESTADOS_SUSCRIPCION_PLANES, "Ese estado de suscripción no existe.");
}

export function interpretarEstadoLicencia(valor) {
  return resolverLista(textoParametro(valor) ?? "", ESTADOS_LICENCIA_PLANES, "Ese estado de licencia no existe.");
}

export function parametrosConsulta(consulta, { pagina = false } = {}) {
  const q = new URLSearchParams();
  q.set("periodo", consulta.periodo);
  q.set("ambiente", consulta.ambiente);
  if (consulta.periodo === "personalizado") {
    q.set("desde", consulta.desdeDia);
    q.set("hasta", consulta.hastaDia);
  }
  if (consulta.producto !== "todos") q.set("producto", consulta.producto);
  if (consulta.estado !== "todos") q.set("estado", consulta.estado);
  if (consulta.estadoSuscripcion && consulta.estadoSuscripcion !== "todos") q.set("estado_suscripcion", consulta.estadoSuscripcion);
  if (consulta.estadoLicencia && consulta.estadoLicencia !== "todos") q.set("estado_licencia", consulta.estadoLicencia);
  if (pagina && consulta.pagina > 1) q.set("pagina", String(consulta.pagina));
  return q.toString();
}

export function conFiltrosVecinos(consulta, parametros) {
  const fuente = parametros && typeof parametros === "object" ? parametros : {};
  const suscripcion = interpretarEstadoSuscripcion(fuente.estado_suscripcion);
  const licencia = interpretarEstadoLicencia(fuente.estado_licencia);
  return {
    ...consulta,
    estadoSuscripcion: suscripcion.ok ? suscripcion.valor : "todos",
    estadoLicencia: licencia.ok ? licencia.valor : "todos",
  };
}

export function prepararConsultaPlanes(parametros, ahora = new Date()) {
  const interpretado = interpretarConsultaPlanes(parametros, ahora);
  const base = interpretado.ok ? interpretado.consulta : interpretarConsultaPlanes({}, ahora).consulta;
  return { interpretado, consulta: conFiltrosVecinos(base, parametros) };
}

export function enlacesPlanes(consulta) {
  const base = parametrosConsulta(consulta);
  const sufijo = base ? `?${base}` : "";
  return [
    { id: "resumen", href: `/admin/planes${sufijo}`, titulo: "Resumen" },
    { id: "operaciones", href: `/admin/planes/operaciones${sufijo}`, titulo: "Operaciones" },
    { id: "suscripciones", href: `/admin/planes/suscripciones${sufijo}`, titulo: "Suscripciones" },
    { id: "licencias", href: `/admin/planes/licencias${sufijo}`, titulo: "Licencias" },
  ];
}

export function argumentosResumen(consulta) {
  return { p_desde: consulta.desde, p_hasta: consulta.hasta, p_ambiente: consulta.ambiente };
}

export function argumentosOperaciones(consulta) {
  return {
    p_desde: consulta.desde,
    p_hasta: consulta.hasta,
    p_producto: consulta.producto,
    p_estado: consulta.estado,
    p_ambiente: consulta.ambiente,
    p_limite: consulta.limite,
    p_offset: consulta.offset,
  };
}

export function argumentosSuscripciones(consulta, estado) {
  return {
    p_ambiente: consulta.ambiente,
    p_estado: estado,
    p_limite: consulta.limite,
    p_offset: consulta.offset,
  };
}

function entero(valor) {
  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 0 || valor > ENTERO) return null;
  return valor;
}

/** null si el JSON trae null. undefined si el valor no es un instante. */
function instante(valor) {
  if (valor === null) return null;
  if (typeof valor !== "string" || valor.length > 40) return undefined;
  const ms = Date.parse(valor);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString();
}

function mismoInstante(valor, esperado) {
  const leido = instante(valor);
  return leido !== null && leido === new Date(esperado).toISOString();
}

function clavesExactas(dato, claves) {
  if (!dato || typeof dato !== "object" || Array.isArray(dato)) return false;
  const presentes = Object.keys(dato);
  return presentes.length === claves.length && claves.every((clave) => Object.hasOwn(dato, clave));
}

function referencia(valor) {
  if (valor === null) return null;
  if (typeof valor !== "string" || !RE_REFERENCIA.test(valor)) return undefined;
  return valor;
}

function estadoMp(valor) {
  if (valor === null) return null;
  if (typeof valor !== "string" || !RE_ESTADO_MP.test(valor)) return undefined;
  return valor;
}

function contieneReservado(valor) {
  return typeof valor === "string" && /@|https?:|checkout|init_point|bearer|service_role/i.test(valor);
}

function uuidONull(valor) {
  if (valor === null) return null;
  if (!esUuid(valor)) return undefined;
  return valor.toLowerCase();
}

function booleano(valor) {
  return valor === true || valor === false ? valor : null;
}

function codigoIncidencia(valor, permitidos) {
  if (valor === null) return null;
  if (typeof valor !== "string" || !permitidos.includes(valor)) return undefined;
  return valor;
}

function presentarSerie(puntos, esperados, clave) {
  if (!Array.isArray(puntos) || puntos.length !== esperados.length) return null;
  const serie = [];
  for (let indice = 0; indice < esperados.length; indice += 1) {
    const punto = puntos[indice];
    if (!clavesExactas(punto, [clave, "centavos"])) return null;
    if (punto[clave] !== esperados[indice]) return null;
    const centavos = entero(punto.centavos);
    if (centavos === null) return null;
    serie.push({ [clave === "dia" ? "dia" : "mes"]: punto[clave], centavos });
  }
  return serie;
}

export function presentarResumenPlanes(data, consulta) {
  if (!clavesExactas(data, CLAVES_RESUMEN)) return { ok: false };
  if (data.ok !== true || data.moneda !== "ARS" || data.ambiente !== consulta.ambiente) return { ok: false };
  if (data.ingresos_netos_disponibles !== false || data.mrr_disponible !== false || data.reembolsos_importe_disponible !== false) {
    return { ok: false };
  }
  if (!mismoInstante(data.desde, consulta.desde) || !mismoInstante(data.hasta, consulta.hasta)) return { ok: false };
  const generadoEn = instante(data.generado_en);
  if (!generadoEn) return { ok: false };

  const numeros = {};
  for (const clave of CLAVES_RESUMEN) {
    if (["ok", "ambiente", "moneda", "desde", "hasta", "generado_en", "serie_dia", "serie_mes", "ingresos_netos_disponibles", "mrr_disponible", "reembolsos_importe_disponible"].includes(clave)) {
      continue;
    }
    const valor = entero(data[clave]);
    if (valor === null) return { ok: false };
    numeros[clave] = valor;
  }
  if (numeros.ingresos_plus_centavos + numeros.ingresos_cultivo_centavos !== numeros.ingresos_acreditados_centavos) {
    return { ok: false };
  }

  const serieDia = presentarSerie(data.serie_dia, consulta.dias, "dia");
  const serieMes = presentarSerie(data.serie_mes, consulta.meses, "mes");
  if (!serieDia || !serieMes) return { ok: false };
  const sumaDia = serieDia.reduce((total, punto) => total + punto.centavos, 0);
  const sumaMes = serieMes.reduce((total, punto) => total + punto.centavos, 0);
  if (sumaDia !== numeros.ingresos_acreditados_centavos || sumaMes !== numeros.ingresos_acreditados_centavos) return { ok: false };
  if (JSON.stringify(data).includes("@")) return { ok: false };

  return {
    ok: true,
    resumen: {
      generadoEn,
      ambiente: data.ambiente,
      moneda: "ARS",
      desde: consulta.desde,
      hasta: consulta.hasta,
      desdeDia: consulta.desdeDia,
      hastaDia: consulta.hastaDia,
      ingresosAcreditadosCentavos: numeros.ingresos_acreditados_centavos,
      ingresosPlusCentavos: numeros.ingresos_plus_centavos,
      ingresosCultivoCentavos: numeros.ingresos_cultivo_centavos,
      sinImporte: numeros.sin_importe,
      acreditadosSinFecha: numeros.acreditados_sin_fecha,
      crucesImporte: numeros.cruces_importe,
      suscripcionesActivas: numeros.suscripciones_activas,
      suscripcionesHabilitadas: numeros.suscripciones_habilitadas,
      suscripcionesCanceladas: numeros.suscripciones_canceladas,
      suscripcionesActivasSinPago: numeros.suscripciones_activas_sin_pago,
      licenciasCobertura: numeros.licencias_cobertura,
      licenciasHabilitanPago: numeros.licencias_habilitan_pago,
      licenciasSinCobro: numeros.licencias_sin_cobro,
      licenciasSinPago: numeros.licencias_sin_pago,
      pagosPendientes: numeros.pagos_pendientes,
      pagosRechazados: numeros.pagos_rechazados,
      pagosAcreditados: numeros.pagos_acreditados,
      pagosReembolsados: numeros.pagos_reembolsados,
      pagosContracargos: numeros.pagos_contracargos,
      pagosCreados: numeros.pagos_creados,
      pagosCancelados: numeros.pagos_cancelados,
      clientesPagoNuevos: numeros.clientes_pago_nuevos,
      ingresosNetosDisponibles: false,
      mrrDisponible: false,
      reembolsosImporteDisponible: false,
      textoIngresosNetos: TEXTO_INGRESOS_NETOS,
      textoMrr: TEXTO_MRR,
      textoReembolsos: TEXTO_REEMBOLSOS,
      serieDia,
      serieMes,
    },
  };
}

function filaOperacion(fila, ambiente) {
  if (!clavesExactas(fila, CLAVES_FILA_OPERACION)) return null;
  if (fila.ambiente !== ambiente || fila.moneda !== "ARS") return null;
  if (!esUuid(fila.id) || !esUuid(fila.usuario_id)) return null;
  if (!ORIGENES_OPERACION.includes(fila.origen)) return null;
  const producto = fila.origen === "plus" ? "plus" : "pago_unico";
  if (fila.producto !== producto) return null;
  if (!ESTADOS_OPERACION_PLANES.includes(fila.estado) || fila.estado === "todos") return null;
  const fecha = instante(fila.fecha);
  const importe = fila.importe_centavos === null ? null : entero(fila.importe_centavos);
  const mp = referencia(fila.referencia_mp);
  if (!fecha || importe === undefined || (fila.importe_centavos !== null && importe === null) || mp === undefined) return null;
  if (contieneReservado(fila.referencia_mp)) return null;
  return {
    id: fila.id.toLowerCase(),
    origen: fila.origen,
    fecha,
    producto: fila.producto,
    estado: fila.estado,
    importeCentavos: importe,
    moneda: "ARS",
    ambiente: fila.ambiente,
    usuarioId: fila.usuario_id.toLowerCase(),
    referenciaMp: mp,
  };
}

export function presentarOperacionesPlanes(data, consulta) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false };
  if (!clavesExactas(data, ["filas", "limite", "offset", "ok", "total"])) return { ok: false };
  if (data.ok !== true || data.limite !== TAMANO_PAGINA_PLANES || data.offset !== consulta.offset) return { ok: false };
  const total = entero(data.total);
  if (total === null || !Array.isArray(data.filas) || data.filas.length > TAMANO_PAGINA_PLANES) return { ok: false };
  if (consulta.offset > total || data.filas.length !== Math.min(TAMANO_PAGINA_PLANES, total - consulta.offset)) return { ok: false };
  const filas = [];
  for (const fila of data.filas) {
    const presentada = filaOperacion(fila, consulta.ambiente);
    if (!presentada) return { ok: false };
    if (consulta.producto !== "todos" && presentada.producto !== consulta.producto) return { ok: false };
    if (consulta.estado !== "todos" && presentada.estado !== consulta.estado) return { ok: false };
    filas.push(presentada);
  }
  if (JSON.stringify(data).includes("@")) return { ok: false };
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_PLANES));
  return { ok: true, listado: { total, limite: TAMANO_PAGINA_PLANES, offset: consulta.offset, pagina: consulta.pagina, paginas, filas } };
}

function detalleOperacion(operacion) {
  if (!clavesExactas(operacion, CLAVES_DETALLE_OPERACION)) return null;
  const base = filaOperacion(
    {
      id: operacion.id,
      origen: operacion.origen,
      fecha: operacion.fecha,
      producto: operacion.producto,
      estado: operacion.estado,
      importe_centavos: operacion.importe_centavos,
      moneda: operacion.moneda,
      ambiente: operacion.ambiente,
      usuario_id: operacion.usuario_id,
      referencia_mp: operacion.referencia_mp,
    },
    operacion.ambiente,
  );
  if (!base) return null;
  const cotizado = operacion.importe_cotizado_centavos === null ? null : entero(operacion.importe_cotizado_centavos);
  const orden = referencia(operacion.orden_mp);
  const mp = estadoMp(operacion.estado_mp);
  const incluida = booleano(operacion.incluida_en_totales);
  if ((operacion.importe_cotizado_centavos !== null && cotizado === null) || orden === undefined || mp === undefined || incluida === null) {
    return null;
  }
  const creadoEn = instante(operacion.creado_en);
  const acreditadoEn = instante(operacion.acreditado_en);
  const periodoDesde = instante(operacion.periodo_desde);
  const periodoHasta = instante(operacion.periodo_hasta);
  if (!creadoEn || acreditadoEn === undefined || periodoDesde === undefined || periodoHasta === undefined) return null;
  const suscripcionId = uuidONull(operacion.suscripcion_id);
  const cicloId = uuidONull(operacion.ciclo_id);
  if (suscripcionId === undefined || cicloId === undefined) return null;
  if (operacion.origen === "plus" && cicloId !== null) return null;
  if (operacion.origen === "cultivo" && suscripcionId !== null) return null;
  return {
    ...base,
    estadoMp: mp,
    importeCotizadoCentavos: cotizado,
    ordenMp: orden,
    creadoEn,
    acreditadoEn,
    periodoDesde,
    periodoHasta,
    suscripcionId,
    cicloId,
    incluidaEnTotales: incluida,
  };
}

export function presentarDetalleOperacion(data) {
  if (!data || typeof data !== "object" || data.ok !== true || Object.keys(data).length !== 2) return { ok: false };
  const operacion = detalleOperacion(data.operacion);
  if (!operacion || JSON.stringify(data).includes("@")) return { ok: false };
  return { ok: true, operacion };
}

function filaSuscripcion(fila, ambiente) {
  if (!clavesExactas(fila, CLAVES_SUSCRIPCION)) return null;
  if (fila.ambiente !== ambiente || !esUuid(fila.id) || !esUuid(fila.usuario_id)) return null;
  if (!ESTADOS_SUSCRIPCION_PLANES.includes(fila.estado_interno) || fila.estado_interno === "todos") return null;
  const habilitada = booleano(fila.habilitada);
  const vigente = booleano(fila.vigente_hasta_fin_periodo);
  const pagos = entero(fila.pagos_acreditados);
  const renovaciones = entero(fila.renovaciones);
  const incidencia = codigoIncidencia(fila.incidencia, ["sin_pago_acreditado", "periodo_vencido"]);
  if (habilitada === null || vigente === null || pagos === null || renovaciones === null || incidencia === undefined) return null;
  if (renovaciones !== Math.max(0, pagos - 1)) return null;
  if (habilitada && (fila.estado_interno === "borrador" || fila.estado_interno === "pendiente_checkout" || fila.estado_interno === "pausada" || fila.estado_interno === "vencida" || fila.estado_interno === "past_due")) {
    return null;
  }
  const creadaEn = instante(fila.creada_en);
  const periodoDesde = instante(fila.periodo_desde);
  const periodoHasta = instante(fila.periodo_hasta);
  const canceladaEn = instante(fila.cancelada_en);
  if (!creadaEn || periodoDesde === undefined || periodoHasta === undefined || canceladaEn === undefined) return null;
  if (fila.estado_interno === "cancelada" && !canceladaEn) return null;
  if (fila.estado_interno !== "cancelada" && canceladaEn) return null;
  return {
    id: fila.id.toLowerCase(),
    usuarioId: fila.usuario_id.toLowerCase(),
    ambiente: fila.ambiente,
    estadoInterno: fila.estado_interno,
    periodoDesde,
    periodoHasta,
    canceladaEn,
    vigenteHastaFinPeriodo: vigente,
    creadaEn,
    pagosAcreditados: pagos,
    renovaciones,
    habilitada,
    incidencia,
  };
}

export function presentarSuscripcionesPlanes(data, consulta) {
  return presentarListado(data, consulta, (fila) => filaSuscripcion(fila, consulta.ambiente));
}

function pagoSuscripcion(fila) {
  if (!clavesExactas(fila, CLAVES_PAGO_SUSCRIPCION)) return null;
  if (!esUuid(fila.id) || fila.moneda !== "ARS") return null;
  if (!["pendiente", "acreditado", "rechazado", "reembolsado", "contracargo"].includes(fila.estado)) return null;
  const importe = fila.importe_centavos === null ? null : entero(fila.importe_centavos);
  const mp = referencia(fila.referencia_mp);
  const creadoEn = instante(fila.creado_en);
  const acreditadoEn = instante(fila.acreditado_en);
  const periodoDesde = instante(fila.periodo_desde);
  const periodoHasta = instante(fila.periodo_hasta);
  if ((fila.importe_centavos !== null && importe === null) || mp === undefined || !creadoEn) return null;
  if (acreditadoEn === undefined || periodoDesde === undefined || periodoHasta === undefined) return null;
  return {
    id: fila.id.toLowerCase(),
    estado: fila.estado,
    importeCentavos: importe,
    moneda: "ARS",
    acreditadoEn,
    creadoEn,
    referenciaMp: mp,
    periodoDesde,
    periodoHasta,
  };
}

export function presentarDetalleSuscripcion(data) {
  if (!data || data.ok !== true || Object.keys(data).length !== 4) return { ok: false };
  if (!Array.isArray(data.pagos) || data.pagos.length > 24 || typeof data.pagos_recortados !== "boolean") return { ok: false };
  const ambiente = data.suscripcion?.ambiente;
  if (!AMBIENTES_PLANES.includes(ambiente)) return { ok: false };
  const suscripcion = filaSuscripcion(data.suscripcion, ambiente);
  if (!suscripcion) return { ok: false };
  const pagos = [];
  for (const pago of data.pagos) {
    const presentado = pagoSuscripcion(pago);
    if (!presentado) return { ok: false };
    pagos.push(presentado);
  }
  if (JSON.stringify(data).includes("@")) return { ok: false };
  return { ok: true, suscripcion, pagos, pagosRecortados: data.pagos_recortados };
}

function filaLicencia(fila, ambiente) {
  if (!clavesExactas(fila, CLAVES_LICENCIA)) return null;
  if (!esUuid(fila.id) || !esUuid(fila.usuario_id) || !esUuid(fila.ciclo_id)) return null;
  if (fila.ambiente !== ambiente && fila.ambiente !== null) return null;
  if (fila.ambiente === null && fila.incidencia !== "sin_pago") return null;
  if (!["activa", "revocada"].includes(fila.estado)) return null;
  if (fila.estado_pago !== null && !ESTADOS_OPERACION_PLANES.includes(fila.estado_pago)) return null;
  if (fila.estado_pago === "todos") return null;
  const pagoId = uuidONull(fila.pago_id);
  const habilita = booleano(fila.habilita);
  const cobertura = booleano(fila.cobertura);
  const incidencia = codigoIncidencia(fila.incidencia, ["sin_pago", "pago_no_acreditado", "identidad_distinta", "ciclo_finalizado"]);
  if (pagoId === undefined || habilita === null || cobertura === null || incidencia === undefined) return null;
  if (cobertura && !habilita) return null;
  if (habilita && (fila.estado !== "activa" || fila.estado_pago !== "acreditado" || fila.ambiente !== ambiente)) return null;
  if (fila.ciclo_estado !== null && fila.ciclo_estado !== "activo" && fila.ciclo_estado !== "finalizado") return null;
  if (cobertura && fila.ciclo_estado !== "activo") return null;
  const activadaEn = instante(fila.activada_en);
  const revocadaEn = instante(fila.revocada_en);
  if (!activadaEn || revocadaEn === undefined) return null;
  if (fila.estado === "revocada" && !revocadaEn) return null;
  if (fila.estado === "activa" && revocadaEn) return null;
  return {
    id: fila.id.toLowerCase(),
    usuarioId: fila.usuario_id.toLowerCase(),
    cicloId: fila.ciclo_id.toLowerCase(),
    cicloEstado: fila.ciclo_estado,
    pagoId,
    estado: fila.estado,
    estadoPago: fila.estado_pago,
    ambiente: fila.ambiente,
    activadaEn,
    revocadaEn,
    habilita,
    cobertura,
    incidencia,
  };
}

export function presentarLicenciasPlanes(data, consulta) {
  return presentarListado(data, consulta, (fila) => filaLicencia(fila, consulta.ambiente));
}

export function presentarDetalleLicencia(data) {
  if (!data || data.ok !== true || Object.keys(data).length !== 2) return { ok: false };
  const ambiente = data.licencia?.ambiente ?? "produccion";
  if (data.licencia?.ambiente !== null && !AMBIENTES_PLANES.includes(ambiente)) return { ok: false };
  const licencia = filaLicencia(data.licencia, data.licencia?.ambiente === null ? "produccion" : ambiente);
  if (!licencia || JSON.stringify(data).includes("@")) return { ok: false };
  return { ok: true, licencia };
}

function presentarListado(data, consulta, presentarFila) {
  if (!data || typeof data !== "object" || !clavesExactas(data, ["filas", "limite", "offset", "ok", "total"])) return { ok: false };
  if (data.ok !== true || data.limite !== TAMANO_PAGINA_PLANES || data.offset !== consulta.offset) return { ok: false };
  const total = entero(data.total);
  if (total === null || !Array.isArray(data.filas) || data.filas.length > TAMANO_PAGINA_PLANES) return { ok: false };
  if (consulta.offset > total || data.filas.length !== Math.min(TAMANO_PAGINA_PLANES, total - consulta.offset)) return { ok: false };
  const filas = [];
  for (const fila of data.filas) {
    const presentada = presentarFila(fila);
    if (!presentada) return { ok: false };
    filas.push(presentada);
  }
  if (JSON.stringify(data).includes("@")) return { ok: false };
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_PLANES));
  return { ok: true, listado: { total, limite: TAMANO_PAGINA_PLANES, offset: consulta.offset, pagina: consulta.pagina, paginas, filas } };
}

export function codigoPlanesConocido(data) {
  if (!data || data.ok !== false || Object.keys(data).length !== 2) return null;
  const permitidos = new Set(["ambiente_invalido", "periodo_invalido", "paginacion_invalida", "filtro_invalido", "no_encontrada"]);
  return permitidos.has(data.codigo) ? data.codigo : null;
}

export function mensajeCodigoPlanes(codigo) {
  if (codigo === "no_encontrada") return "";
  if (codigo === "paginacion_invalida") return MENSAJE_PAGINA;
  if (codigo === "filtro_invalido") return MENSAJE_ESTADO;
  if (codigo === "ambiente_invalido") return MENSAJE_AMBIENTE;
  if (codigo === "periodo_invalido") return MENSAJE_PERIODO;
  return MENSAJE_ERROR;
}
