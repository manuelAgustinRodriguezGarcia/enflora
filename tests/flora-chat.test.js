import assert from "node:assert/strict";
import test from "node:test";

import {
  LIMITES_CHAT_FLORA,
  reiniciarCuotasChatFlora,
  verificarCuotaUsuario,
} from "../lib/flora-chat-limites.js";
import { geminiConfigurado } from "../lib/flora-chat-config.js";
import { normalizarHistorialCliente, validarMensajeUsuario } from "../lib/flora-gemini.js";
import {
  ejecutarHerramientaFlora,
  NOMBRES_HERRAMIENTAS_FLORA,
} from "../lib/flora-herramientas-gemini.js";

test("validar mensaje vacío y largo", () => {
  assert.equal(validarMensajeUsuario("").ok, false);
  assert.equal(validarMensajeUsuario("hola").ok, true);
  assert.equal(validarMensajeUsuario("x".repeat(LIMITES_CHAT_FLORA.maxCaracteresMensaje + 1)).ok, false);
});

test("historial cliente se acota", () => {
  const largo = Array.from({ length: 20 }, (_, i) => ({
    rol: i % 2 ? "flora" : "usuario",
    texto: `m${i}`,
  }));
  const norm = normalizarHistorialCliente(largo);
  assert.equal(norm.length, LIMITES_CHAT_FLORA.maxTurnosHistorial);
  assert.equal(norm[0].rol, "user");
});

test("cuota por usuario en servidor", () => {
  reiniciarCuotasChatFlora();
  const id = "usuario-cuota-test";
  for (let i = 0; i < LIMITES_CHAT_FLORA.solicitudesPorMinuto; i += 1) {
    const r = verificarCuotaUsuario(id);
    assert.equal(r.ok, true);
  }
  const bloqueado = verificarCuotaUsuario(id);
  assert.equal(bloqueado.ok, false);
  reiniciarCuotasChatFlora();
});

test("herramienta no autorizada", async () => {
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } };
  const r = await ejecutarHerramientaFlora(supabase, "borrar_todo", {});
  assert.match(r.error || "", /no autorizada/i);
});

test("herramienta guía valida consulta", async () => {
  const r = await ejecutarHerramientaFlora(null, "buscar_en_guia_cultivo", { consulta: "" });
  assert.match(r.error || "", /vacía/i);
});

test("UUID inválido en herramienta de cultivo", async () => {
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) },
  };
  const r = await ejecutarHerramientaFlora(supabase, "consultar_parametros", {
    unidad_id: "no-es-uuid",
    clave_nativa: "ph",
  });
  assert.match(r.error || "", /identificador/i);
});

test("lista de herramientas gemini incluye guía", () => {
  assert.ok(NOMBRES_HERRAMIENTAS_FLORA.includes("buscar_en_guia_cultivo"));
  assert.ok(NOMBRES_HERRAMIENTAS_FLORA.includes("buscar_soluciones_guardadas"));
  assert.equal(NOMBRES_HERRAMIENTAS_FLORA.length, 10);
});

test("geminiConfigurado depende de env", () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal(geminiConfigurado(), false);
  process.env.GEMINI_API_KEY = prev;
});
