import assert from "node:assert/strict";
import test from "node:test";
import { enviarUna, procesarCampana } from "../lib/push/campana.js";
import {
  CLAVE_CAMPANA_LANZAMIENTO,
  LIMITE_ALTAS,
  LIMITE_PRUEBAS_ADMIN,
  LIMITE_PRUEBAS_PUBLICAS,
  ZONA_LANZAMIENTO,
  evaluarCupo,
  segundosReintento,
  textoEspera,
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
  usuarioAdminPush,
  versionIosDesdeAgente,
} from "../lib/push/reglas.js";
import webpush from "web-push";
import { AVISO_PRUEBA, ejecutarPrueba, limitePrueba } from "../lib/push/prueba.js";
import { solicitudMismoOrigen } from "../lib/push/http.js";
import {
  bearerCoincide,
  cronAutorizado,
  hashRecibo,
  nuevoRecibo,
  parVapidCoincide,
  pruebaAutorizada,
  reciboValido,
} from "../lib/push/secreto.js";
import {
  LANZAMIENTO_MS,
  descripcionModalLanzamiento,
  lanzamientoPendiente,
} from "../lib/lanzamiento.js";
import { gatePrelanzamientoActivo } from "../lib/acceso-prelanzamiento.js";

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
    credenciales: false,
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

test("la campaña no se reenvía fuera de su semana", () => {
  assert.equal(decisionCampana(CAMPANA, Date.parse("2026-11-07T12:00:00.000Z"), true).ejecutar, true);
  assert.equal(decisionCampana(CAMPANA, Date.parse("2026-11-08T12:00:01.000Z"), true).motivo, "vencida");
  assert.equal(decisionCampana(CAMPANA, Date.parse("2027-11-01T12:00:00.000Z"), true).motivo, "vencida");
});

test("las tarjetas de precios se suscriben sin cuenta con un origen que la base acepta", () => {
  const valida = normalizarSuscripcion({
    endpoint: "https://fcm.googleapis.com/fcm/send/precios",
    claves: { p256dh: "A".repeat(80), auth: "B".repeat(22) },
    origen: "landing",
  });
  assert.equal(valida.origen, "landing");
  assert.equal(
    normalizarSuscripcion({
      endpoint: "https://fcm.googleapis.com/fcm/send/precios",
      claves: { p256dh: "A".repeat(80), auth: "B".repeat(22) },
      origen: "otro",
    }),
    null,
  );
});

test("un envío aceptado registra la fecha de último envío y un error no", async () => {
  const marcadas = [];
  const deps = {
    reclamar: async () => "envio-3",
    guardarResultado: async () => {},
    desactivar: async () => {},
    marcarEnvioOk: async (id) => marcadas.push(id),
  };
  await enviarUna(CAMPANA, SUSCRIPCION, "/", { ...deps, despachar: async () => ({ statusCode: 201 }) }, Date.parse("2026-11-01T13:00:00.000Z"));
  await enviarUna(CAMPANA, SUSCRIPCION, "/", { ...deps, despachar: async () => ({ statusCode: 500 }) }, Date.parse("2026-11-01T13:00:00.000Z"));
  assert.deepEqual(marcadas, [SUSCRIPCION.id]);
});

test("el lanzamiento usa una sola fecha para tarjetas y acceso", () => {
  assert.equal(LANZAMIENTO_MS, Date.parse("2026-11-01T03:00:00.000Z"));
  assert.equal(lanzamientoPendiente(Date.parse("2026-10-31T23:59:59-03:00")), true);
  assert.equal(lanzamientoPendiente(Date.parse("2026-11-01T00:00:00-03:00")), false);
  assert.equal(lanzamientoPendiente(new Date("2026-11-02T00:00:00-03:00")), false);
  assert.equal(gatePrelanzamientoActivo(new Date("2026-10-31T23:59:59-03:00")), true);
  assert.equal(gatePrelanzamientoActivo(new Date("2026-11-01T00:00:00-03:00")), false);
});

test("el texto del modal no habla de pagos en el plan gratuito", () => {
  assert.doesNotMatch(descripcionModalLanzamiento("gratuito"), /pago/i);
  assert.match(descripcionModalLanzamiento("plus"), /pagos todavía no están/);
  assert.match(descripcionModalLanzamiento("por-cultivo"), /pagos todavía no están/);
});

