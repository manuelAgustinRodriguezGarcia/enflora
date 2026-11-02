/**
 * Criterio de los KPI de planes, sobre filas ya normalizadas.
 * Lo usan los tests. El panel no lo ejecuta: los totales salen de supabase/admin-planes.sql,
 * que tiene que aplicar estas mismas reglas.
 *
 * No lee precio_usd ni recalcula con una cotización. Plus solo suma importe cobrado.
 */

import { licenciaHabilita } from "@/lib/pagos/cobertura";
import { plusSuscripcionHabilita } from "@/lib/pagos/plus/cobertura";

const PRIORIDAD_ESTADO = Object.freeze({
  contracargo: 1,
  reembolsado: 2,
  acreditado: 3,
  rechazado: 4,
  cancelado: 5,
  pendiente: 6,
  creada: 7,
});

function prioridad(estado) {
  return PRIORIDAD_ESTADO[estado] ?? 8;
}

function enRango(iso, desde, hasta) {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms >= desde && ms < hasta;
}

function grupoDe(movimiento) {
  return movimiento.claveMp ? `mp:${movimiento.claveMp}` : `${movimiento.origen}:${movimiento.id}`;
}

function comparar(a, b) {
  const porEstado = prioridad(a.estado) - prioridad(b.estado);
  if (porEstado !== 0) return porEstado;
  const porOrigen = (a.origen === "plus" ? 0 : 1) - (b.origen === "plus" ? 0 : 1);
  if (porOrigen !== 0) return porOrigen;
  const acreditadoA = a.acreditadoEn ? Date.parse(a.acreditadoEn) : Number.NEGATIVE_INFINITY;
  const acreditadoB = b.acreditadoEn ? Date.parse(b.acreditadoEn) : Number.NEGATIVE_INFINITY;
  if (acreditadoB !== acreditadoA) return acreditadoB - acreditadoA;
  const creadoB = Date.parse(b.creadoEn) - Date.parse(a.creadoEn);
  if (creadoB !== 0) return creadoB;
  return a.id < b.id ? -1 : 1;
}

export function deduplicarMovimientos(movimientos) {
  const grupos = new Map();
  for (const movimiento of movimientos) {
    const clave = grupoDe(movimiento);
    const lista = grupos.get(clave) ?? [];
    lista.push(movimiento);
    grupos.set(clave, lista);
  }
  return [...grupos.entries()].map(([grupo, filas]) => {
    const ordenadas = [...filas].sort(comparar);
    return { grupo, filas, sobreviviente: ordenadas[0] };
  });
}

function importesCobrados(filas) {
  return [...new Set(filas.map((fila) => fila.importeCentavos).filter((valor) => Number.isInteger(valor) && valor >= 0))];
}

/** Importe cobrado de un grupo cuya fila sobreviviente está acreditada. Un cruce no elige un lado. */
export function montoResuelto(grupo) {
  if (grupo.sobreviviente.estado !== "acreditado") return { tipo: "no_acreditado" };
  const acreditadas = grupo.filas.filter((fila) => fila.estado === "acreditado");
  const importes = importesCobrados(acreditadas);
  if (importes.length > 1) return { tipo: "cruce" };
  if (importes.length === 0) return { tipo: "sin_importe" };
  const producto = acreditadas.some((fila) => fila.origen === "plus" && Number.isInteger(fila.importeCentavos)) ? "plus" : "cultivo";
  return { tipo: "monto", centavos: importes[0], producto };
}

function fechaOperacion(movimiento) {
  return movimiento.acreditadoEn || movimiento.creadoEn;
}

function pagoVigente(suscripcion, movimientos, ahora) {
  return movimientos.some((movimiento) => {
    if (movimiento.origen !== "plus" || movimiento.suscripcionId !== suscripcion.id) return false;
    if (movimiento.ambiente !== suscripcion.ambiente || movimiento.estado !== "acreditado") return false;
    if (!movimiento.periodoHasta) return false;
    const hasta = new Date(movimiento.periodoHasta);
    return !Number.isNaN(hasta.getTime()) && hasta >= ahora;
  });
}

