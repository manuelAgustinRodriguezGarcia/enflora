import assert from "node:assert/strict";
import test from "node:test";

import {
  clasificarErrorConsulta,
  consultaEsReintetable,
} from "../lib/supabase/diagnostico-consulta.js";

test("clasificar error de red como reintetable", () => {
  const c = clasificarErrorConsulta({ code: "", message: "TypeError: fetch failed" });
  assert.equal(c.tipo, "red");
  assert.equal(consultaEsReintetable(c), true);
});

test("clasificar JWT expirado como autorizacion reintetable", () => {
  const c = clasificarErrorConsulta({ code: "PGRST301", message: "JWT expired" });
  assert.equal(c.tipo, "autorizacion");
  assert.equal(consultaEsReintetable(c), true);
});

test("clasificar RLS sin reintento", () => {
  const c = clasificarErrorConsulta({ code: "42501", message: "permission denied" });
  assert.equal(c.tipo, "rls");
  assert.equal(consultaEsReintetable(c), false);
});

test("respuesta vacía válida no es error", () => {
  const c = clasificarErrorConsulta(null);
  assert.equal(c.tipo, "ok");
});
