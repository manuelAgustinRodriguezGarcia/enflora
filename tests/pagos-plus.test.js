import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { plusSuscripcionHabilita } from "../lib/pagos/plus/cobertura.js";
import { ESTADOS_PLUS_INTERNO } from "../lib/pagos/plus/constantes.js";
import { evaluarActualizacionArsPreRenovacion } from "../lib/pagos/plus/renovacion-ars.js";
import { gateAltaPlus, prepararAltaPlus, sincronizarImportePreapproval } from "../lib/pagos/plus/suscripcion-servidor.js";
import { consultarPlusActivo } from "../lib/pagos/plus/leer-plus-activo.js";
import {
  aplicarAuthorizedPaymentRemoto,
  aplicarPreapprovalRemoto,
} from "../lib/pagos/plus/aplicar-webhook-suscripcion.js";
import { eventoSuscripcionWebhook } from "../lib/pagos/evento-webhook.js";
import { procesarWebhookSuscripcionEntrada } from "../lib/pagos/procesar-webhook-suscripcion.js";

const USUARIO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTRA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SUB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const envPrueba = {
  NODE_ENV: "development",
  MERCADOPAGO_ENV: "prueba",
  MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
  PAYMENTS_LIVE_ENABLED: "",
  MERCADOPAGO_TEST_BUYER_EMAIL: "test_user_123456@testuser.com",
};

const cotizacionOk = {
  ok: true,
  cotizacion: {
    venta: 1200000,
    tipo: "billete_vendedor",
    punta: "vendedor",
    publicadaEn: new Date().toISOString(),
    fuente: "Banco Nación",
  },
  edadDias: 0.5,
};

