import assert from "node:assert/strict";
import test from "node:test";
import { ejecutarCronRenovacionImportePlus } from "../lib/pagos/plus/cron-renovacion-ars.js";
import { construirAlertaAdmin, enviarAlertaAdmin } from "../lib/pagos/plus/alertas-renovacion.js";
import {
  MAX_INTENTOS_PUT,
  calcularProximoIntento,
  claveIncidencia,
  debeNotificar,
  decidirReintento,
  nivelCorrespondiente,
} from "../lib/pagos/plus/incidencias-renovacion.js";
import {
  AHORA_EN_VENTANA,
  PRE_ID,
  PROXIMA,
  SUB_ID,
  cotizacionBna,
  env,
  mpFalso,
  notificadorFalso,
  suscripcion,
  supabaseFalso,
} from "./stubs/plus-renovacion-fakes.js";

process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST_TOKEN_OPERATIVA";

const REF_ISO = new Date(PROXIMA).toISOString();
const MIN = 60000;

/** Instante situado `horas` antes del cobro. */
function faltando(horas) {
  return new Date(new Date(PROXIMA).getTime() - horas * 3600000);
}

const BNA_OK = cotizacionBna("1.560,00"); // esperado 6552.00
const BNA_CAIDA = async () => ({ ok: false, codigo: "cotizacion_no_disponible" });

function entorno({ db, mp, notificador = notificadorFalso(), cotizacion = BNA_OK, candidatas } = {}) {
  return {
    correr: (ahora, extra = {}) =>
      ejecutarCronRenovacionImportePlus({
        env,
        ahora,
        supabase: db,
        fetchFn: mp.fetchFn,
        obtenerCotizacion: cotizacion,
        notificar: notificador.notificar,
        ...(candidatas ? { candidatas } : {}),
        ...extra,
      }),
    notificador,
  };
}

function incidenciaPrevia(extra = {}) {
  return {
    clave_incidencia: claveIncidencia(SUB_ID, REF_ISO),
    suscripcion_id: SUB_ID,
    ambiente: "prueba",
    operacion: "actualizacion_pre_renovacion",
    renovacion_ref: REF_ISO,
    intentos: 1,
    evaluaciones: 1,
    estado_final: "pendiente",
    alerta_nivel: null,
    proximo_intento_en: null,
    actualizada_en: faltando(60).toISOString(),
    ...extra,
  };
}

test("fallo temporal de BNA: una fila, sin alerta, y se resuelve en la corrida siguiente", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso();
  const notificador = notificadorFalso();
  const caida = entorno({ db, mp, notificador, cotizacion: BNA_CAIDA });
  const ok = entorno({ db, mp, notificador });

  const r1 = await caida.correr(faltando(56));
  assert.equal(r1.bloqueadas, 1);
  assert.equal(db.auditoria.length, 1);
  assert.equal(db.auditoria[0].estado_final, "bloqueado");
  assert.equal(db.auditoria[0].intentos, 0, "una falla local no consume intentos de PUT");
  assert.equal(notificador.lotes.length, 0, "un primer fallo temprano no genera ruido");

  const r2 = await ok.correr(faltando(50));
  assert.equal(r2.puts, 1);
  assert.equal(db.auditoria.length, 1, "misma fila, no duplicada");
  assert.equal(db.auditoria[0].estado_final, "resuelto");
  assert.equal(db.auditoria[0].preapproval_put_ok, true);
  assert.equal(notificador.lotes.length, 0);
  assert.equal(mp.estado.importe, 6552);
});

test("fallo permanente de BNA: una sola fila y alertas escalonadas sin repetir nivel", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso();
  const notificador = notificadorFalso();
  const e = entorno({ db, mp, notificador, cotizacion: BNA_CAIDA });

  for (const horas of [56, 50, 49, 20, 19, 5, 4]) await e.correr(faltando(horas));

  assert.equal(db.auditoria.length, 1, "siete corridas, una incidencia");
  assert.equal(db.auditoria[0].evaluaciones, 7);
  assert.equal(mp.estado.putsIntentados, 0, "sin BNA nunca se hace PUT");
  const niveles = notificador.lotes.map((lote) => lote.map((x) => x.nivel).join());
  assert.deepEqual(niveles, ["aviso", "urgente", "critico"]);
  assert.equal(db.auditoria[0].alerta_nivel, "critico");
  assert.equal(db.auditoria[0].estado_final, "bloqueado");
});

