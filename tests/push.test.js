import assert from "node:assert/strict";
import test from "node:test";
import { enviarUna, procesarCampana } from "../lib/push/campana.js";
import {
  CLAVE_CAMPANA_LANZAMIENTO,
  ZONA_LANZAMIENTO,
  clasificarResultadoPush,
  clasificarSoporte,
  claveAplicacionABytes,
  claveIdempotenciaCampana,
  clavePublicaVapidValida,
  decisionCampana,
  endpointPushValido,
  hostPushPermitido,
  iosAceptaPush,
  mapaConcurrencia,
  normalizarSuscripcion,
  rutaDestino,
  sujetoVapidValido,
  versionIosDesdeAgente,
} from "../lib/push/reglas.js";
import { bearerCoincide, cronAutorizado, pruebaAutorizada } from "../lib/push/secreto.js";

const CAMPANA = {
  id: "11111111-1111-4111-8111-111111111111",
  clave: CLAVE_CAMPANA_LANZAMIENTO,
  titulo: "¡Enflora ya está disponible!",
  mensaje:
    "Flora te espera para comenzar a registrar tus cultivos. Entrá y descubrí todo lo que preparamos",
  url: "https://enflora.com.ar/",
  programada_para: "2026-11-01T12:00:00.000Z",
  zona_horaria: ZONA_LANZAMIENTO,
  habilitada: true,
  estado: "programada",
};

const SUSCRIPCION = {
  id: "22222222-2222-4222-8222-222222222222",
  endpoint: "https://fcm.googleapis.com/fcm/send/dispositivo",
  p256dh: "A".repeat(80),
  auth: "B".repeat(22),
  expira_en: null,
};

function clavePublica() {
  return Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");
}

test("solo acepta servicios push conocidos", () => {
  assert.equal(hostPushPermitido("fcm.googleapis.com"), true);
  assert.equal(hostPushPermitido("web.push.apple.com"), true);
  assert.equal(hostPushPermitido("wns2-par02p.notify.windows.com"), true);
  assert.equal(hostPushPermitido("updates.push.services.mozilla.com"), true);
  assert.equal(hostPushPermitido("example.com"), false);
  assert.equal(
    endpointPushValido("https://usuario:clave@fcm.googleapis.com/fcm/send/a"),
    null,
  );
  assert.equal(endpointPushValido("http://fcm.googleapis.com/fcm/send/a"), null);
  assert.equal(
    endpointPushValido("https://fcm.googleapis.com/fcm/send/dispositivo"),
    "https://fcm.googleapis.com/fcm/send/dispositivo",
  );
});

test("la suscripción rechaza destinos ajenos y claves cortas", () => {
  assert.equal(
    normalizarSuscripcion({
      endpoint: "https://example.com/push",
      claves: { p256dh: "A".repeat(80), auth: "B".repeat(22) },
      origen: "landing",
    }),
    null,
  );
  assert.equal(
    normalizarSuscripcion({
      endpoint: "https://fcm.googleapis.com/fcm/send/dispositivo",
      claves: { p256dh: "corta", auth: "B".repeat(22) },
      origen: "landing",
    }),
    null,
  );
  const valida = normalizarSuscripcion({
    endpoint: " https://web.push.apple.com/un-dispositivo ",
    claves: { p256dh: "A".repeat(80), auth: "B".repeat(22) },
    origen: "app",
    plataforma: "ios",
  });
  assert.equal(valida.origen, "app");
  assert.equal(valida.plataforma, "ios");
  assert.equal(valida.endpoint, "https://web.push.apple.com/un-dispositivo");
});

test("el destino de la notificación queda dentro de Enflora", () => {
  assert.equal(rutaDestino("https://enflora.com.ar/espacios?alta=1"), "/espacios?alta=1");
  assert.equal(rutaDestino("https://www.enflora.com.ar/"), "/");
  assert.equal(rutaDestino("/registro"), "/registro");
  assert.equal(rutaDestino("https://evil.com/"), null);
  assert.equal(rutaDestino("javascript:alert(1)"), null);
  assert.equal(rutaDestino("//enflora.com.ar"), null);
  assert.equal(rutaDestino("https://usuario:clave@enflora.com.ar/"), null);
  assert.equal(
    rutaDestino("http://localhost:3000/espacios", "http://localhost:3000"),
    "/espacios",
  );
  assert.equal(rutaDestino("http://localhost:3000/espacios", "https://enflora.com.ar"), null);
});