function firmar({ secreto, dataId, requestId, ts }) {
  const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", secreto).update(manifiesto).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

test("gateAltaPlus bloquea producción sin PLUS_LIVE_ENABLED", () => {
  const gate = gateAltaPlus({
    NODE_ENV: "production",
    MERCADOPAGO_ENV: "produccion",
    PAYMENTS_LIVE_ENABLED: "true",
    PLUS_LIVE_ENABLED: "",
  });
  assert.equal(gate.ok, false);
  assert.equal(gate.codigo, "plus_produccion_desactivado");
});

test("prepararAltaPlus simulado no llama a Mercado Pago", async () => {
  const resultado = await prepararAltaPlus({
    supabase: {},
    usuarioId: USUARIO,
    emailUsuario: "test@example.com",
    env: envPrueba,
    ejecutarMp: false,
  });
  if (!resultado.ok && resultado.codigo === "cotizacion_no_disponible") {
    return;
  }
  assert.equal(resultado.ok, true);
  assert.equal(resultado.simulado, true);
  assert.ok(resultado.suscripcionId);
  assert.ok(resultado.cuerpoMp?.auto_recurring);
});

test("plusSuscripcionHabilita rechaza pendiente de checkout", () => {
  const habilita = plusSuscripcionHabilita({
    suscripcion: {
      usuario_id: USUARIO,
      ambiente: "prueba",
      estado_interno: ESTADOS_PLUS_INTERNO.pendienteCheckout,
      periodo_vigente_hasta: new Date(Date.now() + 86400000).toISOString(),
    },
    ambiente: "prueba",
    usuarioId: USUARIO,
    pagoVigenteAcreditado: true,
  });
  assert.equal(habilita, false);
});

test("plusSuscripcionHabilita exige pago acreditado en período", () => {
  const habilita = plusSuscripcionHabilita({
    suscripcion: {
      usuario_id: USUARIO,
      ambiente: "prueba",
      estado_interno: ESTADOS_PLUS_INTERNO.activa,
      periodo_vigente_hasta: new Date(Date.now() + 86400000).toISOString(),
    },
    ambiente: "prueba",
    usuarioId: USUARIO,
    pagoVigenteAcreditado: false,
  });
  assert.equal(habilita, false);
});

test("plusSuscripcionHabilita activa con pago vigente", () => {
  const habilita = plusSuscripcionHabilita({
    suscripcion: {
      usuario_id: USUARIO,
      ambiente: "prueba",
      estado_interno: ESTADOS_PLUS_INTERNO.activa,
      periodo_vigente_hasta: new Date(Date.now() + 86400000).toISOString(),
    },
    ambiente: "prueba",
    usuarioId: USUARIO,
    pagoVigenteAcreditado: true,
  });
  assert.equal(habilita, true);
});

test("plusSuscripcionHabilita rechaza usuario distinto", () => {
  const habilita = plusSuscripcionHabilita({
    suscripcion: {
      usuario_id: OTRA,
      ambiente: "prueba",
      estado_interno: ESTADOS_PLUS_INTERNO.activa,
      periodo_vigente_hasta: new Date(Date.now() + 86400000).toISOString(),
    },
    ambiente: "prueba",
    usuarioId: USUARIO,
    pagoVigenteAcreditado: true,
  });
  assert.equal(habilita, false);
});

test("plusSuscripcionHabilita rechaza ambiente cruzado", () => {
  const habilita = plusSuscripcionHabilita({
    suscripcion: {
      usuario_id: USUARIO,
      ambiente: "produccion",
      estado_interno: ESTADOS_PLUS_INTERNO.activa,
      periodo_vigente_hasta: new Date(Date.now() + 86400000).toISOString(),
    },
    ambiente: "prueba",
    usuarioId: USUARIO,
    pagoVigenteAcreditado: true,
  });
  assert.equal(habilita, false);
});

test("plusSuscripcionHabilita pausada y cancelada sin fin de período", () => {
  assert.equal(
    plusSuscripcionHabilita({
      suscripcion: {
        usuario_id: USUARIO,
        ambiente: "prueba",
        estado_interno: ESTADOS_PLUS_INTERNO.pausada,
        periodo_vigente_hasta: new Date(Date.now() + 86400000).toISOString(),
      },
      ambiente: "prueba",
      usuarioId: USUARIO,
      pagoVigenteAcreditado: true,
    }),
    false,
  );
  assert.equal(
    plusSuscripcionHabilita({
      suscripcion: {
        usuario_id: USUARIO,
        ambiente: "prueba",
        estado_interno: ESTADOS_PLUS_INTERNO.cancelada,
        vigente_hasta_fin_periodo: false,
        periodo_vigente_hasta: new Date(Date.now() + 86400000).toISOString(),
      },
      ambiente: "prueba",
      usuarioId: USUARIO,
      pagoVigenteAcreditado: true,
    }),
    false,
  );
});

test("plusSuscripcionHabilita cancelada mantiene período pagado", () => {
  const habilita = plusSuscripcionHabilita({
    suscripcion: {
      usuario_id: USUARIO,
      ambiente: "prueba",
      estado_interno: ESTADOS_PLUS_INTERNO.cancelada,
      vigente_hasta_fin_periodo: true,
      periodo_vigente_hasta: new Date(Date.now() + 86400000).toISOString(),
    },
    ambiente: "prueba",
    usuarioId: USUARIO,
    pagoVigenteAcreditado: true,
  });
  assert.equal(habilita, true);
});

test("evaluarActualizacionArsPreRenovacion bloquea sin cotización en ventana", () => {
  const proxima = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const resultado = evaluarActualizacionArsPreRenovacion({
    suscripcion: {
      preapproval_id: "pre-1",
      estado_interno: "activa",
      proxima_renovacion: proxima,
    },
    cotizacion: { ok: false, codigo: "cotizacion_no_disponible" },
  });
  assert.equal(resultado.accion, "bloqueado");
  assert.equal(resultado.bloqueoComercial, true);
});

test("evaluarActualizacionArsPreRenovacion propone PUT en ventana 72h", () => {
  const proxima = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const resultado = evaluarActualizacionArsPreRenovacion({
    suscripcion: {
      preapproval_id: "pre-1",
      estado_interno: "activa",
      proxima_renovacion: proxima,
    },
    cotizacion: cotizacionOk,
  });
  assert.equal(resultado.accion, "put_preapproval");
  assert.equal(resultado.importeDecimal, "504.00");
});

test("sincronizarImportePreapproval confirma GET remoto", async () => {
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST_TOKEN_PLUS";
  Object.assign(process.env, envPrueba);
  const resultado = await sincronizarImportePreapproval({
    preapprovalId: "pre-123",
    importeDecimal: "5040.00",
    fetchFn: async (url, init) => {
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ id: "pre-123" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          id: "pre-123",
          auto_recurring: { transaction_amount: 5040 },
        }),
        { status: 200 },
      );
    },
  });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.confirmado, true);
});