test("el cron y la prueba exigen su secreto", () => {
  assert.equal(cronAutorizado("Bearer secreto-cron", { CRON_SECRET: "secreto-cron", NODE_ENV: "production" }), true);
  assert.equal(cronAutorizado("Bearer otro", { CRON_SECRET: "secreto-cron", NODE_ENV: "production" }), false);
  assert.equal(cronAutorizado(null, { CRON_SECRET: "", NODE_ENV: "production" }), false);
  assert.equal(cronAutorizado(null, { CRON_SECRET: "", NODE_ENV: "development" }), false);
  assert.equal(pruebaAutorizada("Bearer 1234567890123456", { PUSH_PRUEBA_SECRETO: "1234567890123456" }), true);
  assert.equal(pruebaAutorizada("Bearer corto", { PUSH_PRUEBA_SECRETO: "corto" }), false);
  assert.equal(bearerCoincide("Bearer abc", "abcd"), false);
});

test("altas, pruebas públicas y pruebas administrativas usan límites distintos", () => {
  assert.notEqual(LIMITE_ALTAS, LIMITE_PRUEBAS_PUBLICAS);
  assert.notEqual(LIMITE_PRUEBAS_PUBLICAS, LIMITE_PRUEBAS_ADMIN);
  assert.ok(LIMITE_PRUEBAS_ADMIN.maximo > LIMITE_PRUEBAS_PUBLICAS.maximo);
  assert.ok(LIMITE_PRUEBAS_PUBLICAS.maximo > 0);
  assert.equal(limitePrueba(true), LIMITE_PRUEBAS_ADMIN);
  assert.equal(limitePrueba(false), LIMITE_PRUEBAS_PUBLICAS);
  assert.equal(limitePrueba(undefined), LIMITE_PRUEBAS_PUBLICAS);
  assert.equal(limitePrueba("true"), LIMITE_PRUEBAS_PUBLICAS);
});

test("el cupo calcula cuánto falta para liberar un intento", () => {
  const limite = { maximo: 3, ventanaMs: 15 * 60 * 1000 };
  const ahora = Date.parse("2026-10-23T12:00:00.000Z");
  const hace = (minutos) => new Date(ahora - minutos * 60 * 1000).toISOString();
  assert.deepEqual(evaluarCupo([hace(1), hace(2)], limite, ahora), { permitido: true, reintentarEnSeg: 0 });
  assert.deepEqual(evaluarCupo([hace(1), hace(2), hace(10)], limite, ahora), {
    permitido: false,
    reintentarEnSeg: 5 * 60,
  });
  assert.deepEqual(evaluarCupo([hace(1), hace(2), hace(16), hace(30)], limite, ahora), {
    permitido: true,
    reintentarEnSeg: 0,
  });
  assert.equal(evaluarCupo([hace(0.01), hace(0.02), hace(14.99)], limite, ahora).reintentarEnSeg, 1);
});

test("Retry-After se interpreta en segundos o como fecha", () => {
  const ahora = Date.parse("2026-10-23T12:00:00.000Z");
  assert.equal(segundosReintento("120", ahora), 120);
  assert.equal(segundosReintento("Fri, 23 Oct 2026 12:02:00 GMT", ahora), 120);
  assert.equal(segundosReintento("", ahora), null);
  assert.equal(segundosReintento("mañana", ahora), null);
  assert.equal(textoEspera(30), "en alrededor de un minuto");
  assert.equal(textoEspera(301), "en unos 6 minutos");
  assert.equal(textoEspera(null), "en unos minutos");
});

