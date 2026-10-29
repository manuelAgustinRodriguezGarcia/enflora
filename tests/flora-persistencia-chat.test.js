import assert from "node:assert/strict";
import test from "node:test";

import {
  derivarEstadoPersistenciaChat,
  ESTADOS_PERSISTENCIA_CHAT,
  requiereModalSalidaChatFlora,
  tieneCambiosPendientesSync,
} from "../lib/flora-estado-persistencia-chat.js";
import { firmaMensajesChat } from "../lib/flora-firma-mensajes-chat.js";

const mensajesTurno = [
  { id: "bienvenida", rol: "flora", texto: "hola" },
  { id: "u1", rol: "usuario", texto: "¿Riego?", fecha: "2026-01-01T12:00:00.000Z" },
  { id: "f1", rol: "flora", texto: "Sí", fecha: "2026-01-01T12:00:05.000Z" },
];

test("chat guardado en servidor no pide modal de salida", () => {
  assert.equal(
    requiereModalSalidaChatFlora({
      chatGuardadoId: "550e8400-e29b-41d4-a716-446655440000",
      mensajes: mensajesTurno,
    }),
    false,
  );
});

test("chat nuevo con mensajes pide modal", () => {
  assert.equal(
    requiereModalSalidaChatFlora({
      chatGuardadoId: null,
      mensajes: mensajesTurno,
    }),
    true,
  );
});

test("detecta cambios pendientes de sync", () => {
  const firma = firmaMensajesChat(mensajesTurno);
  assert.equal(
    tieneCambiosPendientesSync({
      chatGuardadoId: "550e8400-e29b-41d4-a716-446655440000",
      mensajes: mensajesTurno,
      firmaSincronizada: "",
    }),
    true,
  );
  assert.equal(
    tieneCambiosPendientesSync({
      chatGuardadoId: "550e8400-e29b-41d4-a716-446655440000",
      mensajes: mensajesTurno,
      firmaSincronizada: firma,
    }),
    false,
  );
});

test("estados de persistencia", () => {
  assert.equal(derivarEstadoPersistenciaChat({ chatGuardadoId: null }), ESTADOS_PERSISTENCIA_CHAT.NUEVO);
  assert.equal(
    derivarEstadoPersistenciaChat({
      chatGuardadoId: "x",
      firmaActual: "a",
      firmaSincronizada: "a",
    }),
    ESTADOS_PERSISTENCIA_CHAT.SINCRONIZADO,
  );
});