test("la clave pública VAPID se puede convertir y el asunto se valida", () => {
  const publica = clavePublica();
  assert.equal(clavePublicaVapidValida(publica), true);
  assert.equal(claveAplicacionABytes(publica).length, 65);
  assert.equal(claveAplicacionABytes("no-es-una-clave"), null);
  assert.equal(sujetoVapidValido("mailto:contacto@enflora.com.ar"), true);
  assert.equal(sujetoVapidValido("https://enflora.com.ar"), true);
  assert.equal(sujetoVapidValido("http://enflora.com.ar"), false);
});

test("iPhone sin instalación no pide permiso y uno viejo no es compatible", () => {
  assert.equal(iosAceptaPush(versionIosDesdeAgente("iPhone OS 16_3 like Mac OS X")), false);
  assert.equal(iosAceptaPush(versionIosDesdeAgente("iPhone OS 16_4 like Mac OS X")), true);
  assert.equal(
    clasificarSoporte({
      tieneServiceWorker: true,
      tienePush: true,
      tieneNotificacion: true,
      esIos: true,
      instalada: false,
      versionIos: { mayor: 18, menor: 0 },
      permiso: "default",
    }),
    "requiere-instalacion",
  );
  assert.equal(
    clasificarSoporte({
      tieneServiceWorker: true,
      tienePush: true,
      tieneNotificacion: true,
      esIos: true,
      instalada: true,
      versionIos: { mayor: 15, menor: 6 },
      permiso: "default",
    }),
    "no-compatible",
  );
  assert.equal(
    clasificarSoporte({
      tieneServiceWorker: true,
      tienePush: true,
      tieneNotificacion: true,
      esIos: false,
      instalada: false,
      versionIos: null,
      permiso: "denied",
    }),
    "denegado",
  );
  assert.equal(
    clasificarSoporte({
      tieneServiceWorker: false,
      tienePush: true,
      tieneNotificacion: true,
      esIos: false,
      instalada: false,
      versionIos: null,
      permiso: "default",
    }),
    "no-compatible",
  );
});

test("la campaña sigue apagada sin autorización, fecha o destino", () => {
  const ahora = Date.parse("2026-11-01T13:00:00.000Z");
  assert.equal(decisionCampana(CAMPANA, ahora, false).motivo, "activacion");
  assert.equal(decisionCampana({ ...CAMPANA, habilitada: false }, ahora, true).motivo, "deshabilitada");
  assert.equal(decisionCampana(CAMPANA, Date.parse("2026-10-31T12:00:00.000Z"), true).motivo, "pendiente");
  assert.equal(decisionCampana({ ...CAMPANA, estado: "completada" }, ahora, true).motivo, "completada");
  assert.equal(decisionCampana({ ...CAMPANA, url: "https://evil.com/" }, ahora, true).motivo, "destino");
  assert.equal(decisionCampana({ ...CAMPANA, zona_horaria: "UTC" }, ahora, true).motivo, "zona");
  const lista = decisionCampana(CAMPANA, ahora, true);
  assert.equal(lista.ejecutar, true);
  assert.equal(lista.ruta, "/");
});

test("la clave de idempotencia no cambia entre intentos", () => {
  const clave = claveIdempotenciaCampana(CAMPANA.id, SUSCRIPCION.id);
  assert.equal(clave, claveIdempotenciaCampana(CAMPANA.id, SUSCRIPCION.id));
  assert.match(clave, /^campana:/);
});

test("aceptar el envío no significa que el dispositivo lo haya mostrado", () => {
  assert.deepEqual(clasificarResultadoPush(201), {
    estado: "aceptado",
    expirada: false,
    visualizado: false,
  });
  assert.equal(clasificarResultadoPush(410).expirada, true);
  assert.equal(clasificarResultadoPush(404).estado, "expirado");
  assert.equal(clasificarResultadoPush(429).estado, "error");
  assert.equal(clasificarResultadoPush(500).visualizado, false);
});

