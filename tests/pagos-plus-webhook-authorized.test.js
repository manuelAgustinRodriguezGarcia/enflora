import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { procesarWebhookSuscripcionEntrada } from "../lib/pagos/procesar-webhook-suscripcion.js";

const USUARIO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SUB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECRETO = "secreto-plus";
const DATA_ID = "7033441726";

const envPrueba = {
  NODE_ENV: "development",
  MERCADOPAGO_ENV: "prueba",
  MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
};

function firmar({ secreto, dataId, requestId, ts }) {
  const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", secreto).update(manifiesto).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

function errorHttp(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function remotoAcreditado() {
  return {
    id: DATA_ID,
    preapproval_id: "PRE-A",
    status: "processed",
    transaction_amount: 6552,
    debit_date: "2026-10-31T19:17:32.000Z",
    payment: { id: "999001", status: "approved", status_detail: "accredited" },
  };
}

function crearDb() {
  const pagos = new Map();
  const notas = new Map();
  const eventos = [];
  const fallos = { insert: null, updateSub: null, buscar: null };
  const suscripcion = {
    id: SUB_ID,
    usuario_id: USUARIO,
    ambiente: "prueba",
    preapproval_id: "PRE-A",
    estado_interno: "pendiente_checkout",
  };
  const client = {
    from(tabla) {
      if (tabla === "plus_notificaciones") {
        return {
          select: () => ({
            eq: (_col, clave) => ({
              maybeSingle: async () => {
                const nota = notas.get(clave);
                return { data: nota ? { id: nota.clave, aplicada: nota.aplicada } : null, error: null };
              },
            }),
          }),
          upsert: async (fila) => {
            eventos.push(["upsert", fila.clave]);
            notas.set(fila.clave, fila);
            return { error: null };
          },
        };
      }
      if (tabla === "plus_suscripciones") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (fallos.buscar) return { data: null, error: fallos.buscar };
                return { data: suscripcion, error: null };
              },
            }),
          }),
          update: (fila) => ({
            eq: async () => {
              eventos.push(["update-sub", fila]);
              if (fallos.updateSub) return { error: fallos.updateSub };
              Object.assign(suscripcion, fila);
              return { error: null };
            },
          }),
        };
      }
      if (tabla === "plus_pagos_recurrentes") {
        return {
          select: () => ({
            eq: (_col, authId) => ({
              maybeSingle: async () => {
                const row = pagos.get(String(authId));
                return { data: row ? { id: row.id } : null, error: null };
              },
            }),
          }),
          insert(fila) {
            return {
              select: () => ({
                maybeSingle: async () => {
                  eventos.push(["insert", fila.authorized_payment_id, fila.estado_interno]);
                  if (fallos.insert) return { data: null, error: fallos.insert };
                  const id = `pago-${pagos.size + 1}`;
                  pagos.set(String(fila.authorized_payment_id), { id, ...fila });
                  return { data: { id }, error: null };
                },
              }),
            };
          },
          update(patch) {
            return {
              eq: async (_col, id) => {
                eventos.push(["update-pago", id]);
                for (const [clave, fila] of pagos.entries()) {
                  if (fila.id === id) pagos.set(clave, { ...fila, ...patch });
                }
                return { error: null };
              },
            };
          },
        };
      }
      throw new Error(tabla);
    },
  };
  return { client, pagos, notas, eventos, suscripcion, fallos };
}

function entrada(dataId, requestId) {
  const ts = String(Math.floor(Date.now() / 1000));
  return {
    dataId,
    type: "subscription_authorized_payment",
    xSignature: firmar({ secreto: SECRETO, dataId, requestId, ts }),
    xRequestId: requestId,
    aviso: { data: { id: dataId }, live_mode: false },
    secret: SECRETO,
    env: envPrueba,
  };
}

