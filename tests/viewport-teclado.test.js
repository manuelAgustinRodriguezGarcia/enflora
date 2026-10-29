import assert from "node:assert/strict";
import test from "node:test";

import { calcularOffsetTecladoInferior, entradaEditableActiva } from "../lib/viewport-teclado.js";

test("sin entrada activa no desplaza la barra inferior", () => {
  assert.equal(
    calcularOffsetTecladoInferior(
      { innerHeight: 800, visualViewport: { height: 720, offsetTop: 0 } },
      { entradaActiva: false },
    ),
    0,
  );
});

test("con teclado virtual desplaza según visualViewport", () => {
  assert.equal(
    calcularOffsetTecladoInferior(
      { innerHeight: 800, visualViewport: { height: 500, offsetTop: 0 } },
      { entradaActiva: true },
    ),
    300,
  );
});

test("cambio de barra de URL sin foco no genera offset", () => {
  assert.equal(
    calcularOffsetTecladoInferior(
      { innerHeight: 800, visualViewport: { height: 760, offsetTop: 40 } },
      { entradaActiva: false },
    ),
    0,
  );
});

test("entradaEditableActiva ignora hidden y checkbox", () => {
  assert.equal(entradaEditableActiva({ tagName: "INPUT", type: "hidden", readOnly: false, disabled: false }), false);
  assert.equal(entradaEditableActiva({ tagName: "TEXTAREA", readOnly: false, disabled: false }), true);
});
