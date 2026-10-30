import assert from "node:assert/strict";
import test from "node:test";
import { DESTINOS_NAVEGACION, destinoActivo } from "../lib/navegacion.js";

test("navegación inferior incluye Cultivos, Historial, Registrar, Flora y Perfil", () => {
  assert.deepEqual(
    DESTINOS_NAVEGACION.map((item) => item.etiqueta),
    ["Cultivos", "Historial", "Registrar", "Flora", "Perfil"]
  );
  assert.deepEqual(
    DESTINOS_NAVEGACION.map((item) => item.clave),
    ["cultivos", "historial", "registro", "flora", "perfil"]
  );
  assert.equal(DESTINOS_NAVEGACION.find((item) => item.clave === "cultivos")?.href, "/espacios");
  assert.equal(DESTINOS_NAVEGACION.find((item) => item.clave === "historial")?.href, "/registros/historial");
});

test("destinoActivo distingue Registro e Historial", () => {
  const registro = DESTINOS_NAVEGACION.find((item) => item.clave === "registro");
  const historial = DESTINOS_NAVEGACION.find((item) => item.clave === "historial");

  assert.equal(destinoActivo("/registros", registro), true);
  assert.equal(destinoActivo("/registros/historial", registro), false);
  assert.equal(destinoActivo("/registros/historial?unidad=x", historial), true);
  assert.equal(destinoActivo("/registros/historial", historial), true);
  assert.equal(destinoActivo("/espacios/abc", DESTINOS_NAVEGACION[0]), true);
});