async function procesar(db, { requestId = "req-pago-1", guion = [], dataId = DATA_ID } = {}) {
  const consultas = [];
  const esperas = [];
  let preapprovals = 0;
  const logs = [];
  const original = console.error;
  console.error = (...args) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    const resultado = await procesarWebhookSuscripcionEntrada(entrada(dataId, requestId), {
      leerRecepcionPagos: () => ({ ok: true, ambiente: "prueba" }),
      clientePagos: () => db.client,
      esperar: async (ms) => {
        esperas.push(ms);
      },
      obtenerAuthorizedPayment: async (id) => {
        consultas.push(id);
        if (!guion.length) return remotoAcreditado();
        const paso = guion.shift();
        if (paso instanceof Error) throw paso;
        return paso;
      },
      obtenerPreapproval: async () => {
        preapprovals += 1;
        return { id: "PRE-A", status: "authorized" };
      },
    });
    return { resultado, consultas, esperas, preapprovals, logs };
  } finally {
    console.error = original;
  }
}

test("webhook authorized_payment acreditado persiste y marca la notificación después", async () => {
  const db = crearDb();
  const corrida = await procesar(db, { guion: [remotoAcreditado()] });
  assert.equal(corrida.resultado.status, 200);
  assert.equal(corrida.resultado.body.plus, "pago_recurrente");
  assert.equal(db.pagos.size, 1);
  const pago = db.pagos.get(DATA_ID);
  assert.equal(pago.estado_interno, "acreditado");
  assert.equal(pago.importe_ars, "6552");
  assert.equal(db.suscripcion.estado_interno, "activa");
  assert.ok(db.suscripcion.periodo_vigente_hasta);
  assert.equal(db.notas.get("req-pago-1")?.aplicada, true);
  assert.equal(corrida.consultas.length, 1);
  assert.equal(corrida.esperas.length, 0);
  assert.equal(corrida.logs.length, 0);

  const duplicada = await procesar(db, { requestId: "req-pago-1", guion: [remotoAcreditado()] });
  assert.equal(duplicada.resultado.status, 200);
  assert.equal(duplicada.resultado.body.duplicada, true);
  assert.equal(duplicada.consultas.length, 0);
  assert.equal(db.eventos.filter((evento) => evento[0] === "insert").length, 1);
});

test("webhook authorized_payment reintenta un 404 transitorio y persiste una sola vez", async () => {
  const db = crearDb();
  const corrida = await procesar(db, {
    guion: [errorHttp(404, "resource not found"), errorHttp(503, "unavailable"), remotoAcreditado()],
  });
  assert.equal(corrida.resultado.status, 200);
  assert.deepEqual(corrida.esperas, [200, 400]);
  assert.equal(corrida.consultas.length, 3);
  assert.equal(db.pagos.size, 1);
  assert.equal(db.eventos.filter((evento) => evento[0] === "insert").length, 1);
  assert.equal(db.notas.get("req-pago-1")?.aplicada, true);
  assert.equal(corrida.logs.length, 0);
});

test("webhook authorized_payment agota reintentos sin escribir ni marcar la notificación", async () => {
  const db = crearDb();
  const corrida = await procesar(db, {
    guion: [
      errorHttp(404, `Bearer ${SECRETO} ${DATA_ID}`),
      errorHttp(404, `Bearer ${SECRETO}`),
      errorHttp(404, "not ready"),
    ],
  });
  assert.equal(corrida.resultado.status, 503);
  assert.deepEqual(corrida.esperas, [200, 400]);
  assert.equal(corrida.consultas.length, 3);
  assert.equal(db.pagos.size, 0);
  assert.equal(db.notas.size, 0);
  assert.equal(corrida.preapprovals, 0);
  assert.equal(db.suscripcion.estado_interno, "pendiente_checkout");
  assert.equal(corrida.logs.length, 1);
  assert.match(corrida.logs[0], /fase=consulta_authorized_payment/);
  assert.match(corrida.logs[0], /codigo=no_encontrado/);
  assert.match(corrida.logs[0], /http=404/);
  assert.match(corrida.logs[0], /intentos=3/);
  assert.equal(corrida.logs[0].includes(SECRETO), false);
  assert.equal(corrida.logs[0].includes(DATA_ID), false);
  assert.equal(corrida.logs[0].includes("Bearer"), false);
});

