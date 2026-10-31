import "server-only";

import { leerRecepcionPagos } from "@/lib/pagos/ambiente";

const BASE = "https://api.mercadopago.com";

function tokenAcceso() {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!t) throw new Error("falta_access_token");
  return t;
}

function headers(idempotencyKey) {
  const h = {
    Authorization: `Bearer ${tokenAcceso()}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) h["X-Idempotency-Key"] = idempotencyKey;
  return h;
}

async function parsear(respuesta) {
  const texto = await respuesta.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  if (!respuesta.ok) {
    const error = new Error(json?.message || respuesta.statusText || "mp_error");
    error.status = respuesta.status;
    error.cuerpo = json;
    throw error;
  }
  return json;
}

/**
 * @param {{ fetchFn?: typeof fetch, idempotencyKey?: string }} opts
 */
export async function crearPreapprovalPlus(body, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const ambiente = leerRecepcionPagos();
  if (!ambiente.ok) {
    const error = new Error(ambiente.codigo);
    error.codigo = ambiente.codigo;
    throw error;
  }
  const respuesta = await fetchFn(`${BASE}/preapproval`, {
    method: "POST",
    headers: headers(opts.idempotencyKey),
    body: JSON.stringify(body),
  });
  return parsear(respuesta);
}

export async function obtenerPreapproval(preapprovalId, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const id = String(preapprovalId || "").trim();
  if (!id) throw new Error("preapproval_ausente");
  const respuesta = await fetchFn(`${BASE}/preapproval/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: headers(),
  });
  return parsear(respuesta);
}

export async function actualizarPreapproval(preapprovalId, body, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const id = String(preapprovalId || "").trim();
  if (!id) throw new Error("preapproval_ausente");
  const respuesta = await fetchFn(`${BASE}/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: headers(opts.idempotencyKey),
    body: JSON.stringify(body),
  });
  return parsear(respuesta);
}

export async function obtenerAuthorizedPayment(paymentId, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const id = String(paymentId || "").trim();
  if (!id) throw new Error("pago_ausente");
  const respuesta = await fetchFn(`${BASE}/authorized_payments/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: headers(),
  });
  return parsear(respuesta);
}

export async function buscarAuthorizedPaymentsPreapproval(preapprovalId, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const id = String(preapprovalId || "").trim();
  if (!id) throw new Error("preapproval_ausente");
  const url = `${BASE}/authorized_payments/search?preapproval_id=${encodeURIComponent(id)}`;
  const respuesta = await fetchFn(url, { method: "GET", headers: headers() });
  return parsear(respuesta);
}

/** GET /users/{id|me}: solo lectura (verificación de credenciales de prueba). */
export async function obtenerUsuarioMercadoPago(usuarioId, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const id = String(usuarioId || "").trim();
  if (!id) throw new Error("usuario_ausente");
  const respuesta = await fetchFn(`${BASE}/users/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: headers(),
  });
  return parsear(respuesta);
}

export async function obtenerPagoMercadoPago(paymentId, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const id = String(paymentId || "").trim();
  if (!id) throw new Error("pago_ausente");
  const respuesta = await fetchFn(`${BASE}/v1/payments/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: headers(),
  });
  return parsear(respuesta);
}