export function evaluarSuscripcion(suscripcion, movimientos, ahora = new Date()) {
  const propios = deduplicarMovimientos(
    movimientos.filter(
      (movimiento) =>
        movimiento.origen === "plus" &&
        movimiento.suscripcionId === suscripcion.id &&
        movimiento.ambiente === suscripcion.ambiente,
    ),
  );
  const pagosAcreditados = propios.filter((grupo) => grupo.sobreviviente.estado === "acreditado").length;
  const habilitada = plusSuscripcionHabilita({
    suscripcion: {
      usuario_id: suscripcion.usuarioId,
      ambiente: suscripcion.ambiente,
      estado_interno: suscripcion.estadoInterno,
      periodo_vigente_hasta: suscripcion.periodoVigenteHasta,
      vigente_hasta_fin_periodo: suscripcion.vigenteHastaFinPeriodo,
    },
    ambiente: suscripcion.ambiente,
    usuarioId: suscripcion.usuarioId,
    pagoVigenteAcreditado: pagoVigente(suscripcion, movimientos, ahora),
    ahora,
  });
  let incidencia = null;
  if (suscripcion.estadoInterno === "activa" && pagosAcreditados === 0) incidencia = "sin_pago_acreditado";
  else if (suscripcion.estadoInterno === "activa" && suscripcion.periodoVigenteHasta && new Date(suscripcion.periodoVigenteHasta) < ahora) {
    incidencia = "periodo_vencido";
  }
  return {
    habilitada,
    incidencia,
    pagosAcreditados,
    renovaciones: Math.max(0, pagosAcreditados - 1),
  };
}

export function evaluarLicencia(licencia, ambiente) {
  const pago = licencia.pago;
  const habilita = licenciaHabilita({
    licencia: {
      estado: licencia.estado,
      pago_id: licencia.pagoId,
      usuario_id: licencia.usuarioId,
      ciclo_cultivo_id: licencia.cicloId,
    },
    pago: pago
      ? {
          id: pago.id,
          estado: pago.estado,
          ambiente: pago.ambiente,
          usuario_id: pago.usuarioId,
          ciclo_cultivo_id: pago.cicloId,
        }
      : null,
    ambiente,
    usuarioId: licencia.usuarioId,
  });
  const cobertura = Boolean(habilita && licencia.cicloEstado === "activo" && licencia.cicloUsuarioId === licencia.usuarioId);
  let incidencia = null;
  if (!pago) incidencia = "sin_pago";
  else if (pago.usuarioId !== licencia.usuarioId || pago.cicloId !== licencia.cicloId) incidencia = "identidad_distinta";
  else if (licencia.estado === "activa" && pago.estado !== "acreditado") incidencia = "pago_no_acreditado";
  else if (habilita && licencia.cicloEstado === "finalizado") incidencia = "ciclo_finalizado";
  return { habilita, cobertura, incidencia };
}