test("fallo del PUT: reintentos con espera, tope de intentos y alerta de agotamiento", async () => {
  const mp = mpFalso({ importe: 6000, putFalla: true });
  const db = supabaseFalso();
  const notificador = notificadorFalso();
  const e = entorno({ db, mp, notificador });
  const t0 = faltando(56);

  await e.correr(t0);
  assert.equal(mp.estado.putsIntentados, 1);
  assert.equal(db.auditoria[0].intentos, 1);
  assert.equal(db.auditoria[0].estado_final, "pendiente");
  assert.equal(db.auditoria[0].codigo_error, "put_rechazado");

  const inmediata = await e.correr(new Date(t0.getTime() + 5 * MIN));
  assert.equal(inmediata.operaciones[0].accion, "espera_entre_reintentos");
  assert.equal(mp.estado.putsIntentados, 1, "no se satura a Mercado Pago");

  let t = t0;
  for (const espera of [31, 121, 361, 721]) {
    t = new Date(t.getTime() + espera * MIN);
    await e.correr(t);
  }
  assert.equal(mp.estado.putsIntentados, MAX_INTENTOS_PUT);
  assert.equal(db.auditoria[0].estado_final, "agotado");
  assert.equal(db.auditoria[0].proximo_intento_en, null);

  const despues = await e.correr(new Date(t.getTime() + 24 * 3600000 - 1 * MIN));
  assert.equal(despues.operaciones[0].accion, "reintentos_agotados");
  assert.equal(mp.estado.putsIntentados, MAX_INTENTOS_PUT, "agotado: ya no se toca MP");
  assert.equal(db.auditoria.length, 1);

  const niveles = notificador.lotes.map((lote) => lote[0].nivel);
  assert.deepEqual(niveles, ["aviso", "agotado"], "aviso al repetirse y agotado una sola vez");
});

test("GET de confirmación inconsistente: queda importe esperado vs remoto", async () => {
  const mp = mpFalso({ importe: 6000, putIgnorado: true });
  const db = supabaseFalso();
  const e = entorno({ db, mp });

  await e.correr(faltando(30));
  const fila = db.auditoria[0];
  assert.equal(fila.codigo_error, "put_no_confirmado");
  assert.equal(Number(fila.importe_ars_nuevo), 6552);
  assert.equal(fila.importe_remoto_ars, 6000);
  assert.equal(fila.estado_final, "pendiente");
});

test("GET de confirmación caído tras un PUT aplicado: la corrida siguiente no repite el PUT", async () => {
  const mp = mpFalso({ importe: 6000, getConfirmacionFalla: true });
  const db = supabaseFalso();
  const e = entorno({ db, mp });
  const t0 = faltando(30);

  const r1 = await e.correr(t0);
  assert.equal(r1.operaciones[0].codigo, "confirmacion_get_fallida");
  assert.equal(db.auditoria[0].codigo_error, "confirmacion_get_fallida");
  assert.equal(mp.estado.puts.length, 1);

  const r2 = await e.correr(new Date(t0.getTime() + 31 * MIN));
  assert.equal(r2.operaciones[0].motivo, "importe_ya_vigente");
  assert.equal(mp.estado.puts.length, 1, "idempotente: MP ya tenía el importe");
  assert.equal(db.auditoria[0].estado_final, "resuelto");
  assert.equal(db.auditoria[0].detalle, "importe_ya_vigente");
});

