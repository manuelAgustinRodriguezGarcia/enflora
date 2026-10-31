import assert from "node:assert/strict";
import test from "node:test";
import { TANDA_GALERIA_GRATUITO, TANDA_GALERIA_PLUS } from "../lib/flora-beneficios.js";

const CLAVES_ENTORNO_PAGOS = [
  "NODE_ENV",
  "MERCADOPAGO_ENV",
  "MERCADOPAGO_PRUEBAS_CONFIRMADAS",
  "PAYMENTS_LIVE_ENABLED",
];

const UNIDAD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CICLO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USUARIO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PAGO_PROD = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PAGO_PRUEBA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function consultaMock(resultado) {
  const promesa = Promise.resolve(resultado);
  const cadena = {
    select() {
      return cadena;
    },
    eq() {
      return cadena;
    },
    in() {
      return cadena;
    },
    // consultarPlusActivo (plus_suscripciones / plus_pagos_recurrentes) encadena order().limit()
    order() {
      return cadena;
    },
    limit() {
      return cadena;
    },
    then(resolver, rechazo) {
      return promesa.then(resolver, rechazo);
    },
  };
  return cadena;
}

function supabaseBeneficiosMock(tablas) {
  return {
    from(nombre) {
      return consultaMock(tablas[nombre] ?? { data: [], error: null });
    },
  };
}

const envProduccion = {
  NODE_ENV: "production",
  MERCADOPAGO_ENV: "produccion",
  PAYMENTS_LIVE_ENABLED: "true",
};

const envPrueba = {
  NODE_ENV: "development",
  MERCADOPAGO_ENV: "prueba",
  MERCADOPAGO_PRUEBAS_CONFIRMADAS: "true",
  PAYMENTS_LIVE_ENABLED: "false",
};

async function resolverConEnv(env, supabase, unidadCultivoId) {
  const snapshot = Object.fromEntries(CLAVES_ENTORNO_PAGOS.map((clave) => [clave, process.env[clave]]));
  for (const clave of CLAVES_ENTORNO_PAGOS) delete process.env[clave];
  Object.assign(process.env, env);
  try {
    const { resolverBeneficiosFlora } = await import("../lib/flora-beneficios-servidor.js");
    return resolverBeneficiosFlora(supabase, USUARIO, { unidadCultivoId });
  } finally {
    for (const clave of CLAVES_ENTORNO_PAGOS) {
      if (snapshot[clave] === undefined) delete process.env[clave];
      else process.env[clave] = snapshot[clave];
    }
  }
}

test("resolverBeneficiosFlora: sin unidad queda en gratuito", async () => {
  const resultado = await resolverConEnv(envProduccion, supabaseBeneficiosMock({}), "");
  assert.equal(resultado.nivel, "gratuito");
  assert.equal(resultado.tandaGaleria, TANDA_GALERIA_GRATUITO);
  assert.equal(resultado.licenciaEnUnidad, false);
  assert.equal(resultado.plusActivo, false);
  assert.equal(resultado.limitePlantas, 9);
});

test("resolverBeneficiosFlora: licencia de prueba no eleva beneficios en ambiente produccion", async () => {
  const supabase = supabaseBeneficiosMock({
    ciclos_cultivo: { data: [{ id: CICLO }], error: null },
    licencias_cultivo: {
      data: [
        {
          ciclo_cultivo_id: CICLO,
          pago_id: PAGO_PRUEBA,
          estado: "activa",
          usuario_id: USUARIO,
        },
      ],
      error: null,
    },
    pagos: {
      data: [
        {
          id: PAGO_PRUEBA,
          estado: "acreditado",
          ambiente: "prueba",
          ciclo_cultivo_id: CICLO,
          usuario_id: USUARIO,
        },
      ],
      error: null,
    },
  });

  const resultado = await resolverConEnv(envProduccion, supabase, UNIDAD);
  assert.equal(resultado.licenciaEnUnidad, false);
  assert.equal(resultado.nivel, "gratuito");
  assert.equal(resultado.tandaGaleria, TANDA_GALERIA_GRATUITO);
  assert.equal(resultado.limitePlantas, 9);
});

test("resolverBeneficiosFlora: licencia productiva habilita tanda plus en la unidad", async () => {
  const supabase = supabaseBeneficiosMock({
    ciclos_cultivo: { data: [{ id: CICLO }], error: null },
    licencias_cultivo: {
      data: [
        {
          ciclo_cultivo_id: CICLO,
          pago_id: PAGO_PROD,
          estado: "activa",
          usuario_id: USUARIO,
        },
      ],
      error: null,
    },
    pagos: {
      data: [
        {
          id: PAGO_PROD,
          estado: "acreditado",
          ambiente: "produccion",
          ciclo_cultivo_id: CICLO,
          usuario_id: USUARIO,
        },
      ],
      error: null,
    },
  });

  const resultado = await resolverConEnv(envProduccion, supabase, UNIDAD);
  assert.equal(resultado.licenciaEnUnidad, true);
  assert.equal(resultado.nivel, "plus");
  assert.equal(resultado.tandaGaleria, TANDA_GALERIA_PLUS);
  assert.equal(resultado.limitePlantas, 100);
});

test("resolverBeneficiosFlora: licencia de prueba sí aplica en ambiente prueba", async () => {
  const supabase = supabaseBeneficiosMock({
    ciclos_cultivo: { data: [{ id: CICLO }], error: null },
    licencias_cultivo: {
      data: [
        {
          ciclo_cultivo_id: CICLO,
          pago_id: PAGO_PRUEBA,
          estado: "activa",
          usuario_id: USUARIO,
        },
      ],
      error: null,
    },
    pagos: {
      data: [
        {
          id: PAGO_PRUEBA,
          estado: "acreditado",
          ambiente: "prueba",
          ciclo_cultivo_id: CICLO,
          usuario_id: USUARIO,
        },
      ],
      error: null,
    },
  });

  const resultado = await resolverConEnv(envPrueba, supabase, UNIDAD);
  assert.equal(resultado.licenciaEnUnidad, true);
  assert.equal(resultado.tandaGaleria, TANDA_GALERIA_PLUS);
  assert.equal(resultado.limitePlantas, 100);
});

test("resolverBeneficiosFlora: licencia de otro usuario no eleva beneficios", async () => {
  const supabase = supabaseBeneficiosMock({
    ciclos_cultivo: { data: [{ id: CICLO }], error: null },
    licencias_cultivo: {
      data: [
        {
          ciclo_cultivo_id: CICLO,
          pago_id: PAGO_PROD,
          estado: "activa",
          usuario_id: "otro-usuario",
        },
      ],
      error: null,
    },
    pagos: {
      data: [
        {
          id: PAGO_PROD,
          estado: "acreditado",
          ambiente: "produccion",
          ciclo_cultivo_id: CICLO,
          usuario_id: "otro-usuario",
        },
      ],
      error: null,
    },
  });

  const resultado = await resolverConEnv(envProduccion, supabase, UNIDAD);
  assert.equal(resultado.licenciaEnUnidad, false);
  assert.equal(resultado.nivel, "gratuito");
  assert.equal(resultado.limitePlantas, 9);
});
