import assert from "node:assert/strict";
import test from "node:test";
import { ejecutarPruebaPutPreapproval, PRUEBA_PUT } from "../lib/pagos/plus/prueba-put-preapproval.js";

const TOKEN = "TEST_TOKEN_SECRETO-777";
process.env.MERCADOPAGO_ACCESS_TOKEN = TOKEN;

const AHORA = new Date("2026-10-31T12:00:00Z");
const PROXIMA = "2026-11-30T19:00:55.000-04:00";
const CORREO = "TESTUSER1@testuser.com";

const envOk = {
  NODE_ENV: "development",
  MERCADOPAGO_ENV: "prueba",
  MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
  PAYMENTS_LIVE_ENABLED: "",
  MERCADOPAGO_ACCESS_TOKEN: TOKEN,
  MERCADOPAGO_TEST_BUYER_EMAIL: CORREO,
};

/** Mercado Pago falso con estado mutable y fallas programables. */
function mpFalso(opciones = {}) {
  const estado = {
    id: PRUEBA_PUT.preapprovalId,
    importe: 6552,
    status: "authorized",
    moneda: "ARS",
    next: PROXIMA,
    puts: [],
    gets: 0,
    pagos: [{ id: 1 }],
    tagsVendedor: ["user_product_seller", "test_user"],
    nickComprador: "TESTUSER999",
    ...opciones.estado,
  };
  const putsFallan = opciones.putsFallan ?? [];
  const getsFallan = opciones.getsFallan ?? [];
  const fetchFn = async (url, init) => {
    const metodo = init?.method || "GET";
    if (String(url).includes("/authorized_payments/search")) {
      return new Response(JSON.stringify({ results: estado.pagos }), { status: 200 });
    }
    if (String(url).endsWith("/users/me")) {
      return new Response(JSON.stringify({ id: 777, tags: estado.tagsVendedor }), { status: 200 });
    }
    if (String(url).includes("/users/")) {
      return new Response(JSON.stringify({ id: 888, nickname: estado.nickComprador }), { status: 200 });
    }
    if (metodo === "PUT") {
      estado.puts.push(JSON.parse(init.body));
      const n = estado.puts.length;
      if (putsFallan.includes(n)) return new Response(JSON.stringify({ message: "boom" }), { status: 500 });
      estado.importe = JSON.parse(init.body).auto_recurring.transaction_amount;
      if (opciones.putAlteraFecha) estado.next = "2026-12-01T00:00:00.000-04:00";
      return new Response(JSON.stringify({ id: estado.id }), { status: 200 });
    }
    estado.gets += 1;
    if (getsFallan.includes(estado.gets)) return new Response(JSON.stringify({ message: "get_boom" }), { status: 500 });
    return new Response(
      JSON.stringify({
        id: estado.id,
        status: estado.status,
        next_payment_date: estado.next,
        collector_id: 777,
        payer_id: 888,
        external_reference: "ref",
        auto_recurring: {
          transaction_amount: estado.importe,
          currency_id: estado.moneda,
          frequency: 1,
          frequency_type: "months",
        },
      }),
      { status: 200 },
    );
  };
  return { estado, fetchFn };
}

function supabaseFalso(filaExtra = {}) {
  const fila = {
    id: PRUEBA_PUT.suscripcionId,
    preapproval_id: PRUEBA_PUT.preapprovalId,
    ambiente: "prueba",
    estado_interno: "activa",
    importe_ars: "6552.00",
    ...filaExtra,
  };
  const consultas = [];
  return {
    consultas,
    from(tabla) {
      const q = {
        select: () => q,
        eq: (c, v) => {
          consultas.push([tabla, c, v]);
          return q;
        },
        then: (ok) =>
          Promise.resolve({ data: tabla === "plus_suscripciones" ? [fila] : [], error: null }).then(ok),
      };
      return q;
    },
  };
}

function correr(mp, extra = {}) {
  return ejecutarPruebaPutPreapproval({
    env: envOk,
    fetchFn: mp.fetchFn,
    ahora: AHORA,
    supabase: supabaseFalso(),
    pausaMs: 0,
    ...extra,
  });
}

const AUT = PRUEBA_PUT.autorizacion;

