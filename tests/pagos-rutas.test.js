import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { procesarWebhookOrdenEntrada } from "../lib/pagos/procesar-webhook-orden.js";

function firmar({ secreto, dataId, requestId, ts }) {
  const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", secreto).update(manifiesto).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

const envPrueba = {
  NODE_ENV: "development",
  MERCADOPAGO_ENV: "prueba",
  MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
  PAYMENTS_LIVE_ENABLED: "",
};

test("webhook rechaza firma incorrecta (route)", async () => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "secreto-ruta-test";
  Object.assign(process.env, envPrueba);

  const { POST } = await import("../app/api/mercadopago/webhook/route.js");
  const dataId = "ORDTEST123";
  const request = new Request(
    `http://localhost/api/mercadopago/webhook?data.id=${dataId}&type=order`,
    {
      method: "POST",
      headers: {
        "x-signature": "ts=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000",
        "x-request-id": "req-mal",
      },
      body: JSON.stringify({ data: { id: dataId }, live_mode: false }),
    },
  );
  const respuesta = await POST(request);
  assert.equal(respuesta.status, 401);
});

test("webhook sin secreto responde 503 (route)", async () => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "";
  Object.assign(process.env, envPrueba);

  const { POST } = await import("../app/api/mercadopago/webhook/route.js");
  const request = new Request("http://localhost/api/mercadopago/webhook?data.id=x&type=order", {
    method: "POST",
    headers: { "x-signature": "ts=1,v1=a", "x-request-id": "r1" },
    body: "{}",
  });
  const respuesta = await POST(request);
  assert.equal(respuesta.status, 503);
});

test("procesador acredita con order remota mockeada", async () => {
  const secreto = "secreto-procesador-test";
  const dataId = "ORDTST01M5H782T0920QWKNWCAZ7D2AG";
  const requestId = "req-webhook-int";
  const ts = "1710000000";
  const pagoId = "11111111-1111-4111-8111-111111111111";
  const orden = {
    id: dataId,
    external_reference: pagoId,
    currency: "ARS",
    status: "processed",
    status_detail: "accredited",
    total_amount: "46350.00",
    user_id: "3784911016",
    transactions: {
      payments: [{ status: "processed", status_detail: "accredited", reference_id: "184447243907" }],
    },
  };

  const rpcCalls = [];
  const resultado = await procesarWebhookOrdenEntrada(
    {
      dataId,
      type: "order",
      topic: null,
      xSignature: firmar({ secreto, dataId, requestId, ts }),
      xRequestId: requestId,
      aviso: { data: { id: dataId }, live_mode: false },
      secret: secreto,
      env: envPrueba,
    },
    {
      leerRecepcionPagos: () => ({ ok: true, ambiente: "prueba", cobrosReales: false }),
      clientePagos: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: pagoId,
                  estado: "pendiente",
                  order_id: dataId,
                  importe_ars: "46350.00",
                  ambiente: "prueba",
                  external_reference: pagoId,
                  vendedor_mp: "3784911016",
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
      obtenerOrden: async () => orden,
      aplicarEvaluacion: async (params) => {
        rpcCalls.push(params);
        return { ok: true, duplicada: false, estado: "acreditado" };
      },
    },
  );

  assert.equal(resultado.status, 200);
  assert.equal(resultado.body.ok, true);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].clave, requestId);
});

test("procesador ignora evento payment sin validar firma previa", async () => {
  const secreto = "secreto-ignorar";
  const dataId = "ORD123";
  const requestId = "req-1";
  const ts = "1710000000";
  const resultado = await procesarWebhookOrdenEntrada({
    dataId,
    type: "payment",
    topic: null,
    xSignature: firmar({ secreto, dataId, requestId, ts }),
    xRequestId: requestId,
    secret: secreto,
    env: envPrueba,
  });
  assert.equal(resultado.status, 200);
  assert.equal(resultado.body.ignorado, true);
});

test("reconciliar exige autorización en producción sin cron", async () => {
  process.env.NODE_ENV = "production";
  process.env.CRON_SECRET = "cron-test-secreto";
  process.env.MERCADOPAGO_ENV = "prueba";
  process.env.MERCADOPAGO_PRUEBAS_CONFIRMADAS = "true";

  const { GET } = await import("../app/api/pagos/reconciliar/route.js");
  const respuesta = await GET(new Request("http://localhost/api/pagos/reconciliar"));
  assert.equal(respuesta.status, 401);
});

test("reconciliar rechaza x-vercel-cron sin Bearer válido", async () => {
  process.env.NODE_ENV = "production";
  process.env.CRON_SECRET = "cron-test-secreto";
  process.env.MERCADOPAGO_ENV = "prueba";
  process.env.MERCADOPAGO_PRUEBAS_CONFIRMADAS = "true";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";

  const { GET } = await import("../app/api/pagos/reconciliar/route.js");
  const respuesta = await GET(
    new Request("http://localhost/api/pagos/reconciliar", {
      headers: { "x-vercel-cron": "1" },
    }),
  );
  assert.equal(respuesta.status, 401);
});

test("diagnóstico infra no expone secretos", async () => {
  const { diagnosticarInfraPagoUnico } = await import("../lib/pagos/infra-diagnostico.js");
  const estado = diagnosticarInfraPagoUnico({
    NODE_ENV: "development",
    MERCADOPAGO_ACCESS_TOKEN: "APP_USR-test",
    MERCADOPAGO_ENV: "prueba",
    MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
    MERCADOPAGO_WEBHOOK_SECRET: "secreto-oculto",
    CRON_SECRET: "cron-oculto",
    PAYMENTS_LIVE_ENABLED: "",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "presente",
  });
  assert.equal(estado.webhookSecretConfigurado, true);
  assert.equal(JSON.stringify(estado).includes("secreto-oculto"), false);
  assert.equal(estado.paymentsLiveEnabled, false);
});