test("reintento exitoso: dos intentos, una fila, resuelta; con alerta previa avisa la resolución", async () => {
  const mp = mpFalso({ importe: 6000, putFalla: 1 });
  const db = supabaseFalso();
  const notificador = notificadorFalso();
  const e = entorno({ db, mp, notificador });
  const t0 = faltando(20); // urgente: alerta inmediata en el primer fallo

  await e.correr(t0);
  assert.equal(notificador.lotes.length, 1);
  assert.equal(notificador.lotes[0][0].nivel, "urgente");
  assert.equal(db.auditoria[0].alerta_nivel, "urgente");

  const r2 = await e.correr(new Date(t0.getTime() + 31 * MIN));
  assert.equal(r2.puts, 1);
  assert.equal(db.auditoria.length, 1);
  assert.equal(db.auditoria[0].intentos, 2);
  assert.equal(db.auditoria[0].estado_final, "resuelto");
  assert.equal(mp.estado.puts.length, 1);
  assert.equal(notificador.lotes.length, 2);
  assert.equal(notificador.lotes[1][0].tipo, "resuelta");
});

test("fecha de cobro cercana: alerta crítica al primer fallo y espera acotada", async () => {
  const mp = mpFalso({ importe: 6000, putFalla: true });
  const db = supabaseFalso();
  const notificador = notificadorFalso();
  await entorno({ db, mp, notificador }).correr(faltando(3));
  assert.equal(notificador.lotes[0][0].nivel, "critico");

  const base = new Date("2026-11-30T12:00:00Z");
  assert.equal(calcularProximoIntento({ intentos: 2, ahora: base, horasHasta: 50 }), new Date(base.getTime() + 120 * MIN).toISOString());
  assert.equal(calcularProximoIntento({ intentos: 2, ahora: base, horasHasta: 3 }), new Date(base.getTime() + 30 * MIN).toISOString());
  assert.equal(calcularProximoIntento({ intentos: MAX_INTENTOS_PUT, ahora: base, horasHasta: 3 }), null);
});

test("ejecuciones simultáneas: el primer intento se reserva de forma atómica (un solo PUT)", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso();
  const notificador = notificadorFalso();
  const e = entorno({ db, mp, notificador });

  const [a, b] = await Promise.all([e.correr(faltando(30)), e.correr(faltando(30))]);
  assert.equal(mp.estado.putsIntentados, 1);
  assert.equal(a.puts + b.puts, 1);
  const omitida = [a, b].flatMap((r) => r.operaciones).find((o) => o.motivo === "intento_en_curso_otra_ejecucion");
  assert.ok(omitida, "la otra corrida se retira sin tocar MP");
  assert.equal(db.auditoria.length, 1);
});

test("ejecuciones simultáneas sobre una incidencia existente: compare-and-set sobre intentos", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso([suscripcion()], { auditoria: [incidenciaPrevia({ proximo_intento_en: faltando(40).toISOString() })] });
  const e = entorno({ db, mp });

  const [a, b, c] = await Promise.all([e.correr(faltando(30)), e.correr(faltando(30)), e.correr(faltando(30))]);
  assert.equal(mp.estado.putsIntentados, 1);
  assert.equal(a.puts + b.puts + c.puts, 1);
  assert.equal(db.auditoria[0].intentos, 2, "un único intento adicional reservado");
});

test("suscripción pausada o cancelada: no se actúa y la incidencia abierta se descarta", async () => {
  for (const variante of [{ status: "paused" }, { status: "cancelled" }, { status: "authorized", local: "cancelada" }]) {
    const mp = mpFalso({ importe: 6000, status: variante.status });
    const db = supabaseFalso([suscripcion()], {
      auditoria: [incidenciaPrevia({ alerta_nivel: "urgente", estado_final: "bloqueado" })],
    });
    const notificador = notificadorFalso();
    const e = entorno({
      db,
      mp,
      notificador,
      candidatas: [suscripcion({ estado_interno: variante.local || "activa" })],
    });
    const r = await e.correr(faltando(30));
    assert.equal(mp.estado.putsIntentados, 0, JSON.stringify(variante));
    assert.equal(r.puts, 0);
    assert.equal(db.auditoria[0].estado_final, "descartado");
    assert.equal(notificador.lotes[0][0].tipo, "resuelta");
  }
});