function diaDe(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * @param {object} entrada
 * @param {Array} entrada.movimientos  importeCentavos es el cobrado: cultivo importe_ars, plus importe_cobrado_ars.
 * @param {Array} entrada.suscripciones
 * @param {Array} entrada.licencias
 * @param {"prueba"|"produccion"} entrada.ambiente
 * @param {string} entrada.desde ISO exclusivo del fin en `hasta`.
 * @param {string} entrada.hasta
 * @param {string[]} entrada.dias
 * @param {string[]} entrada.meses
 */
export function calcularResumenPlanes({
  movimientos,
  suscripciones,
  licencias,
  ambiente,
  desde,
  hasta,
  dias,
  meses,
  ahora = new Date(),
}) {
  const desdeMs = Date.parse(desde);
  const hastaMs = Date.parse(hasta);
  const delAmbiente = movimientos.filter((movimiento) => movimiento.ambiente === ambiente);
  const grupos = deduplicarMovimientos(delAmbiente);
  const enPeriodo = (iso) => enRango(iso, desdeMs, hastaMs);

  let ingresosPlus = 0;
  let ingresosCultivo = 0;
  let sinImporte = 0;
  let crucesImporte = 0;
  let acreditadosSinFecha = 0;
  const porDia = new Map(dias.map((dia) => [dia, 0]));

  for (const grupo of grupos) {
    const sobreviviente = grupo.sobreviviente;
    if (sobreviviente.estado === "acreditado" && !sobreviviente.acreditadoEn) acreditadosSinFecha += 1;
    if (sobreviviente.estado !== "acreditado" || !enPeriodo(sobreviviente.acreditadoEn)) continue;
    const monto = montoResuelto(grupo);
    if (monto.tipo === "cruce") {
      crucesImporte += 1;
      continue;
    }
    if (monto.tipo === "sin_importe") {
      sinImporte += 1;
      continue;
    }
    if (monto.tipo !== "monto") continue;
    if (monto.producto === "plus") ingresosPlus += monto.centavos;
    else ingresosCultivo += monto.centavos;
    const dia = diaDe(sobreviviente.acreditadoEn);
    if (porDia.has(dia)) porDia.set(dia, porDia.get(dia) + monto.centavos);
  }

  const contar = (estado) =>
    grupos.filter((grupo) => grupo.sobreviviente.estado === estado && enPeriodo(fechaOperacion(grupo.sobreviviente))).length;

  const primeros = new Map();
  for (const grupo of grupos) {
    const monto = montoResuelto(grupo);
    if (monto.tipo !== "monto" || !grupo.sobreviviente.acreditadoEn) continue;
    const previo = primeros.get(grupo.sobreviviente.usuarioId);
    const actual = Date.parse(grupo.sobreviviente.acreditadoEn);
    if (previo === undefined || actual < previo) primeros.set(grupo.sobreviviente.usuarioId, actual);
  }
  let clientesPagoNuevos = 0;
  for (const primero of primeros.values()) {
    if (primero >= desdeMs && primero < hastaMs) clientesPagoNuevos += 1;
  }

  const subs = suscripciones.filter((suscripcion) => suscripcion.ambiente === ambiente);
  let suscripcionesHabilitadas = 0;
  let suscripcionesActivasSinPago = 0;
  for (const suscripcion of subs) {
    const evaluada = evaluarSuscripcion(suscripcion, delAmbiente, ahora);
    if (evaluada.habilitada) suscripcionesHabilitadas += 1;
    if (evaluada.incidencia === "sin_pago_acreditado") suscripcionesActivasSinPago += 1;
  }

  const licenciasAmbiente = licencias.filter((licencia) => !licencia.pago || licencia.pago.ambiente === ambiente);
  let licenciasCobertura = 0;
  let licenciasHabilitanPago = 0;
  let licenciasSinCobro = 0;
  for (const licencia of licenciasAmbiente) {
    const evaluada = evaluarLicencia(licencia, ambiente);
    if (evaluada.habilita) licenciasHabilitanPago += 1;
    if (evaluada.cobertura) licenciasCobertura += 1;
    if (evaluada.incidencia === "pago_no_acreditado" || evaluada.incidencia === "identidad_distinta") licenciasSinCobro += 1;
  }
  const licenciasSinPago = licencias.filter((licencia) => licencia.estado === "activa" && !licencia.pago).length;

  const serieDia = dias.map((dia) => ({ dia, centavos: porDia.get(dia) ?? 0 }));
  const porMes = new Map(meses.map((mes) => [mes, 0]));
  for (const punto of serieDia) {
    const mes = punto.dia.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + punto.centavos);
  }

  return {
    ingresosAcreditadosCentavos: ingresosPlus + ingresosCultivo,
    ingresosPlusCentavos: ingresosPlus,
    ingresosCultivoCentavos: ingresosCultivo,
    sinImporte,
    acreditadosSinFecha,
    crucesImporte,
    suscripcionesActivas: subs.filter((suscripcion) => suscripcion.estadoInterno === "activa").length,
    suscripcionesHabilitadas,
    suscripcionesCanceladas: subs.filter((suscripcion) => suscripcion.estadoInterno === "cancelada").length,
    suscripcionesActivasSinPago,
    licenciasCobertura,
    licenciasHabilitanPago,
    licenciasSinCobro,
    licenciasSinPago,
    pagosPendientes: contar("pendiente"),
    pagosRechazados: contar("rechazado"),
    pagosAcreditados: contar("acreditado"),
    pagosReembolsados: contar("reembolsado"),
    pagosContracargos: contar("contracargo"),
    pagosCreados: contar("creada"),
    pagosCancelados: contar("cancelado"),
    clientesPagoNuevos,
    ingresosNetosDisponibles: false,
    mrrDisponible: false,
    reembolsosImporteDisponible: false,
    serieDia,
    serieMes: meses.map((mes) => ({ mes, centavos: porMes.get(mes) ?? 0 })),
  };
}

export function listarOperaciones(movimientos, consulta) {
  const desdeMs = Date.parse(consulta.desde);
  const hastaMs = Date.parse(consulta.hasta);
  const grupos = deduplicarMovimientos(movimientos.filter((movimiento) => movimiento.ambiente === consulta.ambiente));
  let filas = grupos.map((grupo) => {
    const sobreviviente = grupo.sobreviviente;
    const monto = montoResuelto(grupo);
    const importeCentavos =
      sobreviviente.estado === "acreditado"
        ? monto.tipo === "monto"
          ? monto.centavos
          : null
        : (sobreviviente.importeListaCentavos ?? sobreviviente.importeCentavos);
    return { ...sobreviviente, importeCentavos };
  });
  filas = filas.filter((fila) => enRango(fechaOperacion(fila), desdeMs, hastaMs));
  if (consulta.producto === "plus") filas = filas.filter((fila) => fila.origen === "plus");
  if (consulta.producto === "pago_unico") filas = filas.filter((fila) => fila.origen === "cultivo");
  if (consulta.estado !== "todos") filas = filas.filter((fila) => fila.estado === consulta.estado);
  filas.sort((a, b) => {
    const diferencia = Date.parse(fechaOperacion(b)) - Date.parse(fechaOperacion(a));
    if (diferencia !== 0) return diferencia;
    return a.id < b.id ? 1 : -1;
  });
  const total = filas.length;
  const offset = consulta.offset;
  return { total, filas: filas.slice(offset, offset + consulta.limite) };
}
