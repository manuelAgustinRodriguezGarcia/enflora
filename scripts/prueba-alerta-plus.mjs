/**
 * Prueba aislada de las alertas administrativas de Plus (PLAN 420).
 *
 * Envía UN correo de prueba a PLUS_ALERT_EMAIL desde RESEND_FROM_EMAIL usando la misma ruta
 * de código que el cron (enviarAlertaAdmin). No toca Supabase, Mercado Pago, el cron ni
 * suscripciones. No imprime valores de variables.
 *
 * Uso:
 *   node --no-warnings --experimental-detect-module --import ./tests/register-alias.mjs \
 *     --env-file=.env scripts/prueba-alerta-plus.mjs
 */
import { Resend } from "resend";
import { enviarAlertaAdmin } from "../lib/pagos/plus/alertas-renovacion.js";

const requeridas = ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "PLUS_ALERT_EMAIL"];
const faltantes = requeridas.filter((k) => !String(process.env[k] || "").trim());
if (faltantes.length) {
  console.error(`Faltan variables: ${faltantes.join(", ")}. No se envió nada.`);
  process.exit(1);
}

const ahora = new Date();
let resendId = null;
let errorResend = null;

// Misma construcción de cuerpo que el cron; solo se rotula el asunto como PRUEBA y se captura el id.
async function enviarCorreo({ from, to, subject, text, apiKey }) {
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: `[PRUEBA][ENFLORA] ${subject}`,
    text: `*** PRUEBA DE ALERTAS DE ENFLORA — no es una incidencia real ***\n\n${text}`,
  });
  if (error) {
    errorResend = { nombre: error.name || "desconocido", mensaje: error.message || "" };
    throw new Error(error.name || "resend_error");
  }
  resendId = data?.id ?? null;
}

const resultado = await enviarAlertaAdmin(
  [{ tipo: "sistema", nivel: "aviso", fila: { codigo_error: "prueba_alertas_admin", estado_final: "pendiente" }, horasHasta: null }],
  { ahora, enviarCorreo },
);

console.log(JSON.stringify({ enviada: resultado.enviada, motivo: resultado.motivo ?? null, resendId, errorResend }, null, 2));
process.exit(resultado.enviada ? 0 : 1);
