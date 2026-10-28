import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizarPersonalidadFlora,
  PERSONALIDAD_FLORA_DEFAULT,
  PERSONALIDADES_FLORA,
} from "../lib/flora-personalidad.js";
import {
  construirInstruccionSistemaFlora,
  INSTRUCCION_SISTEMA_FLORA_BASE,
} from "../lib/flora-sistema-instrucciones.js";

test("default personalidad cercana_natural", () => {
  assert.equal(normalizarPersonalidadFlora(undefined).valor, PERSONALIDAD_FLORA_DEFAULT);
  assert.equal(normalizarPersonalidadFlora("").valor, PERSONALIDAD_FLORA_DEFAULT);
  assert.equal(normalizarPersonalidadFlora("invalid").valor, PERSONALIDAD_FLORA_DEFAULT);
});

test("normaliza ids válidos", () => {
  assert.equal(normalizarPersonalidadFlora("tecnica_profesional").valor, "tecnica_profesional");
  assert.equal(normalizarPersonalidadFlora("cercana_divertida").valor, "cercana_divertida");
});

test("instrucción base sin tono de personalidad específica", () => {
  assert.match(INSTRUCCION_SISTEMA_FLORA_BASE, /Nunca inventes mediciones/);
  assert.doesNotMatch(INSTRUCCION_SISTEMA_FLORA_BASE, /reposera/);
});

test("estilos difieren por personalidad", () => {
  const natural = construirInstruccionSistemaFlora("cercana_natural");
  const divertida = construirInstruccionSistemaFlora("cercana_divertida");
  const tecnica = construirInstruccionSistemaFlora("tecnica_profesional");

  assert.match(natural, /cercana y natural/i);
  assert.match(divertida, /divertida/i);
  assert.match(tecnica, /técnica y profesional/i);
  assert.match(divertida, /humor/i);
  assert.doesNotMatch(tecnica, /reposera/i);
});

test("catálogo tiene tres opciones", () => {
  assert.equal(PERSONALIDADES_FLORA.length, 3);
});