function depsPrueba(extra = {}) {
  const llamadas = [];
  const deps = {
    consultarCupo: async (limite) => {
      llamadas.push(["cupo", limite]);
      return { permitido: true, reintentarEnSeg: 0 };
    },
    registrarIntento: async () => {
      llamadas.push(["intento"]);
      return true;
    },
    leerSuscripcion: async () => ({ ok: true, suscripcion: { ...SUSCRIPCION, activa: true } }),
    nuevoId: () => "33333333-3333-4333-8333-333333333333",
    nuevoRecibo: () => ({ token: "T".repeat(43), hash: "h".repeat(64) }),
    crearEnvio: async (id, suscripcionId, hash) => {
      llamadas.push(["crear", id, suscripcionId, hash]);
      return true;
    },
    despachar: async (suscripcion, payload, opciones) => {
      llamadas.push(["despachar", payload, opciones]);
      return { statusCode: 201 };
    },
    guardarResultado: async (fila) => {
      llamadas.push(["resultado", fila]);
    },
    marcarEnvioOk: async (id) => {
      llamadas.push(["ok", id]);
    },
    desactivar: async (id, motivo) => {
      llamadas.push(["desactivar", id, motivo]);
    },
    ...extra,
  };
  return { deps, llamadas };
}

test("el límite público devuelve 429 con espera y no envía nada", async () => {
  const { deps, llamadas } = depsPrueba({
    consultarCupo: async (limite) => {
      llamadas.push(["cupo", limite]);
      return { permitido: false, reintentarEnSeg: 240 };
    },
  });
  const resultado = await ejecutarPrueba(deps, false);
  assert.equal(resultado.status, 429);
  assert.equal(resultado.reintentarEnSeg, 240);
  assert.equal(resultado.cuerpo.reintentarEn, 240);
  assert.deepEqual(llamadas, [["cupo", LIMITE_PRUEBAS_PUBLICAS]]);
});

test("un visitante anónimo usa el límite público y un administrador el suyo", async () => {
  const anonimo = depsPrueba();
  await ejecutarPrueba(anonimo.deps, false);
  assert.equal(anonimo.llamadas[0][1], LIMITE_PRUEBAS_PUBLICAS);
  const admin = depsPrueba();
  const resultado = await ejecutarPrueba(admin.deps, true);
  assert.equal(admin.llamadas[0][1], LIMITE_PRUEBAS_ADMIN);
  assert.equal(resultado.cuerpo.modo, "admin");
});

test("una prueba aceptada no se informa como recibida y lleva su identificador", async () => {
  const { deps, llamadas } = depsPrueba();
  const resultado = await ejecutarPrueba(deps, false);
  assert.equal(resultado.status, 200);
  assert.deepEqual(resultado.cuerpo, {
    ok: true,
    estado: "aceptado",
    recibido: false,
    envioId: "33333333-3333-4333-8333-333333333333",
    modo: "publico",
  });
  const orden = llamadas.map(([nombre]) => nombre);
  assert.deepEqual(orden, ["cupo", "intento", "crear", "despachar", "resultado", "ok"]);
  const despacho = llamadas.find(([nombre]) => nombre === "despachar");
  assert.equal(despacho[1].prueba, "33333333-3333-4333-8333-333333333333");
  assert.equal(despacho[1].titulo, AVISO_PRUEBA.titulo);
});

test("el comprobante de recepción viaja solo cifrado hacia el dispositivo", async () => {
  const { deps, llamadas } = depsPrueba();
  const resultado = await ejecutarPrueba(deps, true);
  const despacho = llamadas.find(([nombre]) => nombre === "despachar");
  const creado = llamadas.find(([nombre]) => nombre === "crear");
  assert.equal(despacho[1].recibo, "T".repeat(43));
  assert.equal(creado[3], "h".repeat(64));
  assert.ok(!JSON.stringify(resultado).includes("T".repeat(43)));
  assert.ok(!JSON.stringify(creado).includes("T".repeat(43)));
});

test("el comprobante es aleatorio, se guarda como hash y rechaza formatos ajenos", () => {
  const uno = nuevoRecibo();
  const otro = nuevoRecibo();
  assert.equal(reciboValido(uno.token), true);
  assert.notEqual(uno.token, otro.token);
  assert.equal(uno.hash, hashRecibo(uno.token));
  assert.notEqual(uno.hash, uno.token);
  assert.match(uno.hash, /^[0-9a-f]{64}$/);
  assert.equal(reciboValido("33333333-3333-4333-8333-333333333333"), false);
  assert.equal(reciboValido(""), false);
  assert.equal(reciboValido(null), false);
});

