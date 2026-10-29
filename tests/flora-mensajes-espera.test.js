import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_FRASES_ESPERA_POR_PERSONALIDAD,
  MENSAJES_ESPERA_FLORA,
  MENSAJES_ESPERA_OPERACION_FUTURA,
  conteoMensajesEsperaPorPersonalidad,
  crearRotadorMensajesEspera,
  frasesEsperaActivas,
  intervaloEsperaFloraMs,
  mensajesEsperaImagen,
} from "../lib/flora-mensajes-espera.js";

test("al menos 25 frases por personalidad", () => {
  const conteo = conteoMensajesEsperaPorPersonalidad();
  for (const id of Object.keys(MENSAJES_ESPERA_FLORA)) {
    assert.ok(conteo[id] >= MIN_FRASES_ESPERA_POR_PERSONALIDAD, id);
  }
});

test("frases generales únicas por personalidad", () => {
  for (const [id, lista] of Object.entries(MENSAJES_ESPERA_FLORA)) {
    assert.equal(new Set(lista).size, lista.length, `duplicadas en ${id}`);
  }
});

test("rotador no repite consecutivamente al rebarajar", () => {
  const frases = MENSAJES_ESPERA_FLORA.cercana_natural;
  const rotador = crearRotadorMensajesEspera(frases);
  let anterior = rotador.actual();
  for (let i = 0; i < frases.length * 3; i += 1) {
    const siguiente = rotador.avanzar();
    assert.notEqual(siguiente, anterior);
    anterior = siguiente;
  }
});

test("con imagen agrega frases de foto sin operaciones futuras", () => {
  const activas = frasesEsperaActivas("cercana_natural", { conImagen: true });
  const imagen = mensajesEsperaImagen("cercana_natural");
  for (const f of imagen) {
    assert.ok(activas.includes(f));
  }
  for (const op of MENSAJES_ESPERA_OPERACION_FUTURA) {
    assert.ok(!activas.includes(op));
  }
});

test("intervalo de rotación al menos 5 segundos", () => {
  for (let i = 0; i < 30; i += 1) {
    const ms = intervaloEsperaFloraMs();
    assert.ok(ms >= 5000 && ms <= 8000);
  }
});
