import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const CODIGO = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const PRUEBA = "33333333-3333-4333-8333-333333333333";
const RECIBO = "R".repeat(43);

function cargarSw({ ventanas = [], mostrar } = {}) {
  const eventos = {};
  const registro = [];
  const self = {
    location: { origin: "https://enflora.com.ar" },
    addEventListener: (tipo, manejador) => {
      eventos[tipo] = manejador;
    },
    skipWaiting: async () => {},
    registration: {
      showNotification:
        mostrar ||
        (async (titulo, opciones) => {
          registro.push(["mostrar", titulo, opciones.tag]);
        }),
    },
    clients: {
      claim: async () => {},
      matchAll: async () => ventanas,
      openWindow: async () => null,
    },
  };
  const fetch = async (url, opciones) => {
    registro.push(["fetch", url, JSON.parse(opciones.body), opciones.credentials]);
    return { ok: true, status: 202 };
  };
  vm.runInNewContext(CODIGO, { self, fetch, URL, JSON, console });

  async function push(datos) {
    const pendientes = [];
    eventos.push({
      data: { json: () => datos, text: () => JSON.stringify(datos) },
      waitUntil: (promesa) => pendientes.push(promesa),
    });
    assert.equal(pendientes.length, 1);
    await Promise.all(pendientes);
  }

  return { push, registro };
}

test("sin pestañas abiertas el service worker muestra el aviso y registra la recepción", async () => {
  const sw = cargarSw();
  await sw.push({ titulo: "Prueba de Enflora", mensaje: "Hola", url: "/", etiqueta: "push-prueba", prueba: PRUEBA, recibo: RECIBO });
  assert.deepEqual(sw.registro, [
    ["mostrar", "Prueba de Enflora", "push-prueba"],
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
  assert.deepEqual(sw.registro, [["mostrar", "¡Enflora ya está disponible!", "lanzamiento-2026-11"]]);
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