test("sincronizarImportePreapproval detecta PUT no confirmado", async () => {
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST_TOKEN_PLUS";
  Object.assign(process.env, envPrueba);
  const resultado = await sincronizarImportePreapproval({
    preapprovalId: "pre-123",
    importeDecimal: "5040.00",
    fetchFn: async (url, init) => {
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ id: "pre-123" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          id: "pre-123",
          auto_recurring: { transaction_amount: 4000 },
        }),
        { status: 200 },
      );
    },
  });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.codigo, "put_no_confirmado");
});

test("consultarPlusActivo sin tabla devuelve dbDisponible false", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({
            data: null,
            error: { message: "relation plus_suscripciones does not exist" },
          });
        },
      };
    },
  };
  const resultado = await consultarPlusActivo(supabase, USUARIO, envPrueba);
  assert.equal(resultado.activo, false);
  assert.equal(resultado.dbDisponible, false);
});

test("consultarPlusActivo habilita con pago acreditado vigente", async () => {
  const hasta = new Date(Date.now() + 5 * 86400000).toISOString();
  const supabase = {
    from(tabla) {
      if (tabla === "plus_suscripciones") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return Promise.resolve({
              data: [
                {
                  id: SUB_ID,
                  usuario_id: USUARIO,
                  ambiente: "prueba",
                  estado_interno: "activa",
                  periodo_vigente_hasta: hasta,
                  vigente_hasta_fin_periodo: false,
                },
              ],
              error: null,
            });
          },
        };
      }
      if (tabla === "plus_pagos_recurrentes") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return Promise.resolve({
              data: [{ estado_interno: "acreditado", periodo_hasta: hasta }],
              error: null,
            });
          },
        };
      }
      throw new Error(`tabla inesperada ${tabla}`);
    },
  };
  const resultado = await consultarPlusActivo(supabase, USUARIO, envPrueba);
  assert.equal(resultado.activo, true);
  assert.equal(resultado.dbDisponible, true);
});

test("eventoSuscripcionWebhook reconoce tópicos Plus", () => {
  assert.equal(eventoSuscripcionWebhook({ type: "subscription_preapproval" }), true);
  assert.equal(eventoSuscripcionWebhook({ type: "subscription_authorized_payment" }), true);
  assert.equal(eventoSuscripcionWebhook({ type: "order" }), false);
});

test("webhook Plus duplicado responde 200 duplicada", async () => {
  const secreto = "secreto-plus";
  const dataId = "PRE123";
  const requestId = "req-dup-plus";
  const ts = "1710000000";
  const resultado = await procesarWebhookSuscripcionEntrada(
    {
      dataId,
      type: "subscription_preapproval",
      xSignature: firmar({ secreto, dataId, requestId, ts }),
      xRequestId: requestId,
      aviso: { data: { id: dataId }, live_mode: false },
      secret: secreto,
      env: envPrueba,
    },
    {
      leerRecepcionPagos: () => ({ ok: true, ambiente: "prueba" }),
      clientePagos: () => ({
        from: (tabla) => {
          if (tabla === "plus_notificaciones") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { id: "n1", aplicada: true }, error: null }),
                }),
              }),
            };
          }
          throw new Error(`no esperado ${tabla}`);
        },
      }),
    },
  );
  assert.equal(resultado.status, 200);
  assert.equal(resultado.body.duplicada, true);
});

