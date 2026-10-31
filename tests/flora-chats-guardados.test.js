import assert from "node:assert/strict";
import test from "node:test";

import {
  mensajesClienteParaPersistencia,
  primeraPreguntaSignificativaDesdeMensajes,
  sugerirTituloChat,
  validarMensajesChatPersistidos,
  validarMensajesChatActualizacion,
  validarPayloadGuardarChat,
} from "../lib/flora-chats-guardados.js";
import { mensajesClienteDesdeGuardados } from "../lib/flora-mensajes-cliente-desde-guardado.js";
import { AVISO_IMAGEN_CHAT_NO_GUARDADA } from "../lib/flora-imagen-chat.js";

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

test("persiste la ruta durable de una foto de Flora y no el base64", () => {
  const ruta = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/flora/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp";
  const crudos = mensajesClienteParaPersistencia([
    {
      rol: "usuario",
      texto: "Mirá",
      adjuntos: [{ origen: "flora", ruta, vista: "https://firmada.example/foto", datosBase64: "xxxx" }],
    },
    { rol: "flora", texto: "Veo una hoja." },
  ]);
  assert.deepEqual(crudos[0].adjuntos, [{ tipo: "foto_flora", ruta }]);
  const val = validarMensajesChatPersistidos(crudos);
  assert.equal(val.ok, true);

  const invalida = validarMensajesChatPersistidos([
    { rol: "usuario", texto: "Mirá", adjuntos: [{ tipo: "foto_flora", ruta: "otra/ruta.webp" }] },
    { rol: "flora", texto: "ok" },
  ]);
  assert.equal(invalida.ok, false);
});

test("restaura fotos guardadas y avisa si la imagen nunca se persistió", () => {
  const ruta = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/flora/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp";
  const mensajes = mensajesClienteDesdeGuardados([
    {
      rol: "usuario",
      texto: "Foto nueva",
      fecha: "2026-01-01T12:00:00.000Z",
      adjuntos: [{ tipo: "foto_flora", ruta, vistaUrl: "https://firmada.example/a" }],
    },
    {
      rol: "usuario",
      texto: "Foto vieja",
      fecha: "2026-01-02T12:00:00.000Z",
      adjuntos: [{ tipo: "transitoria", persistida: false }],
    },
    { rol: "flora", texto: "Listo", fecha: "2026-01-02T12:00:05.000Z" },
  ]);
  const conFoto = mensajes.find((m) => m.texto === "Foto nueva");
  const vieja = mensajes.find((m) => m.texto === "Foto vieja");
  assert.equal(conFoto.adjuntos[0].origen, "flora");
  assert.equal(conFoto.adjuntos[0].ruta, ruta);
  assert.equal(conFoto.adjuntos[0].vista, "https://firmada.example/a");
  assert.equal(conFoto.adjuntos[0].noDisponible, false);
  assert.equal(vieja.adjuntos[0].noDisponible, true);
  assert.equal(vieja.adjuntos[0].aviso, AVISO_IMAGEN_CHAT_NO_GUARDADA);
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

test("actualización permite último mensaje del usuario sin Flora", () => {
  const mensajes = [
    { rol: "usuario", texto: "¿Cuándo regué?", fecha: "2026-01-01T12:00:00.000Z" },
    { rol: "flora", texto: "El martes…", fecha: "2026-01-01T12:00:05.000Z" },
    { rol: "usuario", texto: "¿Y hoy?", fecha: "2026-01-02T12:00:00.000Z" },
  ];
  const val = validarMensajesChatActualizacion(mensajes);
  assert.equal(val.ok, true);
});

test("actualización rechaza solo pregunta sin historial flora", () => {
  assert.equal(validarMensajesChatActualizacion([{ rol: "usuario", texto: "hola" }]).ok, false);
});

test("validar mensajes rechaza demasiados turnos", () => {
  const muchos = Array.from({ length: 201 }, (_, i) => ({
    rol: i % 2 === 0 ? "usuario" : "flora",
    texto: "x",
    fecha: "2026-01-01T12:00:00.000Z",
  }));
  assert.equal(validarMensajesChatPersistidos(muchos).ok, false);
});
