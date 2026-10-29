import assert from "node:assert/strict";
import test from "node:test";

import {
  conversacionFloraPendiente,
  esNavegacionSalidaChatFlora,
} from "../lib/flora-chat-conversacion-pendiente.js";

test("conversación pendiente con mensajes más allá de bienvenida", () => {
  assert.equal(
    conversacionFloraPendiente({
      mensajes: [{ id: "bienvenida" }, { id: "u1", rol: "usuario", texto: "hola" }],
    }),
    true,
  );
  assert.equal(
    conversacionFloraPendiente({
      mensajes: [{ id: "bienvenida", rol: "flora", texto: "hola" }],
    }),
    false,
  );
});

test("chat guardado no cuenta como pendiente de modal", () => {
  assert.equal(
    conversacionFloraPendiente({
      chatGuardadoId: "550e8400-e29b-41d4-a716-446655440000",
      mensajes: [{ id: "bienvenida" }, { id: "u1", rol: "usuario", texto: "hola" }],
    }),
    false,
  );
});

test("detecta salida desde /flora", () => {
  assert.equal(esNavegacionSalidaChatFlora("/flora", "/espacios"), true);
  assert.equal(esNavegacionSalidaChatFlora("/flora", "/flora/soluciones"), true);
  assert.equal(esNavegacionSalidaChatFlora("/flora", "/flora"), false);
  assert.equal(esNavegacionSalidaChatFlora("/registros", "/espacios"), false);
});
