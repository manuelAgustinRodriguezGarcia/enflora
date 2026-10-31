import "server-only";

import { Resend } from "resend";

/**
 * Alertas ADMINISTRATIVAS de renovación Plus (PLAN 420). Canal: correo por Resend, la misma
 * infraestructura de /api/partners y /api/contacto. Nunca se usan notificaciones push: esas
 * son para usuarios finales y estos errores son internos.
 *
 * Variables: RESEND_API_KEY, RESEND_FROM_EMAIL y destino PLUS_ALERT_EMAIL (o CONTACT_EMAIL).
 * El texto no incluye correos de usuarios, tokens ni identificadores completos de Mercado Pago.
 */

const ETIQUETA_NIVEL = {
  aviso: "AVISO",
  urgente: "URGENTE",
  critico: "CRITICO",
  agotado: "REINTENTOS AGOTADOS",
};

const ACCION_SUGERIDA = {
  cotizacion_no_disponible: "Verificar la fuente BNA y la última cotización guardada; reintento automático en la próxima corrida.",
  cotizacion_antigua: "La última cotización BNA supera la vigencia; revisar la fuente o definir el importe manualmente.",
  put_rechazado: "Mercado Pago rechazó la actualización de importe; revisar el estado de la suscripción en MP.",
  put_no_confirmado: "El GET posterior no refleja el importe enviado; revisar la suscripción en MP antes del cobro.",
  confirmacion_get_fallida: "No se pudo confirmar el importe tras el PUT; la próxima corrida lo verifica sin repetir el PUT si ya coincide.",
  get_mp_fallido: "No se pudo leer la suscripción en MP; reintento automático.",
  sin_proxima_renovacion: "MP no informa próxima fecha de cobro; revisar la suscripción.",
  mp_proteccion_activada: "Se frenaron las escrituras a MP por errores 429/5xx; se reintenta en la próxima corrida.",
  auditoria_no_disponible: "CRON DETENIDO (fail-closed): falta la migración de auditoría o falla Supabase. No se hizo ningún PUT. Aplicar/verificar la migración.",
  reserva_fallida: "No se pudo reservar un intento; se detuvieron los PUT de la corrida. Revisar Supabase y la tabla de auditoría.",
  lectura_parcial: "No se pudieron leer todas las páginas de suscripciones; algunas no se evaluaron en esta corrida.",
  limite_corrida: "Se alcanzó el tope de suscripciones por corrida; subir el tope o revisar la frecuencia.",
  corrida_truncada: "Se agotó el presupuesto de tiempo; las suscripciones restantes quedan para la próxima corrida (más urgentes primero).",
  error_inesperado: "Error inesperado procesando una suscripción; el resto del lote continuó. Revisar logs.",
  renovacion_vencida: "Cobro ya alcanzado sin importe confirmado: no se hace PUT. Seguir el procedimiento manual del runbook.",
  cobro_inminente: "Cobro en minutos: no se modifica el importe. Seguir el procedimiento manual del runbook.",
  proxima_fecha_cambio: "MP cambió la próxima fecha de cobro durante la corrida: período incierto, sin PUT. Verificar en MP.",
  estado_mp_cambio: "MP cambió el estado de la suscripción durante la corrida: sin PUT. Verificar en MP.",
};

function aviso(texto) {
  return `${texto}\n`;
}

function ultimos(id, n = 6) {
  const s = String(id || "");
  return s ? `…${s.slice(-n)}` : "(sin id)";
}

function horasTexto(horas) {
  if (!Number.isFinite(horas)) return "fecha desconocida";
  if (horas < 0) return `vencida hace ${Math.abs(horas).toFixed(1)} h`;
  return `en ${horas.toFixed(1)} h`;
}

function direccion(esperado, remoto) {
  const e = Number(esperado);
  const r = Number(remoto);
  if (!Number.isFinite(e) || !Number.isFinite(r) || Math.abs(e - r) < 0.01) return "";
  return r > e ? " (MP cobraría DE MÁS al usuario)" : " (MP cobraría DE MENOS)";
}

