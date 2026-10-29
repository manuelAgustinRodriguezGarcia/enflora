import assert from "node:assert/strict";
import test from "node:test";

import {
  mensajesClienteParaPersistencia,
  primeraPreguntaSignificativaDesdeMensajes,
  sugerirTituloChat,
  validarMensajesChatPersistidos,
  validarPayloadGuardarChat,
} from "../lib/flora-chats-guardados.js";

test("sugerir título de chat desde primera pregunta", () => {
  const mensajes = [
    { rol: "usuario", texto: "  riego en floración?  ", fecha: "2026-01-01T12:00:00.000Z" },
    { rol: "flora", texto: "Mirá tu último registro…", fecha: "2026-01-01T12:00:05.000Z" },
  ];
  assert.match(sugerirTituloChat(mensajes), /^Riego en floración/i);
  assert.equal(primeraPreguntaSignificativaDesdeMensajes(mensajes), "riego en floración?");
});

test("serializa adjuntos enflora y transitorios sin URLs", () => {
  const crudos = mensajesClienteParaPersistencia([
    {
      id: "u1",
      rol: "usuario",
      texto: "Mirá esta hoja",
      adjuntos: [
        { origen: "enflora", fotoId: "550e8400-e29b-41d4-a716-446655440000" },
        { origen: "transitoria", vista: "blob:x" },
      ],
    },
    { id: "f1", rol: "flora", texto: "Parece deficiencia…" },
  ]);
  assert.equal(crudos[0].adjuntos.length, 2);
  assert.equal(crudos[0].adjuntos[0].tipo, "foto_enflora");
  assert.equal(crudos[0].adjuntos[1].tipo, "transitoria");
  assert.equal(crudos[0].adjuntos[1].persistida, false);
});

test("validar payload guardar chat exige turno usuario+flora", () => {
  const malo = validarPayloadGuardarChat({
    titulo: "Test",
    claveSesion: "s-abc123",
    mensajes: [{ id: "1", rol: "usuario", texto: "hola" }],
  });
  assert.equal(malo.ok, false);

  const ok = validarPayloadGuardarChat({
    titulo: "Test chat",
    claveSesion: "s-abc123",
    mensajes: [
      { id: "1", rol: "usuario", texto: "¿Cuándo regué?" },
      { id: "2", rol: "flora", texto: "El martes…" },
    ],
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.mensajes.length, 2);
});

test("validar mensajes rechaza demasiados turnos", () => {
  const muchos = Array.from({ length: 201 }, (_, i) => ({
    rol: i % 2 === 0 ? "usuario" : "flora",
    texto: "x",
    fecha: "2026-01-01T12:00:00.000Z",
  }));
  assert.equal(validarMensajesChatPersistidos(muchos).ok, false);
});