test("dry-run: solo GET, ningún PUT, ok", async () => {
  const mp = mpFalso();
  const r = await correr(mp);
  assert.equal(r.ok, true);
  assert.equal(r.modo, "dry-run");
  assert.equal(mp.estado.puts.length, 0);
  assert.equal(r.putPrevistos.length, 2);
  assert.deepEqual(r.putPrevistos[0].cuerpo, {
    auto_recurring: { transaction_amount: 6804, currency_id: "ARS" },
  });
  assert.equal(r.verificaciones.previas.credencialesDePrueba, true);
});

test("dry-run: el fetch guardado bloquea PUT aunque se intente", async () => {
  const mp = mpFalso();
  const r = await correr(mp, { autorizacion: null });
  assert.equal(r.ok, true);
  assert.equal(mp.estado.puts.length, 0);
});

test("ejecución real exitosa: actualiza y restaura, PUT mínimo", async () => {
  const mp = mpFalso();
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.restaurado, true);
  assert.equal(mp.estado.puts.length, 2);
  assert.deepEqual(mp.estado.puts[0], { auto_recurring: { transaction_amount: 6804, currency_id: "ARS" } });
  assert.deepEqual(mp.estado.puts[1], { auto_recurring: { transaction_amount: 6552, currency_id: "ARS" } });
  assert.equal(mp.estado.importe, 6552);
  assert.equal(r.verificaciones.posteriores.sinPagoNuevoMp, true);
  assert.equal(r.verificaciones.posteriores.plusActivo, true);
});

test("real: autorización incorrecta o vacía no hace nada", async () => {
  for (const aut of ["", "si", "SANDBOX"]) {
    const mp = mpFalso();
    const r = await correr(mp, { autorizacion: aut });
    assert.equal(r.codigo, "autorizacion_invalida");
    assert.equal(mp.estado.gets, 0);
    assert.equal(mp.estado.puts.length, 0);
  }
});

test("real: exige cliente Supabase para verificar duplicados", async () => {
  const mp = mpFalso();
  const r = await correr(mp, { autorizacion: AUT, supabase: null });
  assert.equal(r.codigo, "supabase_requerido_para_ejecucion_real");
  assert.equal(mp.estado.puts.length, 0);
});

test("error en el primer PUT: restaura de forma segura", async () => {
  const mp = mpFalso({ putsFallan: [1] });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.ok, false);
  assert.equal(r.restaurado, true);
  assert.equal(mp.estado.importe, 6552);
  assert.equal(mp.estado.puts.at(-1).auto_recurring.transaction_amount, 6552);
});

test("error en GET de confirmación: restaura y no declara éxito", async () => {
  // GETs: 1 inicial, 2 confirmación (falla), 3 confirmación de restauración
  const mp = mpFalso({ getsFallan: [2] });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.ok, false);
  assert.equal(r.restaurado, true);
  assert.equal(mp.estado.importe, 6552);
});

test("PUT no confirmado (MP ignora el cambio): no es éxito", async () => {
  const mp = mpFalso();
  const original = mp.fetchFn;
  mp.fetchFn = async (url, init) => {
    if (init?.method === "PUT") {
      mp.estado.puts.push(JSON.parse(init.body));
      return new Response("{}", { status: 200 });
    }
    return original(url, init);
  };
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "get_no_confirma_importe_temporal");
});

test("PUT que altera campos no permitidos: restaura y falla", async () => {
  const mp = mpFalso({ putAlteraFecha: true });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "put_altero_campos_no_permitidos");
  assert.equal(r.restaurado, true);
});

test("error durante la restauración: se detiene, informa y no declara éxito", async () => {
  // PUT 1 ok, PUT 2..4 (los 3 intentos de restauración) fallan
  const mp = mpFalso({ putsFallan: [2, 3, 4] });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "restauracion_fallida");
  assert.equal(r.restaurado, false);
  assert.equal(r.requiereIntervencionManual, true);
  assert.equal(mp.estado.importe, 6804);
  assert.equal(mp.estado.puts.length, 4);
});

test("restauración reintenta y logra en el segundo intento", async () => {
  const mp = mpFalso({ putsFallan: [2] });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.ok, true);
  assert.equal(r.restaurado, true);
  assert.equal(mp.estado.importe, 6552);
});

