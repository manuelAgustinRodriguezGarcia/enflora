import assert from "node:assert/strict";
import test from "node:test";
import {
  agruparRegistrosPorDia,
  fusionarLotePorDias,
  recortarRegistrosPorDias,
} from "../lib/historial-paginacion-dias.js";

const ID = (n) => `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${n}`;

function registro(id, fechaIso) {
  return { id: ID(id), fecha_evento: fechaIso };
}

test("agrupa por día civil sin mezclar eventos", () => {
  const grupos = agruparRegistrosPorDia([
    registro(1, "2026-10-27T15:00:00.000Z"),
    registro(2, "2026-10-27T18:00:00.000Z"),
    registro(3, "2026-10-26T15:00:00.000Z"),
  ]);
  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].fecha, "2026-10-27");
  assert.equal(grupos[0].registros.length, 2);
});

test("recortar por días no deja un día incompleto al borde", () => {
  const registros = [
    registro(1, "2026-10-27T15:00:00.000Z"),
    registro(2, "2026-10-27T18:00:00.000Z"),
    registro(3, "2026-10-26T15:00:00.000Z"),
    registro(4, "2026-10-25T15:00:00.000Z"),
  ];
  const { registros: recortados, diasCompletos } = recortarRegistrosPorDias(registros, 2);
  assert.equal(diasCompletos, 2);
  assert.equal(recortados.length, 3);
  assert.ok(!recortados.some((item) => item.id === ID(4)));
});

test("fusionar lote respeta días completos y cursor", () => {
  const lote = [
    registro(1, "2026-10-27T15:00:00.000Z"),
    registro(2, "2026-10-26T15:00:00.000Z"),
    registro(3, "2026-10-25T15:00:00.000Z"),
  ];
  const fusion = fusionarLotePorDias(lote, 2);
  assert.equal(fusion.registros.length, 2);
  assert.ok(fusion.cursor);
});
