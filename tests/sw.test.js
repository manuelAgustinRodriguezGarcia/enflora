import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const CODIGO = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const PRUEBA = "33333333-3333-4333-8333-333333333333";
const RECIBO = "R".repeat(43);

function cargarSw({ ventanas = [], mostrar, fetchImpl, cachesImpl } = {}) {
  const eventos = {};
  const registro = [];
  let saltos = 0;
  const self = {
    location: { origin: "https://enflora.com.ar" },
    addEventListener: (tipo, manejador) => {
      eventos[tipo] = manejador;
    },
    skipWaiting: async () => {
      saltos += 1;
    },
    registration: {
      showNotification:
        mostrar ||
        (async (titulo, opciones) => {
          registro.push(["mostrar", titulo, opciones.tag, opciones.icon]);
        }),
    },
    clients: {
      claim: async () => {},
      matchAll: async () => ventanas,
      openWindow: async (url) => {
        registro.push(["abrir", url]);
        return null;
      },
    },
  };
  const fetch = fetchImpl || (async (url, opciones) => {
    registro.push(["fetch", String(url), opciones?.body ? JSON.parse(opciones.body) : null, opciones?.credentials]);
    return { ok: true, status: 202 };
  });
  const caches = cachesImpl || {
    open: async () => ({
      addAll: async () => {},
      match: async () => null,
    }),
    keys: async () => [],
    delete: async () => true,
  };
  vm.runInNewContext(CODIGO, { self, fetch, URL, JSON, console, Date, caches, Response });

  async function push(datos) {
    const pendientes = [];
    eventos.push({
      data: { json: () => datos, text: () => JSON.stringify(datos) },
      waitUntil: (promesa) => pendientes.push(promesa),
    });
    assert.equal(pendientes.length, 1);
    await Promise.all(pendientes);
  }

  async function instalar() {
    const pendientes = [];
    eventos.install({ waitUntil: (promesa) => pendientes.push(promesa) });
    await Promise.all(pendientes);
  }

  function mensaje(datos) {
    eventos.message({ data: datos });
  }

  async function navegar(pedido) {
    let respuesta;
    eventos.fetch({
      request: pedido,
      respondWith: (promesa) => {
        respuesta = promesa;
      },
    });
    return respuesta;
  }

  async function clic(data) {
    const pendientes = [];
    eventos.notificationclick({
      notification: { data, close: () => registro.push(["cerrar"]) },
      waitUntil: (promesa) => pendientes.push(promesa),
    });
    await Promise.all(pendientes);
  }

  return { push, registro, instalar, mensaje, navegar, clic, saltos: () => saltos, eventos };
}

test("sin pestañas abiertas el service worker muestra el aviso y registra la recepción", async () => {
  const sw = cargarSw();
  await sw.push({ titulo: "Prueba de Enflora", mensaje: "Hola", url: "/", etiqueta: "push-prueba", prueba: PRUEBA, recibo: RECIBO });
  assert.deepEqual(sw.registro, [
    ["mostrar", "Prueba de Enflora", "push-prueba", "/icons/enflora-isotipo-192.png"],
    ["fetch", "https://enflora.com.ar/api/push/recibido", { prueba: PRUEBA, recibo: RECIBO }, "omit"],
  ]);
});

test("con una pestaña abierta avisa a la página sin compartirle el comprobante", async () => {
  const mensajes = [];
  const sw = cargarSw({ ventanas: [{ url: "https://enflora.com.ar/", postMessage: (m) => mensajes.push(m) }] });
  await sw.push({ titulo: "Prueba", mensaje: "Hola", prueba: PRUEBA, recibo: RECIBO });
  assert.deepEqual(JSON.parse(JSON.stringify(mensajes)), [{ tipo: "enflora-push-recibido", prueba: PRUEBA }]);
  assert.equal(sw.registro.filter(([tipo]) => tipo === "fetch").length, 1);
});

test("el aviso de campaña no confirma recepción ni cambia su presentación", async () => {
  const sw = cargarSw();
  await sw.push({ titulo: "¡Enflora ya está disponible!", mensaje: "Flora te estaba esperando.", url: "https://enflora.com.ar/", etiqueta: "lanzamiento-2026-11" });
  assert.deepEqual(sw.registro, [
    ["mostrar", "¡Enflora ya está disponible!", "lanzamiento-2026-11", "/icons/enflora-isotipo-192.png"],
  ]);
});

