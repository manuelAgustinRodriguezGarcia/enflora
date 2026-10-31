import { DIAS_VIGENCIA_COTIZACION } from "@/lib/pagos/cotizacion-bna";
import { mismosImportes } from "@/lib/pagos/dinero";
import { importePlusDecimalOrden } from "@/lib/pagos/plus/dinero";

/** Ventana previa al cobro para PUT /preapproval (iteración 2: cron dedicado). */
export const HORAS_ANTES_RENOVACION_PUT = 72;
/** Margen previo al cobro en el que ya no se modifica el importe (minutos). */
export const MARGEN_MINIMO_PUT_MIN = 15;

/**
 * Mercado Pago no aplica BNA: hay que recalcular ARS y PUT antes de next_payment_date.
 * Si la cotización no está disponible o es inválida → bloqueo comercial (no cobrar silenciosamente).
 *
 * Fuente de verdad de fecha, estado e importe vigente: `remoto` (GET /preapproval/{id}).
 * Sin `remoto` (uso legacy/tests) se usan los datos locales de `suscripcion`.
 *
 * ATENCIÓN: "bloqueado" es una marca LOCAL (auditoría/alerta). No detiene el débito de
 * Mercado Pago: si la suscripción sigue `authorized`, MP cobrará el importe vigente.
 * Ver auditorias/PLAN-420-CRON-RENOVACION-ARS.md.
 */
export function evaluarActualizacionArsPreRenovacion({
  suscripcion,
  remoto = null,
  cotizacion,
  ahora = new Date(),
  ambienteActual = null,
}) {
  if (!suscripcion?.preapproval_id) {
    return { ok: false, codigo: "sin_preapproval", accion: "bloqueado" };
  }
  if (ambienteActual && suscripcion.ambiente && suscripcion.ambiente !== ambienteActual) {
    return { ok: true, accion: "omitir", motivo: "ambiente_distinto" };
  }
  if (suscripcion.estado_interno !== "activa") {
    return { ok: true, accion: "omitir", motivo: "suscripcion_no_activa" };
  }
  if (remoto && String(remoto.status || "").toLowerCase() !== "authorized") {
    return { ok: true, accion: "omitir", motivo: "mp_no_autorizada", estadoMp: remoto.status || null };
  }

  const fechaProxima = remoto ? remoto.next_payment_date : suscripcion.proxima_renovacion;
  const proxima = fechaProxima ? new Date(fechaProxima) : null;
  if (!proxima || Number.isNaN(proxima.getTime())) {
    return { ok: false, codigo: "sin_proxima_renovacion", accion: "bloqueado" };
  }

  const msHasta = proxima.getTime() - ahora.getTime();
  const base = { proximaRenovacion: proxima.toISOString(), horasHastaRenovacion: msHasta / 3600000 };
  if (msHasta > HORAS_ANTES_RENOVACION_PUT * 3600 * 1000) {
    return { ok: true, accion: "omitir", motivo: "fuera_de_ventana", ...base };
  }

  // Si el importe ya es el correcto no hay nada que modificar, aunque el cobro sea inminente.
  if (msHasta < MARGEN_MINIMO_PUT_MIN * 60 * 1000 && cotizacion?.ok) {
    const esperado = importePlusDecimalOrden(cotizacion.cotizacion.venta);
    const vigente = remoto?.auto_recurring?.transaction_amount;
    if (esperado && vigente != null && mismosImportes(esperado, vigente)) {
      return { ok: true, accion: "omitir", motivo: "importe_ya_vigente", importeDecimal: esperado, ...base };
    }
  }

  // Fecha alcanzada o superada: el ciclo ya se está cobrando (o MP aún no avanzó la fecha).
  // Un PUT ahora modificaría un período incierto: se bloquea y queda como incidencia.
  if (msHasta <= 0) {
    return {
      ok: false,
      codigo: "renovacion_vencida",
      accion: "bloqueado",
      bloqueoComercial: true,
      ...base,
      mensaje: "La fecha de cobro ya se alcanzó: no se hace PUT sobre una renovación vencida.",
    };
  }
  if (msHasta < MARGEN_MINIMO_PUT_MIN * 60 * 1000) {
    return {
      ok: false,
      codigo: "cobro_inminente",
      accion: "bloqueado",
      bloqueoComercial: true,
      ...base,
      mensaje: "Cobro inminente: no se modifica el importe en el margen previo al débito.",
    };
  }

  if (!cotizacion?.ok) {
    return {
      ok: false,
      codigo: cotizacion?.codigo || "cotizacion_no_disponible",
      accion: "bloqueado",
      bloqueoComercial: true,
      ...base,
      mensaje:
        "No se puede actualizar el importe ARS antes del cobro sin cotización BNA vigente. No se debe cobrar el ARS congelado sin revisión.",
    };
  }

  const importeDecimal = importePlusDecimalOrden(cotizacion.cotizacion.venta);
  if (!importeDecimal) {
    return { ok: false, codigo: "importe_invalido", accion: "bloqueado", bloqueoComercial: true, ...base };
  }

  const edadDias = cotizacion.edadDias ?? 0;
  if (edadDias > DIAS_VIGENCIA_COTIZACION) {
    return { ok: false, codigo: "cotizacion_antigua", accion: "bloqueado", bloqueoComercial: true, ...base };
  }

  const importeRemoto = remoto?.auto_recurring?.transaction_amount;
  if (importeRemoto != null && mismosImportes(importeDecimal, importeRemoto)) {
    return { ok: true, accion: "omitir", motivo: "importe_ya_vigente", importeDecimal, ...base };
  }

  return {
    ok: true,
    accion: "put_preapproval",
    importeDecimal,
    importeRemotoActual: importeRemoto ?? null,
    cotizacion: cotizacion.cotizacion,
    confirmarConGet: true,
    reintentosMaximos: 3,
    ...base,
  };
}