function lineaEvento(evento) {
  const f = evento.fila || {};
  if (evento.tipo === "sistema") {
    return `[SISTEMA] ${f.codigo_error}\n  Acción: ${ACCION_SUGERIDA[f.codigo_error] || "Revisar logs del cron."}`;
  }
  const etiqueta = evento.tipo === "resuelta" ? "RESUELTA" : evento.tipo === "vencida" ? "VENCIDA" : ETIQUETA_NIVEL[evento.nivel] || "AVISO";
  const lineas = [`[${etiqueta}] Suscripción ${String(f.suscripcion_id || "").slice(0, 8)}… · MP ${ultimos(evento.preapprovalId)}`];
  if (f.renovacion_ref) lineas.push(`  Cobro: ${f.renovacion_ref} (${horasTexto(evento.horasHasta)})`);
  if (f.codigo_error) lineas.push(`  Problema: ${f.codigo_error} · intentos PUT ${f.intentos ?? 0}/${evento.maxIntentos ?? "?"}`);
  if (f.importe_ars_nuevo != null || f.importe_remoto_ars != null) {
    lineas.push(
      `  Importe esperado: ${f.importe_ars_nuevo ?? "n/d"} · importe en MP: ${f.importe_remoto_ars ?? "n/d"}${direccion(f.importe_ars_nuevo, f.importe_remoto_ars)}`,
    );
  }
  lineas.push(`  Estado: ${f.estado_final}${f.proximo_intento_en ? ` · próximo reintento ≥ ${f.proximo_intento_en}` : ""}`);
  const sugerencia = ACCION_SUGERIDA[f.codigo_error];
  if (sugerencia && evento.tipo === "incidencia") lineas.push(`  Acción: ${sugerencia}`);
  return lineas.join("\n");
}

/** Arma asunto y cuerpo (texto plano). Pura: sin red ni entorno. */
export function construirAlertaAdmin(eventos, { ahora = new Date() } = {}) {
  const urgentes = eventos.filter(
    (e) => e.tipo === "incidencia" && (e.nivel === "critico" || e.nivel === "agotado"),
  ).length;
  const asunto = `[Enflora][Plus] Renovación ARS: ${eventos.length} novedad(es)${urgentes ? ` · ${urgentes} crítica(s)` : ""}`;
  const cuerpo = [
    aviso(`Reporte del cron de renovación ARS — ${ahora.toISOString()}`),
    ...eventos.map((e) => `${lineaEvento(e)}\n`),
    "Esta alerta no pausa, cancela ni modifica la suscripción. Mercado Pago debita el importe",
    "vigente en la fecha de cobro aunque aquí figure 'bloqueado'. Ver auditorias/PLAN-420-SEGURIDAD-OPERATIVA-RENOVACIONES.md.",
  ].join("\n");
  return { asunto, cuerpo };
}

export async function enviarCorreoResend({ from, to, subject, text, apiKey }) {
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to: [to], subject, text });
  if (error) throw new Error(error.name || "resend_error");
}

/**
 * Envía el resumen por correo. Devuelve { enviada, motivo? } sin lanzar: una alerta que no
 * sale nunca debe romper el cron. Si no está configurado, queda log sin datos sensibles.
 */
export async function enviarAlertaAdmin(eventos, { env = process.env, ahora = new Date(), enviarCorreo = enviarCorreoResend } = {}) {
  if (!eventos?.length) return { enviada: false, motivo: "sin_eventos" };
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.RESEND_FROM_EMAIL || "").trim();
  const to = String(env.PLUS_ALERT_EMAIL || env.CONTACT_EMAIL || "").trim();
  if (!apiKey || !from || !to) {
    console.error("[plus-renovacion] alerta_sin_canal_configurado", { eventos: eventos.length });
    return { enviada: false, motivo: "sin_configuracion" };
  }
  const { asunto, cuerpo } = construirAlertaAdmin(eventos, { ahora });
  try {
    await enviarCorreo({ from, to, subject: asunto, text: cuerpo, apiKey });
    return { enviada: true };
  } catch (error) {
    console.error("[plus-renovacion] alerta_envio_fallido", error instanceof Error ? error.message : "desconocido");
    return { enviada: false, motivo: "envio_fallido" };
  }
}
