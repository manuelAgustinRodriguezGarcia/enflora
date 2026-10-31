import assert from "node:assert/strict";
import test from "node:test";
import { correoPayerOrden, normalizarCorreoPago } from "../lib/pagos/ambiente.js";
import { cuerpoPreapprovalPlusPendiente } from "../lib/pagos/plus/cuerpo-preapproval.js";
import {
  cancelarSuscripcionPlus,
  iniciarCheckoutPlus,
} from "../lib/pagos/plus/gestion-servidor.js";

const USUARIO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SUB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const envPrueba = {
  NODE_ENV: "development",
  MERCADOPAGO_ENV: "prueba",
  MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
  PAYMENTS_LIVE_ENABLED: "",
  MERCADOPAGO_TEST_BUYER_EMAIL: "test_user_123456@testuser.com",
};

const envProduccion = {
  NODE_ENV: "production",
  MERCADOPAGO_ENV: "produccion",
  PAYMENTS_LIVE_ENABLED: "true",
  PLUS_LIVE_ENABLED: "true",
  PAYMENTS_PILOT_USER_IDS: USUARIO,
};

function supabaseCon(fila, actualizaciones = [], pagos = []) {
  return {
    from(tabla) {
      if (tabla === "plus_pagos_recurrentes") {
        const pagosQuery = {
          select: () => pagosQuery,
          eq: () => pagosQuery,
          order: () => pagosQuery,
          limit: () => ({ data: pagos, error: null }),
        };
        return pagosQuery;
      }
      if (tabla !== "plus_suscripciones") throw new Error(tabla);
      const constructor = {
        select: () => constructor,
        eq: () => constructor,
        in: () => constructor,
        order: () => constructor,
        limit: () => ({
          data: [],
          error: null,
          maybeSingle: async () => ({ data: fila, error: null }),
        }),
        maybeSingle: async () => ({ data: fila, error: null }),
        update: (cambios) => ({
          eq: async () => {
            actualizaciones.push(cambios);
            return { error: null };
          },
        }),
      };
      return constructor;
    },
  };
}

const pendiente = {
  id: SUB_ID,
  usuario_id: USUARIO,
  ambiente: "produccion",
  preapproval_id: "PRE-1",
  estado_interno: "pendiente_checkout",
  init_point: "https://mp.example/checkout",
};

test("normalizarCorreoPago valida formato y longitud", () => {
  assert.equal(normalizarCorreoPago("  mp@example.com "), "mp@example.com");
  assert.equal(normalizarCorreoPago("sin-arroba"), "");
  assert.equal(normalizarCorreoPago(""), "");
  assert.equal(normalizarCorreoPago(`${"a".repeat(250)}@x.com`), "");
});

test("payer_email usa el correo de pago distinto del de login", () => {
  const { email } = correoPayerOrden({
    ambiente: "produccion",
    emailUsuario: normalizarCorreoPago("pagos@mercadopago.com"),
  });
  assert.equal(email, "pagos@mercadopago.com");
  const cuerpo = cuerpoPreapprovalPlusPendiente({
    externalReference: SUB_ID,
    payerEmail: email,
    importeDecimalArs: "1000.00",
  });
  assert.equal(cuerpo.body.payer_email, "pagos@mercadopago.com");
  assert.equal(cuerpo.body.external_reference, SUB_ID);
});

test("iniciarCheckoutPlus rechaza correo de pago inválido sin tocar Mercado Pago", async () => {
  const resultado = await iniciarCheckoutPlus({
    supabase: supabaseCon(null),
    usuarioId: USUARIO,
    emailUsuario: "login@example.com",
    correoPago: "no-es-correo",
    env: envProduccion,
    fetchFn: async () => {
      throw new Error("no debe llamar a Mercado Pago");
    },
  });
  assert.deepEqual(resultado, { ok: false, codigo: "correo_pago_invalido" });
});

test("iniciarCheckoutPlus no reutiliza un checkout pendiente al pedir otro correo", async () => {
  const resultado = await iniciarCheckoutPlus({
    supabase: supabaseCon(pendiente),
    usuarioId: USUARIO,
    emailUsuario: "login@example.com",
    correoPago: "otro@mercadopago.com",
    env: envProduccion,
    fetchFn: async () => {
      throw new Error("no debe llamar a Mercado Pago");
    },
  });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.codigo, "intento_pendiente");
  assert.equal(resultado.initPoint, undefined);
});

