import assert from "node:assert/strict";
import test from "node:test";

import { textoContextoImagenEnflora } from "../lib/flora-imagen-servidor.js";

test("etiqueta de planta desde snapshot registro_plantas (import histórico)", () => {
  const texto = textoContextoImagenEnflora({
    registro: {
      fecha_evento: "2026-01-15",
      unidad_cultivo_id: "550e8400-e29b-41d4-8716-446655440010",
      aplica_a: "plantas",
      unidad: { nombre: "Carpa hidro" },
      registro_plantas: [
        { planta_id: "550e8400-e29b-41d4-8716-446655440011", nombre_planta: "Gorila glue #4" },
        { planta_id: "550e8400-e29b-41d4-8716-446655440012", nombre_planta: "Gorila glue #4" },
      ],
    },
  });
  assert.match(texto, /Carpa hidro/);
  assert.match(texto, /Varias plantas/);
});

test("registro ambiente sin plantas no rompe contexto", () => {
  const texto = textoContextoImagenEnflora({
    registro: {
      fecha_evento: "2026-01-10",
      aplica_a: "ambiente",
      unidad: { nombre: "Carpa hidro" },
      registro_plantas: [],
    },
  });
  assert.match(texto, /ambiente/);
});