test("el importe ya coincide: no hay PUT ni fila de auditoría", async () => {
  const mp = mpFalso({ importe: 6552 });
  const db = supabaseFalso();
  const r = await entorno({ db, mp }).correr(faltando(30));
  assert.equal(r.operaciones[0].motivo, "importe_ya_vigente");
  assert.equal(mp.estado.putsIntentados, 0);
  assert.equal(db.auditoria.length, 0);
});

test("incidencia abierta cuyo cobro ya pasó sin resolución: se marca vencida y se avisa", async () => {
  const mp = mpFalso({ importe: 6552, next: "2026-12-30T23:00:00Z" });
  const db = supabaseFalso([suscripcion()], { auditoria: [incidenciaPrevia({ estado_final: "agotado", alerta_nivel: "agotado" })] });
  const notificador = notificadorFalso();
  await entorno({ db, mp, notificador }).correr(new Date("2026-12-01T12:00:00Z"));
  assert.equal(db.auditoria[0].estado_final, "vencida");
  assert.equal(notificador.lotes[0][0].tipo, "vencida");
});

test("protección de Mercado Pago: tras un 429 se frenan las escrituras del lote", async () => {
  const mp = mpFalso({ importe: 6000, putFalla: true, putStatus: 429 });
  const db = supabaseFalso();
  const candidatas = ["a", "b", "c"].map((x) => suscripcion({ id: `00000000-0000-0000-0000-00000000000${x === "a" ? 1 : x === "b" ? 2 : 3}` }));
  const r = await entorno({ db, mp, candidatas }).correr(faltando(30));
  assert.equal(mp.estado.putsIntentados, 1);
  assert.equal(r.cortePorErroresMp, true);
  assert.equal(r.diferidas, 2);
  assert.deepEqual(
    r.operaciones.map((o) => o.accion).filter((a) => a !== "omitir"),
    ["put_fallido", "diferido_proteccion_mp", "diferido_proteccion_mp"],
  );
  assert.equal(db.auditoria.filter((f) => f.codigo_error === "mp_proteccion_activada").length, 2);
  assert.equal(db.auditoria.find((f) => f.codigo_error === "mp_proteccion_activada").intentos, 0, "diferir no consume intentos");
});

test("la alerta que no se pudo enviar se reintenta y luego no se repite", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso();
  const caida = entorno({ db, mp, cotizacion: BNA_CAIDA, notificador: notificadorFalso({ enviada: false }) });
  const sana = entorno({ db, mp, cotizacion: BNA_CAIDA });

  await caida.correr(faltando(20));
  assert.equal(db.auditoria[0].alerta_nivel, null, "sin envío no se marca como notificada");
  await sana.correr(faltando(19));
  assert.equal(sana.notificador.lotes.length, 1);
  assert.equal(db.auditoria[0].alerta_nivel, "urgente");
  await sana.correr(faltando(18));
  assert.equal(sana.notificador.lotes.length, 1, "mismo nivel: sin repetir");
});

test("auditoría sin migrar: fail-closed (ver también tests de hardening)", async () => {
  const mp = mpFalso({ importe: 6000 });
  const db = supabaseFalso([suscripcion()], { fallaAuditoria: true });
  const notificador = notificadorFalso();
  const r = await entorno({ db, mp, notificador }).correr(faltando(30));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "auditoria_no_disponible");
  assert.equal(mp.estado.putsIntentados, 0);
  assert.equal(notificador.lotes[0][0].tipo, "sistema");
});

test("dry-run: ni alertas ni escrituras ni PUT", async () => {
  const mp = mpFalso({ importe: 6000 });
  const notificador = notificadorFalso();
  const r = await ejecutarCronRenovacionImportePlus({
    env,
    ahora: faltando(10),
    dryRun: true,
    supabase: null,
    fetchFn: mp.fetchFn,
    candidatas: [suscripcion()],
    obtenerCotizacion: BNA_CAIDA,
    notificar: notificador.notificar,
  });
  assert.equal(r.bloqueadas, 1);
  assert.equal(notificador.lotes.length, 0);
  assert.equal(mp.estado.putsIntentados, 0);
});

