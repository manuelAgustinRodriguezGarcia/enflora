import assert from "node:assert/strict";
import test from "node:test";

import {
  contarPalabrasMarkdown,
  duracionAnimacionPalabras,
  recortarMarkdownPorPalabras,
} from "../lib/flora-chat-markdown.js";

test("recortar markdown cierra negritas incompletas", () => {
  const fuente = "**Plantas:** Tenés **9 plantas** en total.";
  const parcial = recortarMarkdownPorPalabras(fuente, 3);
  assert.match(parcial, /\*\*Plantas:\*\*/);
  assert.doesNotMatch(parcial, /\*\*9$/);
});

test("recortar markdown deja pares de asteriscos balanceados", () => {
  const fuente = "Tenés **nueve plantas** activas.";
  const corto = recortarMarkdownPorPalabras(fuente, 2);
  const pares = (corto.match(/\*\*/g) || []).length;
  assert.equal(pares % 2, 0);
});

test("duración de animación tiene tope máximo", () => {
  const corta = duracionAnimacionPalabras(10);
  const larga = duracionAnimacionPalabras(500);
  assert.ok(larga <= 6500);
  assert.ok(corta >= 400);
  assert.equal(duracionAnimacionPalabras(100, { reducido: true }), 0);
});

test("contar palabras ignora espacios vacíos", () => {
  assert.equal(contarPalabrasMarkdown("  hola   mundo  "), 2);
});
