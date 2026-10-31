import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ejecutarCronRenovacionImportePlus } from "../lib/pagos/plus/cron-renovacion-ars.js";
import {
  evaluarHeartbeat,
  leerHeartbeat,
  monitorAutorizado,
  nombreJob,
} from "../lib/pagos/plus/heartbeat-cron.js";
import { claveIncidencia, MAX_INTENTOS_PUT } from "../lib/pagos/plus/incidencias-renovacion.js";
import { ordenarPorUrgencia, sinDuplicados } from "../lib/pagos/plus/lectura-suscripciones.js";
import { evaluarActualizacionArsPreRenovacion } from "../lib/pagos/plus/renovacion-ars.js";
import { textoArAEscala4 } from "../lib/pagos/dinero.js";
import {
  PROXIMA,
  SUB_ID,
  cotizacionBna,
  env,
  mpFalso,
  mpMultiple,
  notificadorFalso,
  suscripcion,
  supabaseFalso,
} from "./stubs/plus-renovacion-fakes.js";

process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST_TOKEN_HARDENING";

const REF_ISO = new Date(PROXIMA).toISOString();
const BNA_OK = cotizacionBna("1.560,00"); // esperado 6552.00
const BNA_CAIDA = async () => ({ ok: false, codigo: "cotizacion_no_disponible" });
const JOB = nombreJob("prueba");

function faltando(horas) {
  return new Date(new Date(PROXIMA).getTime() - horas * 3600000);
}

function correr(ahora, { db, mp, notificador = notificadorFalso(), cotizacion = BNA_OK, ...extra }) {
  return ejecutarCronRenovacionImportePlus({
    env,
    ahora,
    supabase: db,
    fetchFn: mp.fetchFn,
    obtenerCotizacion: cotizacion,
    notificar: notificador.notificar,
    ...extra,
  });
}