test("la excepción al límite exige sesión de administrador confirmada", () => {
  const admin = { id: "a", email: "admin@x.com", email_confirmed_at: "2026-01-01T00:00:00Z" };
  const esAdmin = (usuario) => usuario.email === "admin@x.com";
  assert.equal(usuarioAdminPush(admin, esAdmin), true);
  assert.equal(usuarioAdminPush(null, esAdmin), false);
  assert.equal(usuarioAdminPush({ ...admin, email_confirmed_at: null }, esAdmin), false);
  assert.equal(usuarioAdminPush({ ...admin, is_anonymous: true }, esAdmin), false);
  assert.equal(usuarioAdminPush({ ...admin, email: "otro@x.com" }, esAdmin), false);
  assert.equal(usuarioAdminPush(admin, () => "true"), false);
});

test("solo una solicitud del mismo sitio puede usar la sesión de administrador", () => {
  const cabeceras = (valores) => new Headers(valores);
  assert.equal(
    solicitudMismoOrigen(cabeceras({ origin: "https://enflora.com.ar", host: "enflora.com.ar", "sec-fetch-site": "same-origin" })),
    true,
  );
  assert.equal(solicitudMismoOrigen(cabeceras({ origin: "https://enflora.com.ar", host: "enflora.com.ar" })), true);
  assert.equal(
    solicitudMismoOrigen(cabeceras({ origin: "https://malicioso.com", host: "enflora.com.ar", "sec-fetch-site": "cross-site" })),
    false,
  );
  assert.equal(
    solicitudMismoOrigen(cabeceras({ origin: "https://enflora.com.ar", host: "enflora.com.ar", "sec-fetch-site": "cross-site" })),
    false,
  );
  assert.equal(solicitudMismoOrigen(cabeceras({ host: "enflora.com.ar" })), false);
  assert.equal(solicitudMismoOrigen(cabeceras({ origin: "null", host: "enflora.com.ar" })), false);
});

test("un rechazo por credenciales VAPID desactiva la suscripción para renovarla", async () => {
  const error = Object.assign(new Error("push"), { statusCode: 403, body: "credenciales distintas" });
  const { deps, llamadas } = depsPrueba({
    despachar: async () => {
      throw error;
    },
  });
  const resultado = await ejecutarPrueba(deps, false);
  assert.equal(resultado.status, 409);
  assert.equal(resultado.cuerpo.motivo, "credenciales");
  assert.ok(llamadas.some(([nombre, , motivo]) => nombre === "desactivar" && motivo === "credenciales"));
  assert.ok(!llamadas.some(([nombre]) => nombre === "ok"));
  assert.equal(clasificarResultadoPush(403).credenciales, true);
  assert.equal(clasificarResultadoPush(401).credenciales, true);
  assert.equal(clasificarResultadoPush(500).credenciales, false);
});

test("una suscripción vencida en el proveedor se desactiva y devuelve 410", async () => {
  const { deps, llamadas } = depsPrueba({
    despachar: async () => {
      throw Object.assign(new Error("push"), { statusCode: 410 });
    },
  });
  const resultado = await ejecutarPrueba(deps, false);
  assert.equal(resultado.status, 410);
  assert.ok(llamadas.some(([nombre, , motivo]) => nombre === "desactivar" && motivo === "expirada"));
});

test("una suscripción inactiva en la base no recibe pruebas", async () => {
  const { deps, llamadas } = depsPrueba({
    leerSuscripcion: async () => ({ ok: true, suscripcion: { ...SUSCRIPCION, activa: false } }),
  });
  const resultado = await ejecutarPrueba(deps, false);
  assert.equal(resultado.status, 409);
  assert.equal(resultado.cuerpo.motivo, "inactiva");
  assert.ok(!llamadas.some(([nombre]) => nombre === "despachar"));
});

test("el par VAPID se valida para detectar claves cambiadas a medias", () => {
  const actual = webpush.generateVAPIDKeys();
  const otra = webpush.generateVAPIDKeys();
  assert.equal(parVapidCoincide(actual.publicKey, actual.privateKey), true);
  assert.equal(parVapidCoincide(actual.publicKey, otra.privateKey), false);
  assert.equal(parVapidCoincide(actual.publicKey, "no-es-una-clave"), false);
  assert.equal(parVapidCoincide(null, actual.privateKey), false);
});
