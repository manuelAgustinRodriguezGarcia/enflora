import assert from "node:assert/strict";
import test from "node:test";

import {
  FLORA_CHAT_MAX_BASE64,
  esUuidFotoFlora,
  mimeImagenFloraPermitido,
  normalizarPreguntaConImagen,
  parsearAdjuntoImagenCliente,
} from "../lib/flora-imagen-chat.js";
import {
  construirPartesUsuarioGemini,
  textoContextoImagenEnflora,
} from "../lib/flora-imagen-servidor.js";
import { validarMensajeUsuario } from "../lib/flora-gemini.js";
import {
  crearContextoGuardadoVacio,
  fusionarEntidadesImagenEnGuardado,
  referenciasJsonParaGuardado,
} from "../lib/flora-soluciones.js";

test("validar mensaje permite foto sin texto", () => {
  assert.equal(validarMensajeUsuario("").ok, false);
  assert.equal(validarMensajeUsuario("", { conImagen: true }).ok, true);
});

test("parsear adjunto transitoria valida mime y tamaño", () => {
  const ok = parsearAdjuntoImagenCliente({
    imagen: { origen: "transitoria", mimeType: "image/jpeg", datosBase64: "abc" },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.adjuntos.length, 1);
  assert.equal(ok.adjuntos[0].origen, "transitoria");

  const grande = parsearAdjuntoImagenCliente({
    imagen: {
      origen: "transitoria",
      mimeType: "image/png",
      datosBase64: "x".repeat(FLORA_CHAT_MAX_BASE64 + 1),
    },
  });
  assert.equal(grande.ok, false);
});

test("parsear adjunto enflora exige uuid", () => {
  const mal = parsearAdjuntoImagenCliente({ imagen: { origen: "enflora", fotoId: "no" } });
  assert.equal(mal.ok, false);
  const id = "550e8400-e29b-41d4-8716-446655440000";
  assert.ok(esUuidFotoFlora(id));
  const bien = parsearAdjuntoImagenCliente({ imagen: { origen: "enflora", fotoId: id } });
  assert.equal(bien.ok, true);
  assert.equal(bien.adjuntos[0].fotoId, id);
});

test("mime permitidos", () => {
  assert.ok(mimeImagenFloraPermitido("image/webp"));
  assert.equal(mimeImagenFloraPermitido("image/gif"), false);
});

test("partes gemini incluyen imagen y texto", () => {
  const partes = construirPartesUsuarioGemini("hola", [
    { mimeType: "image/jpeg", data: "Zm9v" },
  ]);
  assert.equal(partes.length, 2);
  assert.ok(partes[0].inlineData);
  assert.equal(partes[1].text, "hola");
});

test("referencias guardado incluyen foto enflora y transitoria", () => {
  const ctx = crearContextoGuardadoVacio();
  fusionarEntidadesImagenEnGuardado(ctx, {
    fotoRegistroId: "550e8400-e29b-41d4-8716-446655440001",
    plantaId: "550e8400-e29b-41d4-8716-446655440002",
    transitoria: true,
  });
  const refs = referenciasJsonParaGuardado(ctx);
  assert.ok(refs);
  assert.equal(refs.foto_enflora.registro_foto_id, "550e8400-e29b-41d4-8716-446655440001");
  assert.equal(refs.imagen_adjunta.transitoria, true);
});

test("contexto texto enflora menciona ids de herramientas", () => {
  const texto = textoContextoImagenEnflora({
    registro: {
      fecha_evento: "2026-01-15",
      unidad_cultivo_id: "550e8400-e29b-41d4-8716-446655440010",
      unidad: { nombre: "Carpa" },
      plantas: [{ planta_id: "550e8400-e29b-41d4-8716-446655440011", planta: { nombre: "Blue" } }],
    },
  });
  assert.match(texto, /550e8400-e29b-41d4-8716-446655440010/);
  assert.match(texto, /550e8400-e29b-41d4-8716-446655440011/);
});

test("pregunta por defecto con solo imagen", () => {
  assert.ok(normalizarPreguntaConImagen("").length > 10);
});
