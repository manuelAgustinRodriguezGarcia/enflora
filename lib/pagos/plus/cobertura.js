import { ESTADOS_PLUS_INTERNO } from "@/lib/pagos/plus/constantes";

/**
 * ¿La suscripción Plus habilita beneficios comerciales de cuenta?
 * Requiere ambiente alineado, periodo vigente y al menos un pago acreditado registrado.
 */
export function plusSuscripcionHabilita({
  suscripcion,
  ambiente,
  usuarioId,
  pagoVigenteAcreditado = false,
  ahora = new Date(),
}) {
  if (!suscripcion || !usuarioId) return false;
  if (suscripcion.usuario_id && suscripcion.usuario_id !== usuarioId) return false;
  if (!ambiente || suscripcion.ambiente !== ambiente) return false;

  const estado = suscripcion.estado_interno;
  if (
    estado === ESTADOS_PLUS_INTERNO.borrador ||
    estado === ESTADOS_PLUS_INTERNO.pendienteCheckout ||
    estado === ESTADOS_PLUS_INTERNO.pausada ||
    estado === ESTADOS_PLUS_INTERNO.vencida ||
    estado === ESTADOS_PLUS_INTERNO.pastDue
  ) {
    return false;
  }

  if (!pagoVigenteAcreditado) return false;

  const hasta = suscripcion.periodo_vigente_hasta
    ? new Date(suscripcion.periodo_vigente_hasta)
    : null;
  if (!hasta || Number.isNaN(hasta.getTime()) || hasta < ahora) return false;

  if (estado === ESTADOS_PLUS_INTERNO.activa) return true;

  if (estado === ESTADOS_PLUS_INTERNO.cancelada && suscripcion.vigente_hasta_fin_periodo) {
    return true;
  }

  return false;
}
