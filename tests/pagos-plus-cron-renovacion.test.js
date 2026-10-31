import assert from "node:assert/strict";
import test from "node:test";
import { ejecutarCronRenovacionImportePlus } from "../lib/pagos/plus/cron-renovacion-ars.js";
import { evaluarActualizacionArsPreRenovacion } from "../lib/pagos/plus/renovacion-ars.js";
import { evaluarCotizacion, instanteArgentina } from "../lib/pagos/cotizacion-bna.js";
import { textoArAEscala4 } from "../lib/pagos/dinero.js";
import {
  AHORA_EN_VENTANA,
  AHORA_FUERA,
  PROXIMA,
  cotizacionBna,
  env,
  mpFalso,
  notificadorFalso,
  suscripcion,
  supabaseFalso,
  supabasePROHIBIDO,
} from "./stubs/plus-renovacion-fakes.js";

process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST_TOKEN_CRON";

async function correr(opciones) {
  return ejecutarCronRenovacionImportePlus({
    env,
    ahora: AHORA_EN_VENTANA,
    notificar: notificadorFalso().notificar,
    ...opciones,
  });
}

test("1. activa fuera de ventana: no actualiza (fecha leída de MP, no de la BD)", async () => {
  const mp = mpFalso();
  const db = supabaseFalso([suscripcion({ proxima_renovacion: "2026-11-28T00:00:00Z" })]); // BD engañosa
  const r = await correr({ supabase: db, fetchFn: mp.fetchFn, ahora: AHORA_FUERA, obtenerCotizacion: cotizacionBna("1.620,00") });
  assert.equal(r.omitidas, 1);
  assert.equal(r.operaciones[0].motivo, "fuera_de_ventana");
  assert.equal(mp.estado.puts.length, 0);
  assert.equal(db.escrituras.length, 0);
});

test("2 y 3. dentro de 72 h con BNA válida: calcula US$4,20 × venta sin error ×100", async () => {
  for (const [bna, esperado] of [["1.560,00", "6552.00"], ["1.620,00", "6804.00"], ["1.545,50", "6491.10"]]) {
    const mp = mpFalso({ importe: 1 });
    const r = await correr({ dryRun: true, supabase: null, fetchFn: mp.fetchFn, candidatas: [suscripcion()], obtenerCotizacion: cotizacionBna(bna) });
    assert.equal(r.operaciones[0].accion, "put_preapproval", bna);
    assert.equal(r.operaciones[0].importeNuevo, esperado, bna);
    assert.ok(Number(esperado) < 10000, "no debe ser centavos (×100)");
    assert.equal(r.operaciones[0].putPrevisto.cuerpo.auto_recurring.transaction_amount, Number(esperado));
    assert.equal(r.operaciones[0].ejecutado, false);
  }
});

test("4. BNA sin cotización válida: bloquea, no hace PUT, deja auditoría", async () => {
  const mp = mpFalso();
  const db = supabaseFalso();
  const r = await correr({
    supabase: db,
    fetchFn: mp.fetchFn,
    obtenerCotizacion: async () => ({ ok: false, codigo: "cotizacion_no_disponible" }),
  });
  assert.equal(r.bloqueadas, 1);
  assert.equal(r.operaciones[0].codigo, "cotizacion_no_disponible");
  assert.equal(mp.estado.puts.length, 0);
  assert.equal(db.escrituras.length, 1);
  assert.equal(db.escrituras[0].tabla, "plus_cotizacion_auditoria");
  assert.equal(db.escrituras[0].fila.preapproval_put_ok, false);
  assert.equal(db.escrituras[0].fila.estado_final, "bloqueado");
  assert.equal(db.escrituras[0].fila.codigo_error, "cotizacion_no_disponible");
  // el bloqueo es solo local: MP sigue authorized y cobraría el importe vigente
  assert.equal(mp.estado.status, "authorized");
});

test("5. dry-run con PUT simulado exitoso: confirma sin red ni BD", async () => {
  const mp = mpFalso({ importe: 6000 });
  const r = await correr({
    dryRun: true,
    supabase: supabasePROHIBIDO(),
    fetchFn: mp.fetchFn,
    candidatas: [suscripcion()],
    obtenerCotizacion: cotizacionBna("1.560,00"),
    simulacion: { putOk: true },
  });
  assert.equal(r.operaciones[0].simulacion.ok, true);
  assert.equal(r.puts, 1);
  assert.equal(mp.estado.puts.length, 0, "ningún PUT real");
  assert.equal(mp.estado.importe, 6000);
});

test("6. dry-run con PUT simulado fallido", async () => {
  const mp = mpFalso({ importe: 6000 });
  const r = await correr({
    dryRun: true,
    supabase: null,
    fetchFn: mp.fetchFn,
    candidatas: [suscripcion()],
    obtenerCotizacion: cotizacionBna("1.560,00"),
    simulacion: { putOk: false },
  });
  assert.equal(r.operaciones[0].simulacion.ok, false);
  assert.equal(r.fallidas, 1);
  assert.equal(mp.estado.puts.length, 0);
});