test("iniciarCheckoutPlus continúa explícitamente el pendiente existente", async () => {
  const resultado = await iniciarCheckoutPlus({
    supabase: supabaseCon(pendiente),
    usuarioId: USUARIO,
    emailUsuario: "login@example.com",
    continuarPendiente: true,
    env: envProduccion,
  });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.reutilizada, true);
  assert.equal(resultado.initPoint, pendiente.init_point);
});

test("cancelar intento pendiente cancela en MP solo si sigue pending y libera el reintento", async () => {
  Object.assign(process.env, envProduccion, { MERCADOPAGO_ACCESS_TOKEN: "TEST" });
  const actualizaciones = [];
  const metodos = [];
  const resultado = await cancelarSuscripcionPlus({
    supabase: supabaseCon(pendiente, actualizaciones),
    suscripcionId: SUB_ID,
    usuarioId: USUARIO,
    soloIntentoPendiente: true,
    env: envProduccion,
    fetchFn: async (_url, init) => {
      metodos.push(init?.method || "GET");
      const status = init?.method === "PUT" ? "cancelled" : metodos.length === 1 ? "pending" : "cancelled";
      return new Response(JSON.stringify({ id: "PRE-1", status }), { status: 200 });
    },
  });
  assert.equal(resultado.ok, true);
  assert.deepEqual(metodos.slice(0, 2), ["GET", "PUT"]);
  assert.equal(actualizaciones.at(-1).estado_interno, "cancelada");
});

test("cancelar intento pendiente no cancela si MP ya lo autorizó", async () => {
  Object.assign(process.env, envProduccion, { MERCADOPAGO_ACCESS_TOKEN: "TEST" });
  const metodos = [];
  const resultado = await cancelarSuscripcionPlus({
    supabase: supabaseCon(pendiente),
    suscripcionId: SUB_ID,
    usuarioId: USUARIO,
    soloIntentoPendiente: true,
    env: envProduccion,
    fetchFn: async (_url, init) => {
      metodos.push(init?.method || "GET");
      return new Response(JSON.stringify({ id: "PRE-1", status: "authorized" }), { status: 200 });
    },
  });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.codigo, "intento_no_cancelable");
  assert.ok(!metodos.includes("PUT"));
});

test("cancelar intento pendiente no cancela una suscripción localmente activa ni una con pago acreditado", async () => {
  Object.assign(process.env, envProduccion, { MERCADOPAGO_ACCESS_TOKEN: "TEST" });
  const activa = { ...pendiente, estado_interno: "activa" };
  const sinLlamadas = async () => {
    throw new Error("no debe llamar a Mercado Pago");
  };
  const autorizada = await cancelarSuscripcionPlus({
    supabase: supabaseCon(activa),
    suscripcionId: SUB_ID,
    usuarioId: USUARIO,
    soloIntentoPendiente: true,
    env: envProduccion,
    fetchFn: sinLlamadas,
  });
  assert.equal(autorizada.codigo, "intento_no_cancelable");

  const pagada = await cancelarSuscripcionPlus({
    supabase: supabaseCon(pendiente, [], [{ id: "pago-1", estado_interno: "acreditado" }]),
    suscripcionId: SUB_ID,
    usuarioId: USUARIO,
    soloIntentoPendiente: true,
    env: envProduccion,
    fetchFn: sinLlamadas,
  });
  assert.equal(pagada.codigo, "intento_no_cancelable");
});

const ESTADOS_ABIERTOS_INDICE = new Set([
  "borrador",
  "pendiente_checkout",
  "activa",
  "pausada",
  "past_due",
]);

function htmlBnaVigente() {
  const art = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const dia = art.getUTCDate();
  const mes = art.getUTCMonth() + 1;
  const anio = art.getUTCFullYear();
  return `<table><tr><th>${dia}/${mes}/${anio}</th></tr><tr><td>Dolar U.S.A</td><td>1.495,00</td><td>1.545,00</td></tr></table>Hora Actualización: 00:01`;
}