test("aplicarPreapprovalRemoto rechaza titularidad distinta", async () => {
  const resultado = await aplicarPreapprovalRemoto({
    supabase: { from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) },
    suscripcion: {
      id: SUB_ID,
      usuario_id: USUARIO,
      ambiente: "prueba",
      preapproval_id: "PRE-A",
      estado_interno: "activa",
    },
    remoto: { id: "PRE-B", status: "authorized" },
    ambiente: "prueba",
  });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.codigo, "titularidad_preapproval");
});

test("aplicarAuthorizedPaymentRemoto acredita y extiende vigencia", async () => {
  const updates = [];
  const supabase = {
    from(tabla) {
      if (tabla === "plus_pagos_recurrentes") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: (fila) => ({
            select: () => ({
              maybeSingle: async () => {
                updates.push(["pago", fila]);
                return { data: { id: "pago-1" }, error: null };
              },
            }),
          }),
        };
      }
      if (tabla === "plus_suscripciones") {
        return {
          update: (fila) => ({
            eq: async () => {
              updates.push(["sub", fila]);
              return { error: null };
            },
          }),
        };
      }
      if (tabla === "plus_notificaciones") {
        return { upsert: async () => ({ error: null }) };
      }
      throw new Error(tabla);
    },
  };

  const resultado = await aplicarAuthorizedPaymentRemoto({
    supabase,
    suscripcion: {
      id: SUB_ID,
      usuario_id: USUARIO,
      ambiente: "prueba",
      preapproval_id: "PRE-A",
    },
    remoto: {
      id: "AUTH-1",
      preapproval_id: "PRE-A",
      status: "approved",
      status_detail: "accredited",
      transaction_amount: 5040,
      date_created: "2026-01-01T12:00:00.000Z",
    },
    ambiente: "prueba",
  });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.estadoInternoPago, "acreditado");
  assert.ok(updates.some(([k, v]) => k === "sub" && v.periodo_vigente_hasta));
});

test("aplicarAuthorizedPaymentRemoto marca past_due si rechazado", async () => {
  const updates = [];
  const supabase = {
    from(tabla) {
      if (tabla === "plus_pagos_recurrentes") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: "p2" }, error: null }),
            }),
          }),
        };
      }
      if (tabla === "plus_suscripciones") {
        return {
          update: (fila) => ({
            eq: async () => {
              updates.push(fila);
              return { error: null };
            },
          }),
        };
      }
      if (tabla === "plus_notificaciones") {
        return { upsert: async () => ({ error: null }) };
      }
      throw new Error(tabla);
    },
  };
  const resultado = await aplicarAuthorizedPaymentRemoto({
    supabase,
    suscripcion: {
      id: SUB_ID,
      usuario_id: USUARIO,
      ambiente: "prueba",
      preapproval_id: "PRE-A",
    },
    remoto: {
      id: "AUTH-2",
      preapproval_id: "PRE-A",
      status: "rejected",
      transaction_amount: 5040,
    },
    ambiente: "prueba",
  });
  assert.equal(resultado.estadoInternoPago, "rechazado");
  assert.ok(updates.some((u) => u.estado_interno === "past_due"));
});

