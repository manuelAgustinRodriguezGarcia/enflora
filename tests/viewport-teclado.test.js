import assert from "node:assert/strict";
import test from "node:test";

import {
  UMBRAL_TECLADO_ABRIR_PX,
  calcularOffsetTecladoInferior,
  entradaEditableActiva,
  evaluarTecladoVirtual,
} from "../lib/viewport-teclado.js";

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

test("entradaEditableActiva ignora controles que no abren teclado", () => {
  assert.equal(entradaEditableActiva({ tagName: "INPUT", type: "hidden", readOnly: false, disabled: false }), false);
  assert.equal(entradaEditableActiva({ tagName: "INPUT", type: "checkbox", readOnly: false, disabled: false }), false);
  assert.equal(entradaEditableActiva({ tagName: "INPUT", type: "button", readOnly: false, disabled: false }), false);
  assert.equal(entradaEditableActiva({ tagName: "TEXTAREA", readOnly: false, disabled: false }), true);
  assert.equal(entradaEditableActiva({ tagName: "INPUT", type: "text", readOnly: true, disabled: false }), false);
  assert.equal(entradaEditableActiva({ tagName: "DIV", isContentEditable: true }), true);
});

test("foco sin encoger el viewport no abre el teclado", () => {
  const resultado = evaluarTecladoVirtual(
    { alturaBase: 800, innerHeight: 800, visualViewport: { height: 800, offsetTop: 0 } },
    { entradaActiva: true },
  );
  assert.equal(resultado.abierto, false);
  assert.equal(resultado.offset, 0);
});

test("una barra de URL con foco no se confunde con el teclado", () => {
  const resultado = evaluarTecladoVirtual(
    { alturaBase: 800, innerHeight: 744, visualViewport: { height: 744, offsetTop: 0 } },
    { entradaActiva: true },
  );
  assert.ok(800 - 744 < UMBRAL_TECLADO_ABRIR_PX);
  assert.equal(resultado.abierto, false);
  assert.equal(resultado.alturaBase, 800);
});

test("el teclado que encoge el layout se detecta sin desplazar de nuevo", () => {
  const resultado = evaluarTecladoVirtual(
    { alturaBase: 800, innerHeight: 500, visualViewport: { height: 500, offsetTop: 0 } },
    { entradaActiva: true },
  );
  assert.equal(resultado.abierto, true);
  assert.equal(resultado.offset, 0);
  assert.equal(resultado.alturaBase, 800);
});

test("el teclado superpuesto desplaza solo el solape del layout", () => {
  const resultado = evaluarTecladoVirtual(
    { alturaBase: 800, innerHeight: 800, visualViewport: { height: 480, offsetTop: 0 } },
    { entradaActiva: true },
  );
  assert.equal(resultado.abierto, true);
  assert.equal(resultado.offset, 320);
});

test("cambiar de input no cierra el teclado si el viewport sigue reducido", () => {
  const resultado = evaluarTecladoVirtual(
    { alturaBase: 800, innerHeight: 800, visualViewport: { height: 480, offsetTop: 0 } },
    { entradaActiva: false, abiertoPrevio: true },
  );
  assert.equal(resultado.abierto, true);
});

test("al recuperar la altura el teclado se cierra aunque el campo siga enfocado", () => {
  const resultado = evaluarTecladoVirtual(
    { alturaBase: 800, innerHeight: 800, visualViewport: { height: 790, offsetTop: 0 } },
    { entradaActiva: true, abiertoPrevio: true },
  );
  assert.equal(resultado.abierto, false);
  assert.equal(resultado.offset, 0);
});

test("en escritorio no se oculta la barra aunque el alto cambie con un campo enfocado", () => {
  const resultado = evaluarTecladoVirtual(
    { alturaBase: 900, innerHeight: 600, visualViewport: { height: 600, offsetTop: 0 } },
    { entradaActiva: true, admiteTecladoVirtual: false },
  );
  assert.equal(resultado.abierto, false);
  assert.equal(resultado.offset, 0);
});