test("ambiente incorrecto: rechaza sin tocar la red", async () => {
  for (const env of [
    { ...envOk, MERCADOPAGO_ENV: "produccion" },
    { ...envOk, MERCADOPAGO_ENV: "" },
    { ...envOk, NODE_ENV: "production", MERCADOPAGO_ENV: "produccion", PAYMENTS_LIVE_ENABLED: "true" },
    { ...envOk, NODE_ENV: "production" },
    { ...envOk, PAYMENTS_LIVE_ENABLED: "true" },
  ]) {
    const mp = mpFalso();
    const r = await correr(mp, { env, autorizacion: AUT });
    assert.equal(r.ok, false);
    assert.equal(mp.estado.gets, 0);
    assert.equal(mp.estado.puts.length, 0);
  }
});

test("ID de suscripción incorrecto: MP devuelve otro id", async () => {
  const mp = mpFalso({ estado: { id: "otroid000" } });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.codigo, "validacion_previa_fallida");
  assert.equal(r.verificaciones.previas.idRemotoCoincide, false);
  assert.equal(mp.estado.puts.length, 0);
});

test("fila local distinta a la esperada: rechaza", async () => {
  const mp = mpFalso();
  const r = await correr(mp, {
    autorizacion: AUT,
    supabase: supabaseFalso({ id: "00000000-0000-0000-0000-000000000000" }),
  });
  assert.equal(r.codigo, "validacion_previa_fallida");
  assert.equal(mp.estado.puts.length, 0);
});

test("importe inicial inesperado: rechaza", async () => {
  const mp = mpFalso({ estado: { importe: 6804 } });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.codigo, "validacion_previa_fallida");
  assert.equal(r.verificaciones.previas.importeInicial6552, false);
  assert.equal(mp.estado.puts.length, 0);
});

test("moneda distinta de ARS: rechaza", async () => {
  const mp = mpFalso({ estado: { moneda: "USD" } });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.codigo, "validacion_previa_fallida");
  assert.equal(mp.estado.puts.length, 0);
});

test("suscripción no autorizada: rechaza", async () => {
  for (const status of ["paused", "cancelled", "pending"]) {
    const mp = mpFalso({ estado: { status } });
    const r = await correr(mp, { autorizacion: AUT });
    assert.equal(r.codigo, "validacion_previa_fallida");
    assert.equal(r.verificaciones.previas.estadoAuthorized, false);
    assert.equal(mp.estado.puts.length, 0);
  }
});

test("cobro inminente (<72 h): rechaza", async () => {
  const mp = mpFalso({ estado: { next: "2026-11-02T12:00:00.000Z" } });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.codigo, "validacion_previa_fallida");
  assert.equal(r.verificaciones.previas.cobroNoInminente, false);
  assert.equal(mp.estado.puts.length, 0);
});

test("credenciales que no son de prueba (collector distinto): rechaza", async () => {
  const mp = mpFalso();
  const r = await correr(mp, { env: { ...envOk, MERCADOPAGO_ACCESS_TOKEN: "TEST_TOKEN-111" }, autorizacion: AUT });
  // el cliente MP lee process.env; se alinea para aislar el chequeo de collector
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST_TOKEN-111";
  const r2 = await correr(mp, { env: { ...envOk, MERCADOPAGO_ACCESS_TOKEN: "TEST_TOKEN-111" }, autorizacion: AUT });
  process.env.MERCADOPAGO_ACCESS_TOKEN = TOKEN;
  assert.equal(r.ok, false);
  assert.equal(r2.codigo, "validacion_previa_fallida");
  assert.equal(r2.verificaciones.previas.credencialesDePrueba, false);
  assert.equal(mp.estado.puts.length, 0);
});

test("token de un usuario que no es de prueba (sin tag test_user): rechaza", async () => {
  const mp = mpFalso({ estado: { tagsVendedor: ["user_product_seller", "normal"] } });
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(r.codigo, "validacion_previa_fallida");
  assert.equal(mp.estado.puts.length, 0);
});

test("el informe nunca contiene el token", async () => {
  const mp = mpFalso();
  const r = await correr(mp, { autorizacion: AUT });
  assert.equal(JSON.stringify(r).includes("SECRETO"), false);
});