test("la concurrencia no supera el límite", async () => {
  let enCurso = 0;
  let maximo = 0;
  const salida = await mapaConcurrencia([1, 2, 3, 4, 5], 2, async (item) => {
    enCurso += 1;
    maximo = Math.max(maximo, enCurso);
    await new Promise((resolver) => setTimeout(resolver, 20));
    enCurso -= 1;
    return item * 2;
  });
  assert.ok(maximo <= 2);
  assert.deepEqual(salida, [2, 4, 6, 8, 10]);
  assert.deepEqual(await mapaConcurrencia([], 2, async () => 1), []);
});

test("sin autorización de servidor no se consulta la campaña", async () => {
  let lecturas = 0;
  const resultado = await procesarCampana(
    {
      activacion: false,
      leerCampana: async () => {
        lecturas += 1;
        return CAMPANA;
      },
    },
    Date.parse("2026-11-01T13:00:00.000Z"),
  );
  assert.equal(resultado.omitido, "activacion");
  assert.equal(lecturas, 0);
});

test("una campaña deshabilitada no despacha notificaciones", async () => {
  let despachos = 0;
  const resultado = await procesarCampana(
    {
      activacion: true,
      leerCampana: async () => ({ ...CAMPANA, habilitada: false }),
      despachar: async () => {
        despachos += 1;
        return { statusCode: 201 };
      },
    },
    Date.parse("2026-11-01T13:00:00.000Z"),
  );
  assert.equal(resultado.omitido, "deshabilitada");
  assert.equal(despachos, 0);
});

test("un envío ya registrado no se repite", async () => {
  let despachos = 0;
  const resultado = await enviarUna(
    CAMPANA,
    SUSCRIPCION,
    "/",
    {
      reclamar: async () => null,
      despachar: async () => {
        despachos += 1;
        return { statusCode: 201 };
      },
    },
    Date.parse("2026-11-01T13:00:00.000Z"),
  );
  assert.equal(resultado.estado, "ya-registrado");
  assert.equal(despachos, 0);
});

test("una respuesta 410 desactiva la suscripción y no cuenta como vista", async () => {
  const desactivadas = [];
  const guardados = [];
  const resultado = await enviarUna(
    CAMPANA,
    SUSCRIPCION,
    "/",
    {
      reclamar: async () => "envio-1",
      guardarResultado: async (fila) => guardados.push(fila),
      desactivar: async (id, motivo) => desactivadas.push({ id, motivo }),
      despachar: async () => {
        const error = new Error("gone");
        error.statusCode = 410;
        error.body = "unsubscribed";
        throw error;
      },
    },
    Date.parse("2026-11-01T13:00:00.000Z"),
  );
  assert.equal(resultado.estado, "expirado");
  assert.equal(resultado.visualizado, false);
  assert.equal(guardados[0].estado, "expirado");
  assert.deepEqual(desactivadas, [{ id: SUSCRIPCION.id, motivo: "expirada" }]);
});

test("una suscripción vencida se omite sin llamar al servicio push", async () => {
  let despachos = 0;
  const resultado = await enviarUna(
    CAMPANA,
    { ...SUSCRIPCION, expira_en: "2026-10-01T00:00:00.000Z" },
    "/",
    {
      reclamar: async () => "envio-2",
      guardarResultado: async () => {},
      desactivar: async () => {},
      despachar: async () => {
        despachos += 1;
        return { statusCode: 201 };
      },
    },
    Date.parse("2026-11-01T13:00:00.000Z"),
  );
  assert.equal(resultado.estado, "omitido");
  assert.equal(despachos, 0);
});

test("el cron y la prueba exigen su secreto", () => {
  assert.equal(cronAutorizado("Bearer secreto-cron", { CRON_SECRET: "secreto-cron", NODE_ENV: "production" }), true);
  assert.equal(cronAutorizado("Bearer otro", { CRON_SECRET: "secreto-cron", NODE_ENV: "production" }), false);
  assert.equal(cronAutorizado(null, { CRON_SECRET: "", NODE_ENV: "production" }), false);
  assert.equal(cronAutorizado(null, { CRON_SECRET: "", NODE_ENV: "development" }), true);
  assert.equal(pruebaAutorizada("Bearer 1234567890123456", { PUSH_PRUEBA_SECRETO: "1234567890123456" }), true);
  assert.equal(pruebaAutorizada("Bearer corto", { PUSH_PRUEBA_SECRETO: "corto" }), false);
  assert.equal(bearerCoincide("Bearer abc", "abcd"), false);
});
