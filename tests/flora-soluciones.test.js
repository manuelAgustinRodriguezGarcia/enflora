import assert from "node:assert/strict";
import test from "node:test";

import {
  claveUnicaTurnoGuardado,
  emitirTokenProcedenciaSolucion,
  fusionarContextoGuardadoDesdeHerramienta,
  crearContextoGuardadoVacio,
  sugerirTituloSolucion,
  validarTextosGuardado,
  verificarTokenProcedenciaSolucion,
} from "../lib/flora-soluciones.js";
import {
  ejecutarHerramientaFlora,
  NOMBRES_HERRAMIENTAS_FLORA,
} from "../lib/flora-herramientas-gemini.js";

test("sugerir título desde pregunta", () => {
  assert.match(sugerirTituloSolucion("  cómo riego la carpa 1?  "), /^Cómo riego/i);
  assert.equal(sugerirTituloSolucion(""), "Consulta con Flora");
});

test("fusionar contexto guardado desde herramientas", () => {
  const acum = crearContextoGuardadoVacio();
  fusionarContextoGuardadoDesdeHerramienta(acum, {
    entidades: { unidad_id: "550e8400-e29b-41d4-a716-446655440000" },
    datos: [
      {
        documentoId: "doc-1",
        seccionId: "s-1",
        titulo: "Riego",
        referencias: [{ tipo: "libro", titulo: "Guía X" }],
      },
    ],
  });
  assert.equal(acum.unidadCultivoId, "550e8400-e29b-41d4-a716-446655440000");
  assert.ok(acum.referencias.length >= 2);
});

test("token de procedencia valida pregunta y respuesta", () => {
  const uid = "11111111-1111-4111-8111-111111111111";
  const pregunta = "¿Cuándo regué?";
  const respuesta = "Según tu registro…";
  const token = emitirTokenProcedenciaSolucion(uid, pregunta, respuesta);
  assert.equal(verificarTokenProcedenciaSolucion(token, uid, pregunta, respuesta).ok, true);
  assert.equal(verificarTokenProcedenciaSolucion(token, uid, pregunta, "otra").ok, false);
});

test("validar textos de guardado", () => {
  assert.equal(validarTextosGuardado({ pregunta: "", respuesta: "x" }).ok, false);
  assert.equal(validarTextosGuardado({ pregunta: "hola", respuesta: "ok" }).ok, true);
});

test("clave única de turno estable", () => {
  const a = claveUnicaTurnoGuardado("p", "r");
  const b = claveUnicaTurnoGuardado("p", "r");
  assert.equal(a, b);
});

test("herramienta buscar soluciones valida consulta", async () => {
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) },
    rpc: async () => ({ data: [], error: null }),
  };
  const vacia = await ejecutarHerramientaFlora(supabase, "buscar_soluciones_guardadas", { consulta: "a" });
  assert.match(vacia.error || "", /2 caracteres/i);
  const ok = await ejecutarHerramientaFlora(supabase, "buscar_soluciones_guardadas", {
    consulta: "riego carpa",
  });
  assert.equal(ok.tipoConsulta, "buscar_soluciones");
  assert.equal(ok.metadatos?.historico, true);
});

test("lista gemini incluye buscar soluciones", () => {
  assert.ok(NOMBRES_HERRAMIENTAS_FLORA.includes("buscar_soluciones_guardadas"));
  assert.equal(NOMBRES_HERRAMIENTAS_FLORA.length, 10);
});