function uuid(n) {
  return `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function lote(cantidad, extra = () => ({})) {
  return Array.from({ length: cantidad }, (_, i) =>
    suscripcion({ id: uuid(i + 1), preapproval_id: `PRE-${i + 1}`, ...extra(i) }),
  );
}

function incidenciaPrevia(extra = {}) {
  return {
    clave_incidencia: claveIncidencia(SUB_ID, REF_ISO),
    suscripcion_id: SUB_ID,
    ambiente: "prueba",
    operacion: "actualizacion_pre_renovacion",
    renovacion_ref: REF_ISO,
    intentos: 0,
    evaluaciones: 1,
    estado_final: "bloqueado",
    codigo_error: "cotizacion_no_disponible",
    alerta_nivel: null,
    proximo_intento_en: null,
    actualizada_en: faltando(60).toISOString(),
    ...extra,
  };
}

// ---------------------------------------------------------------- 1. Fail-closed sin migración

test("esquema de auditoría ausente (tabla o columna): no hay PUT, ni siquiera lecturas a MP", async () => {
  const columnasViejas = ["id", "suscripcion_id", "operacion", "importe_ars_anterior", "detalle", "creada_en"];
  for (const opcion of [{ fallaAuditoria: true }, { esquemaAuditoria: columnasViejas }]) {
    const mp = mpFalso({ importe: 6000 });
    const db = supabaseFalso([suscripcion()], opcion);
    const notificador = notificadorFalso();
    const r = await correr(faltando(30), { db, mp, notificador });
    assert.equal(r.ok, false, JSON.stringify(opcion));
    assert.equal(r.codigo, "auditoria_no_disponible");
    assert.equal(r.puts, 0);
    assert.equal(mp.estado.putsIntentados, 0);
    assert.equal(mp.estado.gets, 0, "detenido antes de tocar Mercado Pago");
    // el aviso no depende del esquema faltante: sale por el notificador (correo)
    assert.equal(notificador.lotes[0][0].tipo, "sistema");
    assert.equal(notificador.lotes[0][0].fila.codigo_error, "auditoria_no_disponible");
    assert.equal(db.heartbeats.get(JOB).ultimo_estado, "fallida");
  }
});

test("reserva atómica fallida: no se hace PUT y se frenan los PUT del resto del lote", async () => {
  const subs = lote(3);
  const mp = mpMultiple(subs.map((s) => s.preapproval_id));
  const db = supabaseFalso(subs, { fallaInsertAuditoria: true });
  const notificador = notificadorFalso();
  const r = await correr(faltando(30), { db, mp, notificador, candidatas: subs });
  assert.equal(mp.totalPuts(), 0);
  assert.deepEqual(
    r.operaciones.map((o) => o.accion),
    ["reserva_fallida", "detenido_por_auditoria", "detenido_por_auditoria"],
  );
  assert.equal(r.detenidoPorAuditoria, true);
  assert.ok(notificador.lotes[0].some((e) => e.fila.codigo_error === "reserva_fallida"));
  assert.equal(db.heartbeats.get(JOB).ultimo_estado, "parcial");
});

// ---------------------------------------------------------------- 2. Después de la fecha de cobro

test("fecha de cobro vencida: no hay PUT, queda incidencia y alerta", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso();
  const notificador = notificadorFalso();
  const r = await correr(faltando(-1), { db, mp, notificador });
  assert.equal(r.operaciones[0].codigo, "renovacion_vencida");
  assert.equal(mp.estado.putsIntentados, 0);
  assert.equal(db.auditoria[0].codigo_error, "renovacion_vencida");
  assert.equal(db.auditoria[0].estado_final, "bloqueado");
  assert.equal(notificador.lotes[0][0].nivel, "critico");
});

test("cobro inminente (margen previo): no hay PUT; con importe ya correcto no hay incidencia", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso();
  const r = await correr(faltando(10 / 60), { db, mp });
  assert.equal(r.operaciones[0].codigo, "cobro_inminente");
  assert.equal(mp.estado.putsIntentados, 0);

  const mpOk = mpFalso({ importe: 6552 });
  const dbOk = supabaseFalso();
  const ok = await correr(faltando(-2), { db: dbOk, mp: mpOk });
  assert.equal(ok.operaciones[0].motivo, "importe_ya_vigente");
  assert.equal(dbOk.auditoria.length, 0);
});

test("Mercado Pago avanza la próxima fecha entre la lectura y el PUT: se bloquea sin PUT", async () => {
  const mp = mpFalso({ importe: 6000, cambioFecha: { trasGets: 1, next: "2026-12-30T23:00:00Z" } });
  const db = supabaseFalso();
  const notificador = notificadorFalso();
  const r = await correr(faltando(30), { db, mp, notificador });
  assert.equal(mp.estado.putsIntentados, 0);
  assert.equal(r.operaciones[0].codigo, "proxima_fecha_cambio");
  assert.equal(db.auditoria[0].codigo_error, "proxima_fecha_cambio");
  assert.equal(db.auditoria[0].intentos, 0, "no consume un intento de PUT");
  assert.equal(db.auditoria[0].renovacion_ref, REF_ISO, "la incidencia queda atada al período original");
  assert.equal(notificador.lotes[0][0].nivel, "urgente", "incertidumbre de período: aviso inmediato");
});

test("reglas puras: vencida y cobro inminente bloquean; nada se fuerza", () => {
  const base = {
    suscripcion: suscripcion(),
    cotizacion: { ok: true, edadDias: 0, cotizacion: { venta: textoArAEscala4("1.560,00") } },
  };
  const remoto = { status: "authorized", next_payment_date: PROXIMA, auto_recurring: { transaction_amount: 6000 } };
  assert.equal(evaluarActualizacionArsPreRenovacion({ ...base, remoto, ahora: faltando(0) }).codigo, "renovacion_vencida");
  assert.equal(evaluarActualizacionArsPreRenovacion({ ...base, remoto, ahora: faltando(-5) }).codigo, "renovacion_vencida");
  assert.equal(evaluarActualizacionArsPreRenovacion({ ...base, remoto, ahora: faltando(0.2) }).codigo, "cobro_inminente");
  assert.equal(evaluarActualizacionArsPreRenovacion({ ...base, remoto, ahora: faltando(0.3) }).accion, "put_preapproval");
});

// ---------------------------------------------------------------- 3. Paginación

test("más de 25 suscripciones: se evalúan todas, una vez cada una, con lecturas acotadas", async () => {
  const subs = lote(60);
  const mp = mpMultiple(subs.map((s) => s.preapproval_id), { importe: 6552 });
  const db = supabaseFalso(subs);
  const r = await correr(faltando(30), { db, mp, tamanoPagina: 7 });
  assert.equal(r.evaluadas, 60);
  assert.equal(r.lectura.total, 60);
  assert.equal(r.lectura.paginas, 9, "60 / 7 = 8 páginas completas + la última con 4");
  assert.equal(db.consultasSuscripciones(), 9, "cada consulta lleva límite; ninguna lectura global");
  assert.ok([...mp.porId.values()].every((s) => s.gets === 1), "cada suscripción se consulta una sola vez");
  assert.equal(r.truncada, false);
  assert.equal(db.heartbeats.get(JOB).ultimo_estado, "ok");
});

test("más de 25 suscripciones con PUT: todas se actualizan exactamente una vez", async () => {
  const subs = lote(40);
  const mp = mpMultiple(subs.map((s) => s.preapproval_id), { importe: 6000 });
  const db = supabaseFalso(subs);
  const r = await correr(faltando(30), { db, mp });
  assert.equal(r.puts, 40);
  assert.ok([...mp.porId.values()].every((s) => s.putsAplicados === 1 && s.importe === 6552));
  assert.equal(db.auditoria.filter((f) => f.estado_final === "resuelto").length, 40);
});

test("paginación entre lotes: una página caída no corta la corrida ni da por vencido lo no leído", async () => {
  const subs = lote(35);
  const mp = mpMultiple(subs.map((s) => s.preapproval_id), { importe: 6552 });
  // incidencia abierta con cobro pasado de una suscripción que NO se llegó a leer
  const ultima = subs[34];
  const db = supabaseFalso(subs, {
    fallaDesdePagina: 3,
    auditoria: [
      incidenciaPrevia({
        clave_incidencia: claveIncidencia(ultima.id, "2026-11-20T00:00:00.000Z"),
        suscripcion_id: ultima.id,
        renovacion_ref: "2026-11-20T00:00:00.000Z",
      }),
    ],
  });
  const notificador = notificadorFalso();
  const r = await correr(faltando(30), { db, mp, notificador, tamanoPagina: 10 });
  assert.equal(r.ok, true);
  assert.equal(r.lectura.parcial, true);
  assert.equal(r.evaluadas, 20);
  assert.equal(db.auditoria[0].estado_final, "bloqueado", "lectura parcial: no se marca vencida");
  assert.ok(notificador.lotes[0].some((e) => e.fila.codigo_error === "lectura_parcial"));
  assert.equal(db.heartbeats.get(JOB).ultimo_estado, "parcial");
});

test("un error inesperado en una suscripción no corta el lote", async () => {
  const subs = lote(3);
  const mp = mpMultiple(subs.map((s) => s.preapproval_id), { importe: 6000 });
  const db = supabaseFalso(subs, { updateSuscripcionLanza: subs[1].id });
  const r = await correr(faltando(30), { db, mp });
  assert.equal(r.evaluadas, 3);
  assert.equal(r.errores, 1);
  assert.equal(mp.totalPuts(), 3);
  assert.ok(r.operaciones.some((o) => o.accion === "error_inesperado"));
});

test("mismo id repetido en la entrada: se procesa una sola vez", async () => {
  const mp = mpMultiple(["PRE-1"], { importe: 6000 });
  const s = suscripcion({ id: uuid(1), preapproval_id: "PRE-1" });
  const r = await correr(faltando(30), { db: supabaseFalso([s]), mp, candidatas: [s, { ...s }, s] });
  assert.equal(r.evaluadas, 1);
  assert.equal(mp.totalPuts(), 1);
  assert.equal(sinDuplicados([s, s, { ...s, id: uuid(2) }]).length, 2);
});

test("presupuesto de tiempo: más urgentes primero, el resto se informa y no se marca vencido", async () => {
  const subs = lote(5, (i) => ({ proxima_renovacion: `2026-11-${String(30 - i).padStart(2, "0")}T12:00:00Z` }));
  // la más urgente (fecha local menor) es la última del arreglo
  const urgente = subs[4];
  const mp = mpMultiple(subs.map((s) => s.preapproval_id), { importe: 6000 });
  let t = 0;
  const reloj = () => t;
  const lento = async (url, init) => {
    t += 5000; // cada llamada a MP "tarda" 5 s
    return mp.fetchFn(url, init);
  };
  const pendiente = subs[0];
  const db = supabaseFalso(subs, {
    auditoria: [
      incidenciaPrevia({
        clave_incidencia: claveIncidencia(pendiente.id, "2026-11-20T00:00:00.000Z"),
        suscripcion_id: pendiente.id,
        renovacion_ref: "2026-11-20T00:00:00.000Z",
      }),
    ],
  });
  const notificador = notificadorFalso();
  const r = await ejecutarCronRenovacionImportePlus({
    env,
    ahora: faltando(30),
    supabase: db,
    fetchFn: lento,
    obtenerCotizacion: BNA_OK,
    notificar: notificador.notificar,
    presupuestoMs: 12000,
    reloj,
  });
  assert.equal(r.truncada, true);
  assert.equal(r.evaluadas, 1);
  assert.equal(r.sinProcesar, 4);
  assert.equal(r.operaciones[0].suscripcionId, urgente.id);
  assert.equal(db.auditoria.find((f) => f.suscripcion_id === pendiente.id).estado_final, "bloqueado");
  assert.ok(notificador.lotes[0].some((e) => e.fila.codigo_error === "corrida_truncada"));
});

test("orden de urgencia: sin fecha primero, luego la más próxima", () => {
  const orden = ordenarPorUrgencia([
    { id: "c", proxima_renovacion: "2026-12-10T00:00:00Z" },
    { id: "a", proxima_renovacion: null },
    { id: "b", proxima_renovacion: "2026-11-30T00:00:00Z" },
  ]).map((s) => s.id);
  assert.deepEqual(orden, ["a", "b", "c"]);
});

// ---------------------------------------------------------------- 4. Reintentos y frecuencia

async function simularCron({ horasEntreCorridas, desde = 71, hasta = 0.5 }) {
  const mp = mpFalso({ importe: 6000, putFalla: true });
  const db = supabaseFalso();
  const notificador = notificadorFalso();
  const intentosEn = [];
  for (let h = desde; h >= hasta; h -= horasEntreCorridas) {
    const antes = mp.estado.putsIntentados;
    await correr(faltando(h), { db, mp, notificador });
    if (mp.estado.putsIntentados > antes) intentosEn.push(h);
  }
  return { intentosEn, db, mp };
}

test("frecuencia: cron horario reparte los 5 intentos y deja ~50 h para actuar; 2 veces por día los agota a 23 h", async () => {
  const horario = await simularCron({ horasEntreCorridas: 1 });
  assert.deepEqual(horario.intentosEn, [71, 70, 68, 62, 50]);
  assert.equal(horario.mp.estado.putsIntentados, MAX_INTENTOS_PUT);
  assert.equal(horario.db.auditoria[0].estado_final, "agotado");
  assert.equal(horario.db.auditoria.length, 1);

  const dosPorDia = await simularCron({ horasEntreCorridas: 12 });
  assert.deepEqual(dosPorDia.intentosEn, [71, 59, 47, 35, 23]);
});

test("frecuencia: cron cada 30 min no satura MP (espera mínima entre PUT)", async () => {
  const { intentosEn } = await simularCron({ horasEntreCorridas: 0.5, desde: 71, hasta: 40 });
  for (let i = 1; i < intentosEn.length; i += 1) {
    assert.ok(intentosEn[i - 1] - intentosEn[i] >= 0.5, `PUT demasiado seguidos: ${intentosEn.join(",")}`);
  }
  assert.ok(intentosEn.length <= MAX_INTENTOS_PUT);
});

// ---------------------------------------------------------------- 5. Simultaneidad y alertas duplicadas

test("ejecuciones simultáneas con paginación: cada suscripción recibe un único PUT", async () => {
  const subs = lote(40);
  const mp = mpMultiple(subs.map((s) => s.preapproval_id), { importe: 6000 });
  const db = supabaseFalso(subs);
  await Promise.all([
    correr(faltando(30), { db, mp, tamanoPagina: 15 }),
    correr(faltando(30), { db, mp, tamanoPagina: 15 }),
    correr(faltando(30), { db, mp, tamanoPagina: 15 }),
  ]);
  assert.ok([...mp.porId.values()].every((s) => s.putsAplicados === 1));
  assert.equal(mp.totalPuts(), 40);
  assert.equal(db.auditoria.length, 40);
});

test("alertas duplicadas: dos corridas simultáneas sobre la misma incidencia envían un solo aviso", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso([suscripcion()], { auditoria: [incidenciaPrevia()] });
  const notificador = notificadorFalso();
  await Promise.all([
    correr(faltando(20), { db, mp, notificador, cotizacion: BNA_CAIDA }),
    correr(faltando(20), { db, mp, notificador, cotizacion: BNA_CAIDA }),
  ]);
  const incidencias = notificador.lotes.flat().filter((e) => e.tipo === "incidencia");
  assert.equal(incidencias.length, 1);
  assert.equal(db.auditoria[0].alerta_nivel, "urgente");
});

test("alerta no enviada: se libera la reserva y se reintenta", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso([suscripcion()], { auditoria: [incidenciaPrevia()] });
  await correr(faltando(20), { db, mp, notificador: notificadorFalso({ enviada: false }), cotizacion: BNA_CAIDA });
  assert.equal(db.auditoria[0].alerta_nivel, null);
  const buena = notificadorFalso();
  await correr(faltando(19), { db, mp, notificador: buena, cotizacion: BNA_CAIDA });
  assert.equal(buena.lotes.flat().filter((e) => e.tipo === "incidencia").length, 1);
});

// ---------------------------------------------------------------- 6. Heartbeat y monitoreo

test("cron que deja de ejecutarse: el heartbeat lo detecta sin depender de correos", async () => {
  const db = supabaseFalso();
  const t0 = faltando(30);
  await correr(t0, { db, mp: mpFalso({ importe: 6552 }) });

  const fila = (await leerHeartbeat(db, "prueba")).fila;
  assert.equal(fila.ultimo_estado, "ok");
  const min = (m) => new Date(t0.getTime() + m * 60000);
  assert.equal(evaluarHeartbeat(fila, { ahora: min(59) }).ok, true);
  const faltante = evaluarHeartbeat(fila, { ahora: min(240) });
  assert.deepEqual([faltante.ok, faltante.motivo], [false, "ejecucion_faltante"]);
  assert.equal(evaluarHeartbeat(fila, { ahora: min(100), edadMaximaMin: 60 }).motivo, "ejecucion_faltante");
  assert.equal(evaluarHeartbeat(null).motivo, "nunca_ejecutado");
  assert.equal(evaluarHeartbeat({ ...fila, ultimo_estado: "fallida" }, { ahora: min(5) }).motivo, "ultima_corrida_fallida");
  assert.equal(evaluarHeartbeat({ ...fila, ultimo_estado: "parcial" }, { ahora: min(5) }).ok, true);
});

test("heartbeat: una corrida fail-closed queda como fallida y el monitor la ve", async () => {
  const db = supabaseFalso([suscripcion()], { fallaAuditoria: true });
  await correr(faltando(30), { db, mp: mpFalso() });
  const fila = (await leerHeartbeat(db, "prueba")).fila;
  assert.equal(evaluarHeartbeat(fila, { ahora: faltando(29.9) }).motivo, "ultima_corrida_fallida");
});

test("monitor: usa su propio secreto, nunca CRON_SECRET, y sin configurar no autoriza", async () => {
  const e = { PLUS_MONITOR_SECRET: "monitor-secreto", CRON_SECRET: "cron-secreto" };
  assert.equal(monitorAutorizado("Bearer monitor-secreto", e), true);
  assert.equal(monitorAutorizado("Bearer cron-secreto", e), false);
  assert.equal(monitorAutorizado("monitor-secreto", e), false);
  assert.equal(monitorAutorizado("Bearer monitor-secretoX", e), false);
  assert.equal(monitorAutorizado("Bearer ", { PLUS_MONITOR_SECRET: "" }), false);

  const previo = { ...process.env };
  try {
    process.env.PLUS_MONITOR_SECRET = "monitor-secreto";
    process.env.CRON_SECRET = "cron-secreto";
    const { GET } = await import("../app/api/pagos/plus/heartbeat/route.js");
    const url = "http://localhost/api/pagos/plus/heartbeat";
    assert.equal((await GET(new Request(url))).status, 401);
    assert.equal((await GET(new Request(url, { headers: { authorization: "Bearer cron-secreto" } }))).status, 401);
    const sinServicio = await GET(new Request(url, { headers: { authorization: "Bearer monitor-secreto" } }));
    assert.equal(sinServicio.status, 503);
    assert.ok(!JSON.stringify(await sinServicio.json()).includes("secreto"));
  } finally {
    process.env = previo;
  }
});

// ---------------------------------------------------------------- 7. Ambientes

test("ambiente prueba no lee ni toca incidencias, suscripciones ni heartbeat de producción", async () => {
  const mp = mpFalso({ importe: 6552 });
  const produccion = suscripcion({ id: uuid(9), preapproval_id: "PRE-PROD", ambiente: "produccion" });
  const db = supabaseFalso([suscripcion(), produccion], {
    auditoria: [
      incidenciaPrevia({
        ambiente: "produccion",
        clave_incidencia: claveIncidencia(uuid(9), "2026-11-20T00:00:00.000Z"),
        suscripcion_id: uuid(9),
        renovacion_ref: "2026-11-20T00:00:00.000Z",
      }),
    ],
  });
  const r = await correr(faltando(30), { db, mp });
  assert.equal(r.evaluadas, 1, "solo la suscripción de prueba");
  assert.equal(db.auditoria[0].estado_final, "bloqueado", "incidencia de producción intacta");
  assert.deepEqual([...db.heartbeats.keys()], [JOB]);
  assert.equal(JOB, "renovacion-ars:prueba");
  assert.notEqual(nombreJob("produccion"), JOB);
});

test("vercel.json registra el cron horario de renovaci�n sin otros cambios de rutas Plus", () => {
  const { crons } = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const renovacion = crons.filter((c) => c.path === "/api/pagos/plus/renovar-importe");
  assert.deepEqual(renovacion, [{ path: "/api/pagos/plus/renovar-importe", schedule: "45 * * * *" }]);
  assert.ok(!crons.some((c) => c.path.includes("heartbeat")), "el heartbeat lo consulta el monitor, no un cron");
});