test("reglas puras de reintento y alerta", () => {
  const ahora = new Date("2026-11-29T12:00:00Z");
  assert.equal(decidirReintento({ incidencia: null, ahora }).permitido, true);
  assert.equal(decidirReintento({ incidencia: { intentos: MAX_INTENTOS_PUT }, ahora }).motivo, "reintentos_agotados");
  assert.equal(decidirReintento({ incidencia: { intentos: 1, proximo_intento_en: "2026-11-29T12:10:00Z" }, ahora }).permitido, false);
  assert.equal(decidirReintento({ incidencia: { intentos: 1, proximo_intento_en: "2026-11-29T11:59:00Z" }, ahora }).permitido, true);

  assert.equal(nivelCorrespondiente({ estadoFinal: "pendiente", horasHasta: 50, evaluaciones: 1 }), null);
  assert.equal(nivelCorrespondiente({ estadoFinal: "pendiente", horasHasta: 50, evaluaciones: 2 }), "aviso");
  assert.equal(nivelCorrespondiente({ estadoFinal: "pendiente", horasHasta: 24, evaluaciones: 1 }), "urgente");
  assert.equal(nivelCorrespondiente({ estadoFinal: "pendiente", horasHasta: 6, evaluaciones: 1 }), "critico");
  assert.equal(nivelCorrespondiente({ estadoFinal: "pendiente", horasHasta: null, evaluaciones: 1 }), "urgente");
  assert.equal(nivelCorrespondiente({ estadoFinal: "agotado", horasHasta: 60, evaluaciones: 1 }), "agotado");
  assert.equal(debeNotificar("urgente", "aviso"), true);
  assert.equal(debeNotificar("aviso", "urgente"), false);
  assert.equal(debeNotificar("urgente", "urgente"), false);
  assert.equal(debeNotificar(null, null), false);
});

test("alerta administrativa: contenido útil, sin datos sensibles y sin romper si falla el envío", async () => {
  const fila = {
    suscripcion_id: SUB_ID,
    renovacion_ref: REF_ISO,
    codigo_error: "put_no_confirmado",
    intentos: 2,
    importe_ars_nuevo: "6804.00",
    importe_remoto_ars: 6552,
    estado_final: "pendiente",
    proximo_intento_en: "2026-11-29T13:00:00Z",
  };
  const { asunto, cuerpo } = construirAlertaAdmin(
    [{ tipo: "incidencia", nivel: "critico", fila, horasHasta: 5.5, preapprovalId: PRE_ID, maxIntentos: 4 }],
    { ahora: AHORA_EN_VENTANA },
  );
  assert.match(asunto, /1 crítica/);
  assert.match(cuerpo, /CRITICO/);
  assert.match(cuerpo, /intentos PUT 2\/4/);
  assert.match(cuerpo, /DE MENOS/);
  assert.ok(!cuerpo.includes(PRE_ID), "no se publica el id completo de Mercado Pago");
  assert.ok(!/TEST_TOKEN|Bearer/.test(cuerpo));

  const evento = [{ tipo: "incidencia", nivel: "urgente", fila, horasHasta: 10, preapprovalId: PRE_ID }];
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await enviarAlertaAdmin(evento, { env: {} }), { enviada: false, motivo: "sin_configuracion" });
    const enviados = [];
    const conCanal = { RESEND_API_KEY: "k", RESEND_FROM_EMAIL: "a@enflora.test", PLUS_ALERT_EMAIL: "admin@enflora.test" };
    const ok = await enviarAlertaAdmin(evento, { env: conCanal, enviarCorreo: async (m) => enviados.push(m) });
    assert.equal(ok.enviada, true);
    assert.equal(enviados[0].to, "admin@enflora.test");
    const falla = await enviarAlertaAdmin(evento, {
      env: conCanal,
      enviarCorreo: async () => {
        throw new Error("resend_caido");
      },
    });
    assert.deepEqual(falla, { enviada: false, motivo: "envio_fallido" });
  } finally {
    console.error = original;
  }
});
