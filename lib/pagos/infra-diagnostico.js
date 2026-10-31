import { leerAmbientePagos, leerRecepcionPagos, urlPublica } from "./ambiente.js";

/** Diagnóstico sin secretos para checklist operativo (solo lectura de env). */
export function diagnosticarInfraPagoUnico(env = process.env) {
  const token = String(env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
  const prefijoToken = token.startsWith("TEST-")
    ? "TEST"
    : token.startsWith("APP_USR-")
      ? "APP_USR"
      : null;
  const ambienteCobro = leerAmbientePagos(env);
  const ambienteRecepcion = leerRecepcionPagos(env);
  const webhookSecret = String(env.MERCADOPAGO_WEBHOOK_SECRET || "").trim();
  const cronSecret = String(env.CRON_SECRET || "").trim();
  const supabaseUrl = Boolean(env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRole = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    accessTokenPresente: token.length > 0,
    prefijoToken,
    mercadopagoEnv: String(env.MERCADOPAGO_ENV || "").trim() || null,
    paymentsLiveEnabled: env.PAYMENTS_LIVE_ENABLED === "true",
    cobroNuevoPermitido: ambienteCobro.ok,
    codigoCobro: ambienteCobro.ok ? null : ambienteCobro.codigo,
    recepcionPagosOk: ambienteRecepcion.ok,
    codigoRecepcion: ambienteRecepcion.ok ? null : ambienteRecepcion.codigo,
    webhookSecretConfigurado: webhookSecret.length > 0,
    cronSecretConfigurado: cronSecret.length > 0,
    appUrl: urlPublica(env),
    webhookUrlEsperada: `${urlPublica(env)}/api/mercadopago/webhook`,
    supabaseUrlConfigurada: supabaseUrl,
    supabaseServiceRoleConfigurada: serviceRole,
    nodeEnv: env.NODE_ENV || "development",
  };
}

export const PASOS_MANUALES_INFRA = [
  {
    id: "sql-migracion",
    titulo: "Migración Supabase pagos-licencias",
    verificacion:
      "En SQL Editor: comprobar tablas ciclos_cultivo, pagos, licencias_cultivo, pagos_notificaciones y RPC reservar_pago_cultivo, guardar_checkout_pago, aplicar_resultado_pago, licencia_habilita_ciclo.",
  },
  {
    id: "webhook-mp",
    titulo: "Webhook Orders en Mercado Pago",
    verificacion:
      "Tus integraciones → Webhooks → evento Order → URL HTTPS /api/mercadopago/webhook con secreto copiado a MERCADOPAGO_WEBHOOK_SECRET del mismo ambiente.",
  },
  {
    id: "vercel-cron",
    titulo: "Cron Vercel",
    verificacion: "vercel.json incluye /api/pagos/reconciliar (min 15) y CRON_SECRET en producción.",
  },
  {
    id: "credenciales-separadas",
    titulo: "Credenciales prueba vs producción",
    verificacion:
      "Tokens y webhook secret de prueba solo en local/preview; producción con par productivo distinto y MERCADOPAGO_ENV=produccion.",
  },
];
