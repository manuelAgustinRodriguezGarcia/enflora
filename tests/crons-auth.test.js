import assert from "node:assert/strict";
import test from "node:test";
import { cronAutorizado } from "../lib/cron-auth.js";

const SECRETO = "secreto-cron-compartido-de-prueba";

const RUTAS = [
  { nombre: "reconciliar", ruta: "../app/api/pagos/reconciliar/route.js", url: "http://localhost/api/pagos/reconciliar" },
  { nombre: "cotizacion", ruta: "../app/api/cotizacion/actualizar/route.js", url: "http://localhost/api/cotizacion/actualizar" },
  { nombre: "push", ruta: "../app/api/push/lanzamiento/route.js", url: "http://localhost/api/push/lanzamiento" },
  { nombre: "plus", ruta: "../app/api/pagos/plus/renovar-importe/route.js", url: "http://localhost/api/pagos/plus/renovar-importe" },
];

/**
 * Entorno sin credenciales externas: una petición autorizada no puede pagar, enviar push
 * ni escribir datos reales. Devuelve función para restaurar.
 */
function entornoAislado(nodeEnv, secreto) {
  const previo = { ...process.env };
  const fetchPrevio = globalThis.fetch;
  process.env.NODE_ENV = nodeEnv;
  process.env.CRON_SECRET = secreto;
  for (const clave of [
    "MERCADOPAGO_ENV",
    "MERCADOPAGO_ACCESS_TOKEN",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_PUBLIC_KEY",
  ]) {
    process.env[clave] = "";
  }
  const llamadasFetch = [];
  globalThis.fetch = async (url) => {
    llamadasFetch.push(String(url));
    return new Response("", { status: 500 });
  };
  return {
    llamadasFetch,
    restaurar() {
      process.env = previo;
      globalThis.fetch = fetchPrevio;
    },
  };
}

async function llamar(ruta, url, headers) {
  const { GET } = await import(ruta);
  try {
    return await GET(new Request(url, { headers }));
  } catch (error) {
    return { status: "lanzo", error }; // pasó la autenticación y falló más adelante (sin red)
  }
}

test("cronAutorizado compartido: solo Bearer exacto, sin bypass", () => {
  for (const NODE_ENV of ["development", "test", "production"]) {
    const env = { NODE_ENV, CRON_SECRET: SECRETO };
    assert.equal(cronAutorizado(`Bearer ${SECRETO}`, env), true);
    assert.equal(cronAutorizado(`Bearer ${SECRETO}x`, env), false);
    assert.equal(cronAutorizado(`Bearer ${SECRETO.slice(1)}`, env), false);
    assert.equal(cronAutorizado(SECRETO, env), false);
    assert.equal(cronAutorizado(null, env), false);
    for (const CRON_SECRET of [undefined, "", "  "]) {
      assert.equal(cronAutorizado("Bearer ", { NODE_ENV, CRON_SECRET }), false);
      assert.equal(cronAutorizado(null, { NODE_ENV, CRON_SECRET }), false);
    }
  }
});

for (const { nombre, ruta, url } of RUTAS) {
  for (const nodeEnv of ["development", "production"]) {
    test(`${nombre} (${nodeEnv}): 401 sin token, token incorrecto, encabezado falsificado y secreto vacío`, async () => {
      const entorno = entornoAislado(nodeEnv, SECRETO);
      try {
        assert.equal((await llamar(ruta, url, {})).status, 401, "sin token");
        assert.equal((await llamar(ruta, url, { authorization: "Bearer incorrecto" })).status, 401, "incorrecto");
        assert.equal((await llamar(ruta, url, { "x-vercel-cron": "1" })).status, 401, "x-vercel-cron");
        assert.equal(
          (await llamar(ruta, url, { "x-vercel-cron": "1", authorization: "Bearer incorrecto" })).status,
          401,
          "x-vercel-cron + incorrecto",
        );
        process.env.CRON_SECRET = "";
        assert.equal((await llamar(ruta, url, {})).status, 401, "secreto vacío sin token");
        assert.equal((await llamar(ruta, url, { "x-vercel-cron": "1" })).status, 401, "secreto vacío + header");
        assert.equal((await llamar(ruta, url, { authorization: "Bearer " })).status, 401, "secreto vacío + Bearer vacío");
        assert.equal(entorno.llamadasFetch.length, 0, "rechazadas no tocan la red");
      } finally {
        entorno.restaurar();
      }
    });

    test(`${nombre} (${nodeEnv}): token correcto pasa la autenticación sin efectos reales`, async () => {
      const entorno = entornoAislado(nodeEnv, SECRETO);
      try {
        const respuesta = await llamar(ruta, url, { authorization: `Bearer ${SECRETO}` });
        assert.notEqual(respuesta.status, 401);
        if (respuesta.status !== "lanzo") {
          assert.ok(!JSON.stringify(await respuesta.json()).includes(SECRETO));
        }
        // la red real queda bloqueada: cualquier llamada saliente fue interceptada y falló
        for (const destino of entorno.llamadasFetch) {
          assert.ok(/bna\.com\.ar/.test(destino), `fetch inesperado: ${destino}`);
        }
      } finally {
        entorno.restaurar();
      }
    });
  }
}
