import assert from "node:assert/strict";
import test from "node:test";

import {
  etapasParaFiltroHistorial,
  metricaDeSerie,
  puntosMedicionDesdeRegistros,
  resolverEtapaRegistro,
  serieMedicionesHistorial,
} from "../lib/historial-vista-cultivo.js";

const plantaA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const plantaB = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

const etapasA = [
  { etapa: "vegetativo", fechaInicio: "2026-01-01", fechaFin: "2026-02-01" },
  { etapa: "enflora", fechaInicio: "2026-02-01", fechaFin: null },
];
const etapasB = [
  { etapa: "vegetativo", fechaInicio: "2026-01-01", fechaFin: "2026-03-01" },
  { etapa: "enflora", fechaInicio: "2026-03-01", fechaFin: null },
];

function registro({ fecha, aplicaA = "plantas", plantas = [plantaA], ph = 6 }) {
  return {
    id: `${fecha}-${aplicaA}-${plantas.join("-")}`,
    fecha_evento: `${fecha}T15:00:00.000Z`,
    aplica_a: aplicaA,
    registro_plantas: plantas.map((planta_id) => ({ planta_id })),
    registro_parametros: [
      { clave_nativa: "ph", tipo_valor: "numero", valor_numero: ph, unidad: "", nombre: "pH" },
    ],
  };
}

test("una sola línea de etapas asigna la etapa del alcance", () => {
  const etapa = resolverEtapaRegistro({
    registro: registro({ fecha: "2026-02-10", aplicaA: "ambiente", plantas: [] }),
    fecha: "2026-02-10",
    etapas: etapasA,
    etapasPorPlanta: null,
  });
  assert.equal(etapa, "enflora");
});

test("ambiente con plantas en etapas distintas no se atribuye a una etapa", () => {
  const etapa = resolverEtapaRegistro({
    registro: registro({ fecha: "2026-02-10", aplicaA: "ambiente", plantas: [] }),
    fecha: "2026-02-10",
    etapas: [],
    etapasPorPlanta: [
      { plantaId: plantaA, etapas: etapasA },
      { plantaId: plantaB, etapas: etapasB },
    ],
  });
  assert.equal(etapa, "");
});

test("medición de plantas solo entra en la etapa si todas coinciden", () => {
  const varias = [
    { plantaId: plantaA, etapas: etapasA },
    { plantaId: plantaB, etapas: etapasB },
  ];
  assert.equal(
    resolverEtapaRegistro({
      registro: registro({ fecha: "2026-01-15", plantas: [plantaA, plantaB] }),
      fecha: "2026-01-15",
      etapasPorPlanta: varias,
    }),
    "vegetativo",
  );
  assert.equal(
    resolverEtapaRegistro({
      registro: registro({ fecha: "2026-02-10", plantas: [plantaA, plantaB] }),
      fecha: "2026-02-10",
      etapasPorPlanta: varias,
    }),
    "",
  );
  assert.equal(
    resolverEtapaRegistro({
      registro: registro({ fecha: "2026-02-10", plantas: [plantaA] }),
      fecha: "2026-02-10",
      etapasPorPlanta: varias,
    }),
    "enflora",
  );
});

test("el filtro de etapa recorta la serie y las estadísticas", () => {
  const puntos = puntosMedicionDesdeRegistros(
    [
      registro({ fecha: "2026-01-10", ph: 6 }),
      registro({ fecha: "2026-02-10", ph: 5.5 }),
    ],
    { etapas: etapasA, fechaInicio: "2026-01-01" },
  );
  const historial = {
    puntosMedicion: puntos,
    etapas: etapasA.map((etapa, indice) => ({ ...etapa, id: String(indice) })),
  };
  assert.deepEqual(etapasParaFiltroHistorial(historial), ["vegetativo", "enflora"]);
  const floracion = serieMedicionesHistorial(historial, "ph", "enflora");
  assert.equal(floracion.length, 1);
  assert.equal(floracion[0].valor, 5.5);
  const metrica = metricaDeSerie(floracion, 2);
  assert.equal(metrica.cantidad, 1);
  assert.equal(metrica.minimo, 5.5);
  assert.equal(serieMedicionesHistorial(historial, "ph", "germinacion").length, 0);
  assert.equal(serieMedicionesHistorial(historial, "ph", "").length, 2);
});