/** Réplica del índice parcial plus_suscripciones_activa_por_usuario_ambiente. */
function tiendaConIndice(inicial) {
  const filas = [{ ...inicial }];
  const pagos = [];
  function abiertas(usuarioId, ambiente) {
    return filas.filter(
      (fila) =>
        fila.usuario_id === usuarioId &&
        fila.ambiente === ambiente &&
        ESTADOS_ABIERTOS_INDICE.has(fila.estado_interno),
    );
  }
  function consulta(origen) {
    let lista = origen;
    const api = {
      select: () => api,
      eq: (columna, valor) => {
        lista = lista.filter((fila) => fila[columna] === valor);
        return api;
      },
      in: (columna, valores) => {
        lista = lista.filter((fila) => valores.includes(fila[columna]));
        return api;
      },
      order: () => api,
      limit: (n) => ({ data: lista.slice(0, n), error: null, maybeSingle: async () => ({ data: lista[0] || null, error: null }) }),
      maybeSingle: async () => ({ data: lista[0] || null, error: null }),
    };
    return api;
  }
  return {
    filas,
    from(tabla) {
      if (tabla === "plus_pagos_recurrentes") return consulta(pagos);
      if (tabla !== "plus_suscripciones") throw new Error(tabla);
      return {
        select: () => consulta(filas),
        insert: (fila) => {
          if (abiertas(fila.usuario_id, fila.ambiente).length) {
            return {
              error: {
                code: "23505",
                message: "plus_suscripciones_activa_por_usuario_ambiente",
              },
            };
          }
          filas.push({ ...fila });
          return { error: null };
        },
        update: (cambios) => ({
          eq: (_columna, id) => {
            const fila = filas.find((item) => item.id === id);
            if (fila) Object.assign(fila, cambios);
            return { error: null };
          },
        }),
      };
    },
  };
}

test("cancelar un pendiente lo saca del índice único y permite otro checkout", async () => {
  Object.assign(process.env, envProduccion, { MERCADOPAGO_ACCESS_TOKEN: "TEST" });
  const tienda = tiendaConIndice(pendiente);
  const metodos = [];
  const cancelado = await cancelarSuscripcionPlus({
    supabase: tienda,
    suscripcionId: SUB_ID,
    usuarioId: USUARIO,
    soloIntentoPendiente: true,
    env: envProduccion,
    fetchFn: async (_url, init) => {
      metodos.push(init?.method || "GET");
      const status = metodos.length === 1 ? "pending" : "cancelled";
      return new Response(JSON.stringify({ id: "PRE-1", status }), { status: 200 });
    },
  });
  assert.equal(cancelado.ok, true);
  assert.equal(tienda.filas[0].estado_interno, "cancelada");
  assert.ok(tienda.filas[0].cancelada_en);
  assert.equal(ESTADOS_ABIERTOS_INDICE.has(tienda.filas[0].estado_interno), false);

  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("bna.com.ar")) return new Response(htmlBnaVigente(), { status: 200 });
    return fetchOriginal(url);
  };
  let payerEmail = "";
  try {
    const alta = await iniciarCheckoutPlus({
      supabase: tienda,
      usuarioId: USUARIO,
      emailUsuario: "login@enflora.com",
      correoPago: "otro@mercadopago.com",
      env: envProduccion,
      fetchFn: async (_url, init) => {
        const cuerpo = JSON.parse(init.body);
        payerEmail = cuerpo.payer_email;
        return new Response(
          JSON.stringify({
            id: "PRE-2",
            status: "pending",
            init_point: "https://mp.example/nuevo",
          }),
          { status: 200 },
        );
      },
    });
    assert.equal(alta.ok, true, alta.codigo);
    assert.equal(payerEmail, "otro@mercadopago.com");
    assert.notEqual(alta.suscripcionId, SUB_ID);
    assert.equal(tienda.filas.filter((fila) => ESTADOS_ABIERTOS_INDICE.has(fila.estado_interno)).length, 1);
    assert.equal(tienda.filas[1].usuario_id, USUARIO);
    assert.equal(tienda.filas[1].external_reference, alta.suscripcionId);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("envPrueba conserva el correo de comprador de prueba", () => {
  const { email } = correoPayerOrden({
    ambiente: "prueba",
    emailUsuario: "pagos@mercadopago.com",
    env: envPrueba,
  });
  assert.equal(email, envPrueba.MERCADOPAGO_TEST_BUYER_EMAIL);
});