test("ejecutarCronRenovacionImportePlus omite fuera de ventana 72h", async () => {
  const { ejecutarCronRenovacionImportePlus } = await import(
    "../lib/pagos/plus/cron-renovacion-ars.js"
  );
  const proxima = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
  const supabase = {
    from(tabla) {
      if (tabla === "plus_suscripciones") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          not() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return Promise.resolve({
              data: [
                {
                  id: SUB_ID,
                  preapproval_id: "PRE-1",
                  estado_interno: "activa",
                  proxima_renovacion: proxima,
                  importe_ars: "5000",
                  ambiente: "prueba",
                },
              ],
              error: null,
            });
          },
        };
      }
      if (tabla === "plus_cotizacion_auditoria") {
        const vacia = {
          select: () => vacia,
          eq: () => vacia,
          not: () => vacia,
          gte: () => vacia,
          then: (resolve) => resolve({ data: [], error: null }),
        };
        return vacia;
      }
      throw new Error(tabla);
    },
  };
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST_TOKEN_PLUS";
  const resultado = await ejecutarCronRenovacionImportePlus({
    notificar: async () => ({ enviada: false }),
    supabase,
    env: envPrueba,
    obtenerCotizacion: async () => cotizacionOk,
    fetchFn: async () =>
      new Response(
        JSON.stringify({ status: "authorized", next_payment_date: proxima, auto_recurring: { transaction_amount: 5000 } }),
        { status: 200 },
      ),
  });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.omitidas, 1);
  assert.equal(resultado.puts, 0);
});

test("cancelarSuscripcionPlus actualiza estado local", async () => {
  const { cancelarSuscripcionPlus } = await import("../lib/pagos/plus/gestion-servidor.js");
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST";
  Object.assign(process.env, envPrueba);
  let actualizado = null;
  const supabase = {
    from(tabla) {
      if (tabla !== "plus_suscripciones") throw new Error(tabla);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({
          data: {
            id: SUB_ID,
            usuario_id: USUARIO,
            ambiente: "prueba",
            preapproval_id: "PRE-C",
            estado_interno: "activa",
            periodo_vigente_hasta: new Date(Date.now() + 86400000).toISOString(),
          },
          error: null,
        }),
        update: (fila) => ({
          eq: async () => {
            actualizado = fila;
            return { error: null };
          },
        }),
      };
    },
  };
  const resultado = await cancelarSuscripcionPlus({
    supabase,
    suscripcionId: SUB_ID,
    usuarioId: USUARIO,
    fetchFn: async (_url, init) => {
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ id: "PRE-C", status: "cancelled" }), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "PRE-C", status: "cancelled" }), { status: 200 });
    },
  });
  assert.equal(resultado.ok, true);
  assert.equal(actualizado.estado_interno, "cancelada");
  assert.equal(actualizado.vigente_hasta_fin_periodo, true);
});

const envProduccionPiloto = {
  NODE_ENV: "production",
  MERCADOPAGO_ENV: "produccion",
  PAYMENTS_LIVE_ENABLED: "true",
  PLUS_LIVE_ENABLED: "true",
  PAYMENTS_PILOT_USER_IDS: USUARIO,
};

function supabaseSinAcceso() {
  return {
    from() {
      throw new Error("no debe consultar la base");
    },
  };
}

test("iniciarCheckoutPlus bloquea a usuarios ajenos al piloto antes de tocar la base o Mercado Pago", async () => {
  const { iniciarCheckoutPlus } = await import("../lib/pagos/plus/gestion-servidor.js");
  const resultado = await iniciarCheckoutPlus({
    supabase: supabaseSinAcceso(),
    usuarioId: OTRA,
    emailUsuario: "ajeno@example.com",
    env: envProduccionPiloto,
    fetchFn: async () => {
      throw new Error("no debe llamar a Mercado Pago");
    },
  });
  assert.deepEqual(resultado, { ok: false, codigo: "piloto_no_autorizado" });
});

test("prepararAltaPlus bloquea a usuarios ajenos al piloto antes de crear el PreApproval", async () => {
  const resultado = await prepararAltaPlus({
    supabase: supabaseSinAcceso(),
    usuarioId: OTRA,
    emailUsuario: "ajeno@example.com",
    env: envProduccionPiloto,
    ejecutarMp: true,
    fetchFn: async () => {
      throw new Error("no debe llamar a Mercado Pago");
    },
  });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.codigo, "piloto_no_autorizado");
});