test("sin comprobante válido o si el aviso no se mostró no se registra recepción", async () => {
  const sinRecibo = cargarSw();
  await sinRecibo.push({ titulo: "Prueba", prueba: PRUEBA, recibo: "corto" });
  assert.equal(sinRecibo.registro.filter(([tipo]) => tipo === "fetch").length, 0);

  const fallida = cargarSw({
    mostrar: async () => {
      throw new Error("bloqueado");
    },
  });
  await assert.rejects(fallida.push({ titulo: "Prueba", prueba: PRUEBA, recibo: RECIBO }));
  assert.equal(fallida.registro.filter(([tipo]) => tipo === "fetch").length, 0);
});

test("una ventana en foco muestra el aviso adentro y no duplica la notificación del sistema", async () => {
  const mensajes = [];
  const sw = cargarSw({
    ventanas: [{
      focused: true,
      visibilityState: "visible",
      url: "https://enflora.com.ar/",
      postMessage: (mensaje) => mensajes.push(mensaje),
    }],
  });
  const aviso = { titulo: "Hola", mensaje: "Chau", url: "/perfil", etiqueta: "push-prueba", prueba: PRUEBA, recibo: RECIBO };
  await sw.push(aviso);
  await sw.push(aviso);
  assert.equal(sw.registro.some(([tipo]) => tipo === "mostrar"), false);
  assert.equal(mensajes.filter((mensaje) => mensaje.tipo === "enflora-aviso").length, 1);
  assert.equal(mensajes.filter((mensaje) => mensaje.tipo === "enflora-push-recibido").length, 1);
  assert.equal(mensajes.some((mensaje) => mensaje.recibo), false);
});

test("una pestaña oculta sigue mostrando la notificación del sistema", async () => {
  const sw = cargarSw({
    ventanas: [{ focused: true, visibilityState: "hidden", url: "https://enflora.com.ar/", postMessage: () => {} }],
  });
  await sw.push({ titulo: "Fondo", mensaje: "Atrás", url: "/" });
  assert.equal(sw.registro[0][0], "mostrar");
});

test("el destino externo no sale del sitio y una ventana existente se reutiliza", async () => {
  const externo = cargarSw();
  await externo.clic({ url: "https://evil.example/robo" });
  assert.deepEqual(externo.registro[1], ["abrir", "https://enflora.com.ar/"]);

  const visitas = [];
  const propia = cargarSw({
    ventanas: [{
      url: "https://enflora.com.ar/inicio",
      navigate: async (url) => {
        visitas.push(url);
      },
      focus: async () => {
        visitas.push("foco");
      },
    }],
  });
  await propia.clic({ url: "/perfil" });
  assert.deepEqual(visitas, ["https://enflora.com.ar/perfil", "foco"]);
});

test("la navegación de la aplicación pide su propia ruta y no la landing cacheada", async () => {
  const pedidos = [];
  const sw = cargarSw({
    fetchImpl: async (pedido) => {
      pedidos.push(pedido.url);
      return { url: pedido.url, ok: true };
    },
  });
  const respuesta = await sw.navegar({
    method: "GET",
    mode: "navigate",
    url: "https://enflora.com.ar/inicio",
  });
  assert.deepEqual(pedidos, ["https://enflora.com.ar/inicio"]);
  assert.equal(respuesta.url, "https://enflora.com.ar/inicio");
  assert.doesNotMatch(CODIGO, /caches\.match\(\s*["']\/["']\s*\)/);
});

test("la actualización espera al usuario y la navegación sin red usa la pantalla offline", async () => {
  const sw = cargarSw({
    fetchImpl: async () => {
      throw new Error("red");
    },
    cachesImpl: {
      open: async () => ({
        addAll: async () => {},
        match: async (ruta) => (ruta === "/offline.html" ? { offline: true } : null),
      }),
      keys: async () => ["enflora-vieja"],
      delete: async () => true,
    },
  });
  await sw.instalar();
  assert.equal(sw.saltos(), 0);
  sw.mensaje({ tipo: "enflora-activar" });
  assert.equal(sw.saltos(), 1);
  sw.mensaje({ tipo: "otro" });
  assert.equal(sw.saltos(), 1);
  const sinRed = await sw.navegar({ method: "GET", mode: "navigate" });
  assert.equal(sinRed.offline, true);
  const api = await sw.navegar({ method: "GET", mode: "cors" });
  assert.equal(api, undefined);
  assert.equal(CODIGO.split('addEventListener("push"').length - 1, 1);
});