test("7. GET posterior con importe diferente: put_no_confirmado (simulado y real)", async () => {
  const sim = await correr({
    dryRun: true,
    supabase: null,
    fetchFn: mpFalso({ importe: 6000 }).fetchFn,
    candidatas: [suscripcion()],
    obtenerCotizacion: cotizacionBna("1.560,00"),
    simulacion: { putOk: true, importeGet: 6000 },
  });
  assert.equal(sim.operaciones[0].simulacion.codigo, "put_no_confirmado");

  const mp = mpFalso({ importe: 6000, putIgnorado: true });
  const db = supabaseFalso();
  const real = await correr({ supabase: db, fetchFn: mp.fetchFn, obtenerCotizacion: cotizacionBna("1.560,00") });
  assert.equal(real.fallidas, 1);
  assert.equal(real.operaciones[0].codigo, "put_no_confirmado");
  assert.equal(
    db.escrituras.filter((e) => e.tabla === "plus_suscripciones").length,
    0,
    "no actualiza importe local sin confirmación",
  );
  assert.equal(db.auditoria[0].preapproval_put_ok, false);
  assert.equal(db.auditoria[0].codigo_error, "put_no_confirmado");
});

test("PUT real fallido: registra fallo y no toca importe local", async () => {
  const mp = mpFalso({ importe: 6000, putFalla: true });
  const db = supabaseFalso();
  const r = await correr({ supabase: db, fetchFn: mp.fetchFn, obtenerCotizacion: cotizacionBna("1.560,00") });
  assert.equal(r.fallidas, 1);
  assert.equal(db.escrituras.filter((e) => e.tabla === "plus_suscripciones").length, 0);
});

test("8. ejecución repetida: un solo PUT, la segunda corrida omite", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso();
  const opciones = { supabase: db, fetchFn: mp.fetchFn, obtenerCotizacion: cotizacionBna("1.560,00") };
  const primera = await correr(opciones);
  const segunda = await correr(opciones);
  const tercera = await correr(opciones);
  assert.equal(primera.puts, 1);
  assert.equal(segunda.puts, 0);
  assert.equal(tercera.puts, 0);
  assert.equal(segunda.operaciones[0].motivo, "importe_ya_vigente");
  assert.equal(mp.estado.puts.length, 1);
  assert.equal(mp.estado.importe, 6552);
  assert.equal(db.escrituras.filter((e) => e.tabla === "plus_suscripciones").length, 1);
  assert.equal(db.auditoria.length, 1, "una sola fila de auditoría por renovación");
  assert.equal(db.auditoria[0].estado_final, "resuelto");
});

test("9. suscripción cancelada o pausada (según MP o local): no actualiza", async () => {
  for (const status of ["cancelled", "paused", "pending"]) {
    const mp = mpFalso({ importe: 6000, status });
    const r = await correr({ dryRun: true, supabase: null, fetchFn: mp.fetchFn, candidatas: [suscripcion()], obtenerCotizacion: cotizacionBna("1.560,00") });
    assert.equal(r.operaciones[0].motivo, "mp_no_autorizada", status);
    assert.equal(r.puts, 0);
  }
  const local = await correr({
    dryRun: true,
    supabase: null,
    fetchFn: mpFalso({ importe: 6000 }).fetchFn,
    candidatas: [suscripcion({ estado_interno: "cancelada" })],
    obtenerCotizacion: cotizacionBna("1.560,00"),
  });
  assert.equal(local.operaciones[0].motivo, "suscripcion_no_activa");
});

test("10. separación sandbox/producción", async () => {
  const mp = mpFalso({ importe: 6000 });
  // fila de producción con entorno de prueba: se omite sin PUT
  const r = await correr({
    dryRun: true,
    supabase: null,
    fetchFn: mp.fetchFn,
    candidatas: [suscripcion({ ambiente: "produccion" })],
    obtenerCotizacion: cotizacionBna("1.560,00"),
  });
  assert.equal(r.operaciones[0].motivo, "ambiente_distinto");
  // la consulta real filtra por ambiente actual
  const db = supabaseFalso([]);
  await correr({ supabase: db, fetchFn: mp.fetchFn, obtenerCotizacion: cotizacionBna("1.560,00") });
  assert.ok(db.filtros.some(([c, v]) => c === "ambiente" && v === "prueba"));
  // entorno inválido (prueba + cobros reales) no ejecuta nada
  const mal = await correr({
    env: { ...env, PAYMENTS_LIVE_ENABLED: "true" },
    supabase: db,
    fetchFn: mp.fetchFn,
    obtenerCotizacion: cotizacionBna("1.560,00"),
  });
  assert.equal(mal.ok, false);
  assert.equal(mp.estado.puts.length, 0);
});

