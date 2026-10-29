import assert from "node:assert/strict";
import { test } from "node:test";
import {
  debeRecuperarChatGuardado,
  mensajeErrorRecuperacionChat,
  resultadoRecuperacionChatDesdeApi,
} from "../lib/flora-recuperacion-chat.js";

test("debeRecuperarChatGuardado detecta query continuar", () => {
  assert.equal(debeRecuperarChatGuardado(""), false);
  assert.equal(debeRecuperarChatGuardado("  "), false);
  assert.equal(debeRecuperarChatGuardado("97d2ffd5-0158-44ae-a8e7-edb36a0f2615"), true);
});

test("mensajeErrorRecuperacionChat según HTTP", () => {
  assert.match(mensajeErrorRecuperacionChat({ status: 401, ok: false }, {}), /sesión/i);
  assert.match(mensajeErrorRecuperacionChat({ status: 404, ok: false }, { error: "x" }), /x/);
  assert.match(mensajeErrorRecuperacionChat({ status: 502, ok: false }, {}), /cargar/i);
});

test("resultadoRecuperacionChatDesdeApi hidrata chat guardado", () => {
  const r = resultadoRecuperacionChatDesdeApi({
    chat: {
      id: "c1",
      titulo: "Riego",
      primera_pregunta: "¿Cuánto?",
      clave_sesion: "ses-1",
      mensajes: [
        { rol: "usuario", texto: "¿Cuánto?", fecha: "2026-01-01T10:00:00.000Z" },
        { rol: "flora", texto: "Depende.", fecha: "2026-01-01T10:00:05.000Z" },
      ],
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.chatGuardadoId, "c1");
  assert.equal(r.claveSesion, "ses-1");
  assert.equal(r.mensajes.length, 3);
  assert.equal(r.mensajes[0].id, "bienvenida");
  assert.equal(r.mensajes[2].rol, "flora");
});

test("resultadoRecuperacionChatDesdeApi rechaza chat sin mensajes", () => {
  const r = resultadoRecuperacionChatDesdeApi({
    chat: { id: "c1", mensajes: [] },
  });
  assert.equal(r.ok, false);
});

test("resultadoRecuperacionChatDesdeApi hidrata solución legacy", () => {
  const r = resultadoRecuperacionChatDesdeApi({
    solucion: {
      titulo: "Legacy",
      pregunta: "Hola",
      respuesta: "Chau",
      fecha_respuesta: "2026-01-01T12:00:00.000Z",
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.chatGuardadoId, null);
  assert.equal(r.mensajes.filter((m) => m.id !== "bienvenida").length, 2);
});
