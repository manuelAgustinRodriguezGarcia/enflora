import assert from "node:assert/strict";
import test from "node:test";
import { programarUsoFlora } from "../lib/flora-uso.js";
import {
  argumentosUsoFlora,
  clasificarResultadoFlora,
  eventoDesdeResultadoFlora,
  resumirTokensFlora,
} from "../lib/flora-uso-reglas.js";

const SOLICITUD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function base(extra = {}) {
  return {
    solicitudId: SOLICITUD,
    usuarioId: USUARIO,
    modelo: "gemini-3.8-flash",
    operacion: "chat",
    resultado: "exito",
    categoria: null,
    duracionMs: 1200,
    rondas: 1,
    llamadas: [{ promptTokens: 1000, candidatosTokens: 200, totalTokens: 1200 }],
    ...extra,
  };
}

test("suma tokens reportados y no completa una ronda que el proveedor no midió", () => {
  const completo = resumirTokensFlora(
    [
      { promptTokens: 100, candidatosTokens: 20, totalTokens: 120, pensamientoTokens: 5 },
      { promptTokens: 40, candidatosTokens: 10, totalTokens: 50 },
    ],
    2,
  );
  assert.equal(completo.entrada, 140);
  assert.equal(completo.salida, 30);
  assert.equal(completo.total, 170);
  assert.equal(completo.pensamiento, 5);
  assert.equal(completo.entradaCompleto, true);
  assert.equal(completo.pensamientoCompleto, false);

  const sinUso = resumirTokensFlora([{}, { duracionMs: 10 }], 2);
  assert.equal(sinUso.entrada, null);
  assert.equal(sinUso.total, null);
  assert.equal(sinUso.entradaCompleto, false);

  const rondaPerdida = resumirTokensFlora([{ promptTokens: 10, candidatosTokens: 4, totalTokens: 14 }], 2);
  assert.equal(rondaPerdida.entrada, 10);
  assert.equal(rondaPerdida.entradaCompleto, false);
});

test("un resultado sin métricas, un error del proveedor y una cancelación no inventan tokens", () => {
  assert.deepEqual(clasificarResultadoFlora({ ok: false, error: "Flora está con mucha demanda ahora." }), {
    resultado: "error",
    categoria: "proveedor",
  });
  assert.equal(clasificarResultadoFlora({ ok: false, diagnostico: { tipo: "AbortError" } }).resultado, "cancelacion");
  assert.equal(clasificarResultadoFlora({ ok: false, error: "Flora no generó una respuesta." }).categoria, "sin_respuesta");

  const sinMetricas = argumentosUsoFlora(base({ rondas: 0, llamadas: [], resultado: "error", categoria: "proveedor" }));
  assert.equal(sinMetricas.p_tokens_entrada, null);
  assert.equal(sinMetricas.p_tokens_salida, null);
  assert.equal(sinMetricas.p_tokens_total, null);
  assert.equal(sinMetricas.p_entrada_completa, false);
});

test("el registro ignora el contenido y repite la misma solicitud sin agregar campos", () => {
  const primero = argumentosUsoFlora({
    ...base(),
    mensaje: "mi planta está amarilla",
    respuesta: "regá con calma",
    genetica: "critica",
    personalidad: "confianzuda",
  });
  const segundo = argumentosUsoFlora(base());
  assert.deepEqual(primero, segundo);
  assert.equal(primero.p_solicitud, SOLICITUD);
  const texto = JSON.stringify(primero);
  assert.equal(texto.includes("amarilla"), false);
  assert.equal(texto.includes("calma"), false);
  assert.equal(texto.includes("critica"), false);
  assert.equal(texto.includes("confianzuda"), false);
  assert.equal(Object.hasOwn(primero, "p_mensaje"), false);
});

test("el evento del chat usa el modelo medido y separa la imagen", () => {
  const evento = eventoDesdeResultadoFlora({
    solicitudId: SOLICITUD,
    usuarioId: USUARIO,
    modelo: "gemini-3.8-flash",
    resultado: {
      ok: true,
      texto: "respuesta privada",
      telemetria: {
        modelo: "gemini-3.8-flash",
        msTotal: 800,
        rondasGemini: 1,
        imagenes: [{ mime: "image/jpeg", bytesImagen: 1000 }],
        llamadasGemini: [{ promptTokens: 10, candidatosTokens: 4, totalTokens: 14 }],
      },
    },
  });
  assert.equal(evento.p_operacion, "chat_imagen");
  assert.equal(evento.p_resultado, "exito");
  assert.equal(evento.p_categoria, null);
  assert.equal(evento.p_tokens_entrada, 10);
  assert.equal(JSON.stringify(evento).includes("respuesta privada"), false);
  assert.equal(JSON.stringify(evento).includes("image/jpeg"), false);
});

test("un fallo al guardar el uso no se propaga", async () => {
  const argumentos = argumentosUsoFlora(base());
  let llamadas = 0;
  const primero = await programarUsoFlora(argumentos, {
    rpc: async () => {
      llamadas += 1;
    },
  });
  const fallo = await programarUsoFlora(argumentos, {
    rpc: async () => {
      throw new Error("la base no está");
    },
  });
  assert.equal(primero.ok, true);
  assert.equal(llamadas, 1);
  assert.equal(fallo.ok, false);
  assert.deepEqual(await programarUsoFlora(null, { rpc: async () => assert.fail("no debía llamar") }), { ok: false });
});