test("dry-run: el fetch real rechaza cualquier método que no sea GET y no escribe en BD", async () => {
  const llamados = [];
  const fetchFn = async (url, init) => {
    llamados.push(init?.method || "GET");
    return new Response(
      JSON.stringify({ status: "authorized", next_payment_date: PROXIMA, auto_recurring: { transaction_amount: 6000 } }),
      { status: 200 },
    );
  };
  const r = await correr({
    dryRun: true,
    supabase: supabasePROHIBIDO(),
    fetchFn,
    candidatas: [suscripcion()],
    obtenerCotizacion: cotizacionBna("1.560,00"),
  });
  assert.deepEqual(llamados, ["GET"]);
  assert.equal(r.operaciones[0].accion, "put_preapproval");
  assert.equal(r.operaciones[0].ejecutado, false);
});

test("11. cotización con fin de semana y feriado largo", () => {
  const viernes = instanteArgentina(27, 11, 2026, 15, 0); // viernes 15:00 ART
  const cot = {
    venta: textoArAEscala4("1.560,00"),
    tipo: "billete_vendedor",
    punta: "vendedor",
    publicadaEn: viernes,
    fuente: "Banco Nación",
  };
  const lunes = new Date("2026-11-30T12:00:00-03:00"); // 2,8 días después
  const feriadoLargo = new Date("2026-12-01T12:00:00-03:00");
  const diaSiete = new Date(new Date(viernes).getTime() + 6.9 * 86400000);
  const muyVieja = new Date(new Date(viernes).getTime() + 7.2 * 86400000);
  assert.equal(evaluarCotizacion(cot, lunes).ok, true);
  assert.equal(evaluarCotizacion(cot, feriadoLargo).ok, true);
  assert.equal(evaluarCotizacion(cot, diaSiete).ok, true);
  assert.equal(evaluarCotizacion(cot, muyVieja).codigo, "cotizacion_antigua");

  const plan = (ahora, evaluada) =>
    evaluarActualizacionArsPreRenovacion({
      suscripcion: suscripcion(),
      remoto: { status: "authorized", next_payment_date: PROXIMA, auto_recurring: { transaction_amount: 6000 } },
      cotizacion: evaluada,
      ahora,
    });
  assert.equal(plan(lunes, evaluarCotizacion(cot, lunes)).accion, "put_preapproval");
  // sin publicación nueva por >7 días dentro de la ventana: bloquea (no usa cotización vencida)
  const enVentana = new Date("2026-11-28T15:00:00Z");
  const vieja = { ...cot, publicadaEn: instanteArgentina(20, 11, 2026, 15, 0) };
  const bloqueo = plan(enVentana, evaluarCotizacion(vieja, enVentana));
  assert.equal(bloqueo.accion, "bloqueado");
  assert.equal(bloqueo.codigo, "cotizacion_antigua");
});

test("12. zonas horarias: offset -04:00 de MP y borde exacto de 72 h", () => {
  // next_payment_date 19:00:55-04:00 === 23:00:55Z === 20:00:55 ART
  const base = { suscripcion: suscripcion(), cotizacion: { ok: true, edadDias: 0, cotizacion: { venta: textoArAEscala4("1.560,00") } } };
  const remoto = { status: "authorized", next_payment_date: PROXIMA, auto_recurring: { transaction_amount: 6000 } };
  const justoAntes = new Date("2026-11-27T23:00:00Z"); // 72 h + 55 s antes
  const justoDespues = new Date("2026-11-27T23:01:00Z"); // 71 h 59 m 55 s antes
  assert.equal(evaluarActualizacionArsPreRenovacion({ ...base, remoto, ahora: justoAntes }).motivo, "fuera_de_ventana");
  assert.equal(evaluarActualizacionArsPreRenovacion({ ...base, remoto, ahora: justoDespues }).accion, "put_preapproval");
  // la misma fecha expresada en otra zona es el mismo instante
  const mismoInstante = { ...remoto, next_payment_date: "2026-11-30T20:00:55-03:00" };
  assert.equal(evaluarActualizacionArsPreRenovacion({ ...base, remoto: mismoInstante, ahora: justoAntes }).motivo, "fuera_de_ventana");
  assert.equal(evaluarActualizacionArsPreRenovacion({ ...base, remoto: mismoInstante, ahora: justoDespues }).accion, "put_preapproval");
  // BNA 15:00 ART del viernes = 18:00Z
  assert.equal(instanteArgentina(27, 11, 2026, 15, 0), "2026-11-27T18:00:00.000Z");
  // sin fecha en MP: bloquea
  assert.equal(
    evaluarActualizacionArsPreRenovacion({ ...base, remoto: { ...remoto, next_payment_date: null }, ahora: justoDespues }).codigo,
    "sin_proxima_renovacion",
  );
});
