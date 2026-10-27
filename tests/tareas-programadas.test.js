import assert from "node:assert/strict";
import test from "node:test";
import { accionesOfrecibles, ACCIONES_SEGUIMIENTO } from "../lib/seguimiento.js";
import {
  fechaMananaLocal,
  plantasIdsParaTarea,
  tareaNoEsPasada,
} from "../lib/tareas-programadas.js";

test("tarea ya no es acción seleccionable", () => {
  assert.ok(!ACCIONES_SEGUIMIENTO.some((item) => item.valor === "tarea"));
  assert.deepEqual(accionesOfrecibles(["riego", "tarea", "foto"]), ["riego"]);
});

test("fechaMananaLocal avanza un día en calendario local", () => {
  const manana = fechaMananaLocal(new Date(2026, 9, 27));
  assert.equal(manana, "2026-10-28");
});

test("tareaNoEsPasada rechaza fechas anteriores a hoy", () => {
  assert.equal(tareaNoEsPasada("2026-10-27", "2026-10-27"), true);
  assert.equal(tareaNoEsPasada("2026-10-26", "2026-10-27"), false);
});

test("plantasIdsParaTarea solo guarda subconjunto manual", () => {
  const plantas = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(
    plantasIdsParaTarea({
      aplicaA: "plantas",
      plantasSeleccionadas: plantas,
      plantasUnidad: plantas,
      modoSeleccion: "unidad",
    }),
    []
  );
  assert.deepEqual(
    plantasIdsParaTarea({
      aplicaA: "plantas",
      plantasSeleccionadas: [plantas[0]],
      plantasUnidad: plantas,
      modoSeleccion: "manual",
    }),
    ["a"]
  );
  assert.deepEqual(
    plantasIdsParaTarea({
      aplicaA: "ambiente",
      plantasSeleccionadas: plantas,
      plantasUnidad: plantas,
      modoSeleccion: "manual",
    }),
    []
  );
});
