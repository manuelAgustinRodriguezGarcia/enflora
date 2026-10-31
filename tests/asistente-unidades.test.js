import assert from "node:assert/strict";
import test from "node:test";
import {
  cambiarCantidadUnidades,
  continuar,
  estadoInicial,
} from "../lib/asistente-cultivo.js";
import { nombreUnidad as nombreUnidadLib } from "../lib/unidades.js";

test("nombreUnidad usa plantillas uniformes por tipo", () => {
  assert.equal(nombreUnidadLib("invernadero", 2), "Invernadero 2");
  assert.equal(nombreUnidadLib("aire_libre", 1), "Sector al aire libre 1");
  assert.equal(nombreUnidadLib("sala", 3), "Sala 3");
  assert.equal(nombreUnidadLib("otro", 1, "Armario"), "Unidad 1");
});

test("exterior aire libre pasa por cantidad de unidades antes de plantas", () => {
  let estado = estadoInicial();
  estado = { ...estado, nombre: "Patio", tipo: "exterior" };
  estado = continuar(estado);
  assert.equal(estado.paso, "tipo_unidad");

  estado = { ...estado, tipoUnidad: "aire_libre" };
  estado = continuar(estado);
  assert.equal(estado.paso, "cantidad_unidades");
  assert.equal(estado.unidades.length, 1);
  assert.equal(estado.unidades[0].nombre, "Sector al aire libre 1");

  estado = cambiarCantidadUnidades(estado, 2);
  assert.equal(estado.unidades.length, 2);
  assert.deepEqual(
    estado.unidades.map((unidad) => unidad.nombre),
    ["Sector al aire libre 1", "Sector al aire libre 2"]
  );

  estado = continuar(estado);
  assert.equal(estado.paso, "cantidad_plantas");
  assert.equal(estado.indice, 0);
});
