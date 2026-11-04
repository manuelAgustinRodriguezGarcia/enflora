import assert from "node:assert/strict";
import test from "node:test";

import {
  UMBRAL_SCROLL_INFERIOR_CHAT,
  anclajeTrasScrollUsuario,
} from "../lib/flora-chat-scroll.js";

test("subir un poco, todavía cerca del final, suelta el seguimiento", () => {
  const anclado = anclajeTrasScrollUsuario({
    anclado: true,
    scrollTopPrevio: 1000,
    scrollTop: 960,
    distanciaAlFinal: 40,
    umbral: UMBRAL_SCROLL_INFERIOR_CHAT,
  });
  assert.equal(anclado, false);
});

test("quedarse cerca del final sin moverse no vuelve a anclar", () => {
  const anclado = anclajeTrasScrollUsuario({
    anclado: false,
    scrollTopPrevio: 960,
    scrollTop: 960,
    distanciaAlFinal: 40,
  });
  assert.equal(anclado, false);
});

test("bajar hasta el final vuelve a seguir la respuesta", () => {
  const anclado = anclajeTrasScrollUsuario({
    anclado: false,
    scrollTopPrevio: 700,
    scrollTop: 980,
    distanciaAlFinal: 20,
  });
  assert.equal(anclado, true);
});

test("bajar sin llegar al final mantiene el seguimiento suelto", () => {
  const anclado = anclajeTrasScrollUsuario({
    anclado: false,
    scrollTopPrevio: 200,
    scrollTop: 280,
    distanciaAlFinal: 400,
  });
  assert.equal(anclado, false);
});

test("el recorte al achicarse el mensaje no suelta el seguimiento", () => {
  const anclado = anclajeTrasScrollUsuario({
    anclado: true,
    scrollTopPrevio: 3200,
    scrollTop: 40,
    distanciaAlFinal: 0,
    scrollHeightPrevio: 3600,
    scrollHeight: 420,
  });
  assert.equal(anclado, true);
});
