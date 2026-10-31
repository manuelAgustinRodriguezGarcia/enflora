import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { estadoPagoRecurrenteDesdeRemotoMp } from "../lib/pagos/plus/estados.js";
import { persistirPagoRecurrentePlus } from "../lib/pagos/plus/persistencia-pago.js";
import { resolverSuscripcionIdRetornoPlus } from "../lib/pagos/plus/gestion-servidor.js";
import { esPagoSuscripcionMp } from "../lib/pagos/plus/sincronizar-pagos.js";
import { eventoPagoRecurrenteWebhook } from "../lib/pagos/evento-webhook.js";
import { aplicarAuthorizedPaymentRemoto } from "../lib/pagos/plus/aplicar-webhook-suscripcion.js";

const USUARIO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SUB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const envPrueba = {
  NODE_ENV: "development",
  MERCADOPAGO_ENV: "prueba",
  MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
};

test("estadoPagoRecurrenteDesdeRemotoMp prioriza payment acreditado", () => {
  assert.equal(
    estadoPagoRecurrenteDesdeRemotoMp({
      status: "processed",
      payment: { status: "approved", status_detail: "accredited" },
    }),
    "acreditado",
  );
  assert.equal(estadoPagoRecurrenteDesdeRemotoMp({ status: "pending" }), "pendiente");
});

test("persistirPagoRecurrentePlus reutiliza fila por authorized_payment_id", async () => {
  const almacen = new Map();
  const supabase = {
    from(tabla) {
      if (tabla !== "plus_pagos_recurrentes") throw new Error(tabla);
      return {
        select() {
          return this;
        },
        eq(_col, authId) {
          return {
            maybeSingle: async () => {
              const row = almacen.get(String(authId));
              return { data: row ? { id: row.id } : null, error: null };
            },
          };
        },
        insert(fila) {
          return {
            select: () => ({
              maybeSingle: async () => {
                const id = `id-${almacen.size + 1}`;
                almacen.set(String(fila.authorized_payment_id), { id, ...fila });
                return { data: { id }, error: null };
              },
            }),
          };
        },
        update(patch) {
          return {
            eq: async (_c, id) => {
              for (const [k, v] of almacen.entries()) {
                if (v.id === id) almacen.set(k, { ...v, ...patch });
              }
              return { error: null };
            },
          };
        },
      };
    },
  };

  const fila = {
    suscripcion_id: SUB_ID,
    usuario_id: USUARIO,
    ambiente: "prueba",
    authorized_payment_id: "7033434060",
    estado_interno: "acreditado",
    importe_ars: "6552",
  };
  assert.equal((await persistirPagoRecurrentePlus(supabase, fila)).reutilizado, false);
  assert.equal(
    (await persistirPagoRecurrentePlus(supabase, { ...fila, importe_cobrado_ars: "6552" }))
      .reutilizado,
    true,
  );
});

test("resolverSuscripcionIdRetornoPlus rechaza varias suscripciones abiertas", async () => {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    { id: SUB_ID, estado_interno: "activa" },
                    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", estado_interno: "activa" },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
  const r = await resolverSuscripcionIdRetornoPlus({
    supabase,
    usuarioId: USUARIO,
    suscripcionIdParam: "",
    env: envPrueba,
  });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "retorno_ambiguo");
});

test("aplicarAuthorizedPaymentRemoto no acredita solo con preapproval authorized", async () => {
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
          insert: (fila) => {
            updates.push(fila);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: "p1" }, error: null }),
              }),
            };
          },
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (tabla === "plus_suscripciones") {
        return { update: () => ({ eq: async () => ({ error: null }) }) };
      }
      if (tabla === "plus_notificaciones") {
        return { upsert: async () => ({ error: null }) };
      }
      throw new Error(tabla);
    },
  };

  const pendiente = await aplicarAuthorizedPaymentRemoto({
    supabase,
    suscripcion: { id: SUB_ID, usuario_id: USUARIO, ambiente: "prueba", preapproval_id: "PRE" },
    remoto: { id: "AUTH-P", preapproval_id: "PRE", status: "pending" },
    ambiente: "prueba",
  });
  assert.equal(pendiente.estadoInternoPago, "pendiente");
  assert.equal(updates[0]?.estado_interno, "pendiente");
});

test("esPagoSuscripcionMp distingue SUBSCRIPTIONS del pago único", () => {
  assert.equal(eventoPagoRecurrenteWebhook({ type: "payment" }), true);
  assert.equal(esPagoSuscripcionMp({ point_of_interaction: { type: "SUBSCRIPTIONS" } }), true);
  assert.equal(esPagoSuscripcionMp({ point_of_interaction: { type: "CHECKOUT" } }), false);
});
