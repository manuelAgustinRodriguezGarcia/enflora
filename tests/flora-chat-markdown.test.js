import assert from "node:assert/strict";
import test from "node:test";

import {
  contarPalabrasMarkdown,
  duracionAnimacionPalabras,
  markdownFloraATextoPlano,
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

test("markdownFloraATextoPlano limpia títulos y listas", () => {
  const md = `Intro breve.

### 1. Observación visual
* **Estructura:** Flor chica.
* **Pistilos:** Largos.

### 2. Hipótesis *(general)*
Texto **negrita** y *cursiva*.`;

  const plano = markdownFloraATextoPlano(md);
  assert.match(plano, /Intro breve\./);
  assert.doesNotMatch(plano, /###/);
  assert.doesNotMatch(plano, /\*\*/);
  assert.match(plano, /1\. Observación visual/);
  assert.match(plano, /• Estructura: Flor chica\./);
  assert.match(plano, /2\. Hipótesis \(general\)/);
  assert.match(plano, /Texto negrita y cursiva\./);
});