test("webhook authorized_payment no reintenta un 401 y no persiste", async () => {
  const db = crearDb();
  const corrida = await procesar(db, {
    guion: [errorHttp(401, "invalid access token")],
  });
  assert.equal(corrida.resultado.status, 503);
  assert.equal(corrida.consultas.length, 1);
  assert.equal(corrida.esperas.length, 0);
  assert.equal(db.pagos.size, 0);
  assert.equal(db.notas.size, 0);
  assert.match(corrida.logs[0], /http=401/);
  assert.match(corrida.logs[0], /codigo=mp_http/);
  assert.equal(corrida.logs[0].includes("invalid access token"), false);
});

test("webhook authorized_payment responde 503 si Supabase no persiste y no marca la notificación", async () => {
  const db = crearDb();
  db.fallos.insert = { code: "08006", message: "connection reset token=super-secreto" };
  const corrida = await procesar(db, { guion: [remotoAcreditado()] });
  assert.equal(corrida.resultado.status, 503);
  assert.equal(db.pagos.size, 0);
  assert.equal(db.notas.size, 0);
  assert.equal(corrida.preapprovals, 0);
  assert.equal(db.suscripcion.periodo_vigente_hasta, undefined);
  assert.match(corrida.logs[0], /fase=persistencia_authorized_payment/);
  assert.match(corrida.logs[0], /codigo=08006/);
  assert.equal(corrida.logs[0].includes("super-secreto"), false);
});

test("webhook authorized_payment no marca la notificación si falla la vigencia", async () => {
  const db = crearDb();
  db.fallos.updateSub = { code: "23514", message: "check violation usuario@correo.test" };
  const corrida = await procesar(db, { guion: [remotoAcreditado()] });
  assert.equal(corrida.resultado.status, 503);
  assert.equal(db.pagos.size, 1);
  assert.equal(db.pagos.get(DATA_ID).estado_interno, "acreditado");
  assert.equal(db.notas.size, 0);
  assert.equal(corrida.preapprovals, 0);
  assert.match(corrida.logs[0], /codigo=23514/);
  assert.equal(corrida.logs[0].includes("correo.test"), false);
});

test("webhook authorized_payment reutiliza el mismo pago con otra notificación", async () => {
  const db = crearDb();
  const primera = await procesar(db, { requestId: "req-a", guion: [remotoAcreditado()] });
  const segunda = await procesar(db, { requestId: "req-b", guion: [remotoAcreditado()] });
  assert.equal(primera.resultado.status, 200);
  assert.equal(segunda.resultado.status, 200);
  assert.equal(db.pagos.size, 1);
  assert.equal(db.eventos.filter((evento) => evento[0] === "insert").length, 1);
  assert.equal(db.eventos.filter((evento) => evento[0] === "update-pago").length, 1);
  assert.equal(db.notas.get("req-a")?.aplicada, true);
  assert.equal(db.notas.get("req-b")?.aplicada, true);
});

test("webhook authorized_payment pendiente no extiende la vigencia", async () => {
  const db = crearDb();
  const corrida = await procesar(db, {
    guion: [
      {
        id: DATA_ID,
        preapproval_id: "PRE-A",
        status: "pending",
        transaction_amount: 6552,
      },
    ],
  });
  assert.equal(corrida.resultado.status, 200);
  assert.equal(db.pagos.get(DATA_ID).estado_interno, "pendiente");
  assert.equal(db.suscripcion.periodo_vigente_hasta, undefined);
  assert.equal(
    db.eventos.some((evento) => evento[0] === "update-sub" && evento[1].periodo_vigente_hasta),
    false,
  );
});

test("webhook authorized_payment devuelve 503 si falla la lectura de la suscripción y no persiste", async () => {
  const db = crearDb();
  db.fallos.buscar = { code: "PGRST000", message: "db down user-secret" };
  const corrida = await procesar(db, { guion: [remotoAcreditado()] });
  assert.equal(corrida.resultado.status, 503);
  assert.equal(db.pagos.size, 0);
  assert.equal(db.notas.size, 0);
  assert.match(corrida.logs[0], /fase=lectura_suscripcion/);
  assert.match(corrida.logs[0], /codigo=PGRST000/);
  assert.equal(corrida.logs[0].includes("user-secret"), false);
});
