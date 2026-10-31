import assert from "node:assert/strict";
import test from "node:test";
import {
  nivelComercialConsultaMultiplesUnidades,
  nivelComercialConsultaUnidad,
} from "../lib/flora-beneficios-politica.js";
import { etiquetaEstadoBeneficioPlan, planesEnflora, textoBeneficioPlan } from "../lib/planes.js";

test("textoBeneficioPlan lee objetos y strings", () => {
  const gratuito = planesEnflora.items.find((p) => p.id === "gratuito");
  assert.match(textoBeneficioPlan(gratuito.beneficios[0]), /unidad de cultivo/);
  assert.equal(textoBeneficioPlan("legacy"), "legacy");
});

test("planes por cultivo no prometen ilimitado genérico", () => {
  const licencia = planesEnflora.items.find((p) => p.id === "por-cultivo");
  const textos = licencia.beneficios.map(textoBeneficioPlan).join(" ");
  assert.doesNotMatch(textos, /ilimitad/i);
  assert.match(textos, /PLAN 420/);
});

test("nivel comercial multi-unidad es restrictivo", () => {
  assert.equal(nivelComercialConsultaUnidad("plus"), "plus");
  assert.equal(nivelComercialConsultaMultiplesUnidades(["plus", "gratuito"]), "gratuito");
  assert.equal(nivelComercialConsultaMultiplesUnidades(["plus", "plus"]), "plus");
});

test("beneficios Plus marcan proximamente clima y ADN", () => {
  const plus = planesEnflora.items.find((p) => p.id === "plus");
  const clima = plus.beneficios.find((b) => textoBeneficioPlan(b).includes("meteorológicos"));
  assert.equal(etiquetaEstadoBeneficioPlan(clima), "Próximamente");
});
