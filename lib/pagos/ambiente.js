export function leerAmbientePagos(env = process.env) {
  const ambiente = String(env.MERCADOPAGO_ENV || "").trim();
  const cobrosReales = env.PAYMENTS_LIVE_ENABLED === "true";
  const desarrollo = env.NODE_ENV !== "production";
  const pruebasConfirmadas = env.MERCADOPAGO_PRUEBAS_CONFIRMADAS === "true";

  if (desarrollo) {
    if (cobrosReales) return { ok: false, codigo: "cobros_reales_bloqueados" };
    if (ambiente !== "prueba") return { ok: false, codigo: "ambiente_prueba_requerido" };
    if (!pruebasConfirmadas) return { ok: false, codigo: "pruebas_no_confirmadas" };
    return { ok: true, ambiente: "prueba", cobrosReales: false };
  }

  if (ambiente === "prueba") {
    if (cobrosReales) return { ok: false, codigo: "ambiente_contradictorio" };
    return { ok: true, ambiente: "prueba", cobrosReales: false };
  }

  if (ambiente === "produccion") {
    if (!cobrosReales) return { ok: false, codigo: "cobros_reales_desactivados" };
    return { ok: true, ambiente: "produccion", cobrosReales: true };
  }

  return { ok: false, codigo: "ambiente_no_declarado" };
}

export function leerRecepcionPagos(env = process.env) {
  const ambiente = String(env.MERCADOPAGO_ENV || "").trim();
  const desarrollo = env.NODE_ENV !== "production";
  const pruebasConfirmadas = env.MERCADOPAGO_PRUEBAS_CONFIRMADAS === "true";
  const cobrosReales = env.PAYMENTS_LIVE_ENABLED === "true";

  if (ambiente !== "prueba" && ambiente !== "produccion") {
    return { ok: false, codigo: "ambiente_no_declarado" };
  }
  if (desarrollo) {
    if (ambiente !== "prueba") return { ok: false, codigo: "ambiente_prueba_requerido" };
    if (!pruebasConfirmadas) return { ok: false, codigo: "pruebas_no_confirmadas" };
  }
  if (ambiente === "prueba" && cobrosReales) return { ok: false, codigo: "ambiente_contradictorio" };
  return { ok: true, ambiente, cobrosReales: ambiente === "produccion" && cobrosReales };
}

const UUID_PILOTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Restricción temporal de checkouts nuevos en Production a usuarios piloto.
 * Solo aplica a quien inicia compras; no debe usarse en webhooks, cancelaciones ni reconciliación.
 * Variable definida pero sin UUID válidos: nadie queda autorizado.
 */
export function autorizarCompraPiloto(usuarioId, env = process.env) {
  const configurada = String(env.PAYMENTS_PILOT_USER_IDS || "").trim();
  if (env.NODE_ENV !== "production" || !configurada) return { ok: true };

  const autorizados = configurada
    .split(/[\s,;]+/)
    .map((id) => id.toLowerCase())
    .filter((id) => UUID_PILOTO.test(id));
  const solicitante = String(usuarioId || "").trim().toLowerCase();
  if (UUID_PILOTO.test(solicitante) && autorizados.includes(solicitante)) return { ok: true };
  return { ok: false, codigo: "piloto_no_autorizado" };
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function correoPayerOrden({ ambiente, emailUsuario = "", env = process.env } = {}) {
  if (ambiente !== "prueba") {
    const correo = String(emailUsuario || "").trim();
    return { email: CORREO.test(correo) ? correo : "" };
  }

  const prueba = String(env.MERCADOPAGO_TEST_BUYER_EMAIL || "").trim();
  if (!prueba) return { email: "" };
  if (!CORREO.test(prueba)) return { email: "", codigo: "comprador_prueba_invalido" };
  return { email: prueba };
}

export function urlPublica(env = process.env) {
  const explicita = String(env.APP_URL || "").trim().replace(/\/$/, "");
  if (explicita) return explicita;
  if (env.NODE_ENV !== "production") return "http://localhost:3000";
  return "https://enflora.com.ar";
}
