import assert from "node:assert/strict";
import test from "node:test";
import {
  ALCANCE_PLANTAS_GRATUITO,
  PLANTAS_GRATUITO_POR_UNIDAD,
  evaluarAltaPlantas,
  limitePlantasComercial,
} from "../lib/flora-beneficios-comercial.js";

test("limitePlantasComercial: gratuito 9, plus técnico 100", () => {
  assert.equal(limitePlantasComercial("gratuito"), PLANTAS_GRATUITO_POR_UNIDAD);
  assert.equal(limitePlantasComercial("plus", 100), 100);
  assert.equal(ALCANCE_PLANTAS_GRATUITO, "unidad_cultivo");
});

test("evaluarAltaPlantas permite hasta el tope inclusive", () => {
  assert.equal(
    evaluarAltaPlantas({ plantasExistentes: 8, cantidadAAgregar: 1, limitePermitido: 9 }).ok,
    true,
  );
  assert.equal(
    evaluarAltaPlantas({ plantasExistentes: 9, cantidadAAgregar: 1, limitePermitido: 9 }).ok,
    false,
  );
});

test("evaluarAltaPlantas rechaza alta múltiple que supera el tope", () => {
  const r = evaluarAltaPlantas({ plantasExistentes: 0, cantidadAAgregar: 10, limitePermitido: 9 });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, "limite_plantas_unidad");
  assert.match(r.mensaje, /9/);
});

test("evaluarAltaPlantas con licencia plus usa tope técnico", () => {
  assert.equal(
    evaluarAltaPlantas({ plantasExistentes: 50, cantidadAAgregar: 50, limitePermitido: 100 }).ok,
    true,
  );
});
