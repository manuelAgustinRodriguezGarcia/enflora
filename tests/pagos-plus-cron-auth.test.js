import assert from "node:assert/strict";
import test from "node:test";
import { cronPlusAutorizado } from "../lib/pagos/plus/cron-auth.js";

const SECRETO = "secreto-cron-plus-de-prueba";

test("cronPlusAutorizado: solo Bearer correcto", () => {
  const env = { CRON_SECRET: SECRETO, NODE_ENV: "production" };
  assert.equal(cronPlusAutorizado(`Bearer ${SECRETO}`, env), true);
  assert.equal(cronPlusAutorizado(`Bearer ${SECRETO}x`, env), false);
  assert.equal(cronPlusAutorizado("Bearer otro", env), false);
  assert.equal(cronPlusAutorizado(SECRETO, env), false);
  assert.equal(cronPlusAutorizado(`bearer ${SECRETO}`, env), false);
  assert.equal(cronPlusAutorizado(null, env), false);
  assert.equal(cronPlusAutorizado("", env), false);
});

test("cronPlusAutorizado: sin CRON_SECRET nunca autoriza, en ningún entorno", () => {
  for (const NODE_ENV of ["development", "test", "production"]) {
    for (const CRON_SECRET of [undefined, "", "   "]) {
      const env = { NODE_ENV, CRON_SECRET };
      assert.equal(cronPlusAutorizado(null, env), false);
      assert.equal(cronPlusAutorizado("Bearer ", env), false);
      assert.equal(cronPlusAutorizado("Bearer undefined", env), false);
      assert.equal(cronPlusAutorizado("Bearer ", env), false);
    }
  }
});

test("ruta renovar-importe: 401 sin credenciales, con secreto incorrecto y con x-vercel-cron falsificado", async () => {
  const previo = { ...process.env };
  try {
    for (const NODE_ENV of ["development", "production"]) {
      process.env.NODE_ENV = NODE_ENV;
      process.env.CRON_SECRET = SECRETO;
      const { GET } = await import("../app/api/pagos/plus/renovar-importe/route.js");
      const url = "http://localhost/api/pagos/plus/renovar-importe";
      assert.equal((await GET(new Request(url))).status, 401);
      assert.equal((await GET(new Request(url, { headers: { authorization: "Bearer mal" } }))).status, 401);
      assert.equal((await GET(new Request(url, { headers: { "x-vercel-cron": "1" } }))).status, 401);
      assert.equal(
        (await GET(new Request(url, { headers: { "x-vercel-cron": "1", authorization: "Bearer mal" } }))).status,
        401,
      );
      process.env.CRON_SECRET = "";
      assert.equal((await GET(new Request(url, { headers: { "x-vercel-cron": "1" } }))).status, 401);
      assert.equal((await GET(new Request(url, { headers: { authorization: "Bearer " } }))).status, 401);
    }
  } finally {
    process.env = previo;
  }
});

test("ruta renovar-importe: con Bearer correcto pasa la autenticación (503 por entorno sin declarar, sin tocar MP)", async () => {
  const previo = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = SECRETO;
    process.env.MERCADOPAGO_ENV = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    const { GET } = await import("../app/api/pagos/plus/renovar-importe/route.js");
    const respuesta = await GET(
      new Request("http://localhost/api/pagos/plus/renovar-importe", {
        headers: { authorization: `Bearer ${SECRETO}` },
      }),
    );
    assert.equal(respuesta.status, 503);
    const cuerpo = await respuesta.json();
    assert.equal(cuerpo.codigo, "ambiente_no_declarado");
    assert.ok(!JSON.stringify(cuerpo).includes(SECRETO));
  } finally {
    process.env = previo;
  }
});
