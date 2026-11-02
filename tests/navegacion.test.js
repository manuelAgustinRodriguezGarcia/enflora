import assert from "node:assert/strict";
import test from "node:test";
import { DESTINOS_MAS, DESTINOS_NAVEGACION, destinoActivo } from "../lib/navegacion.js";

test("navegación inferior incluye Inicio, Cultivos, Registrar y Flora", () => {
  assert.deepEqual(
    DESTINOS_NAVEGACION.map((item) => item.etiqueta),
    ["Inicio", "Cultivos", "Registrar", "Flora"]
  );
  assert.deepEqual(
    DESTINOS_NAVEGACION.map((item) => item.clave),
    ["inicio", "cultivos", "registro", "flora"]
  );
  assert.equal(DESTINOS_NAVEGACION.find((item) => item.clave === "inicio")?.href, "/inicio");
  assert.equal(DESTINOS_NAVEGACION.find((item) => item.clave === "cultivos")?.href, "/espacios");
  assert.equal(DESTINOS_NAVEGACION.find((item) => item.clave === "perfil"), undefined);
});

test("el menú Más abre historial, productos y mezclas sin activar Registrar", () => {
  const registro = DESTINOS_NAVEGACION.find((item) => item.clave === "registro");
  const historial = DESTINOS_MAS.find((item) => item.clave === "historial");
  const productos = DESTINOS_MAS.find((item) => item.clave === "productos");
  const mezclas = DESTINOS_MAS.find((item) => item.clave === "mezclas");

  assert.deepEqual(
    DESTINOS_MAS.map((item) => item.etiqueta),
    ["Historial", "Mis productos", "Mis mezclas"]
  );
  assert.equal(historial?.href, "/registros/historial");
  assert.equal(destinoActivo("/registros/historial", registro), false);
  assert.equal(destinoActivo("/registros/historial", historial), true);
  assert.equal(destinoActivo("/registros/productos", registro), false);
  assert.equal(destinoActivo("/registros/productos", productos), true);
  assert.equal(destinoActivo("/registros/recetas/abc", registro), false);
  assert.equal(destinoActivo("/registros/recetas/abc", mezclas), true);
});

test("destinoActivo distingue Registro e Historial", () => {
  const registro = DESTINOS_NAVEGACION.find((item) => item.clave === "registro");
  const historial = DESTINOS_MAS.find((item) => item.clave === "historial");

  assert.equal(destinoActivo("/registros", registro), true);
  assert.equal(destinoActivo("/registros/historial", registro), false);
  assert.equal(destinoActivo("/registros/historial?unidad=x", historial), true);
  assert.equal(destinoActivo("/registros/historial", historial), true);
  assert.equal(destinoActivo("/espacios/abc", DESTINOS_NAVEGACION.find((item) => item.clave === "cultivos")), true);
  assert.equal(destinoActivo("/inicio", DESTINOS_NAVEGACION.find((item) => item.clave === "inicio")), true);
});
