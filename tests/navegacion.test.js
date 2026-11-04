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
  assert.equal(DESTINOS_NAVEGACION.find((item) => item.clave === "cultivos")?.href, "/cultivos");
  assert.equal(DESTINOS_NAVEGACION.find((item) => item.clave === "perfil"), undefined);
});

test("el menú Más abre historial, galería, productos, mezclas, genéticas y calendario sin activar Registrar", () => {
  const registro = DESTINOS_NAVEGACION.find((item) => item.clave === "registro");
  const historial = DESTINOS_MAS.find((item) => item.clave === "historial");
  const productos = DESTINOS_MAS.find((item) => item.clave === "productos");
  const mezclas = DESTINOS_MAS.find((item) => item.clave === "mezclas");
  const calendario = DESTINOS_MAS.find((item) => item.clave === "calendario");

  assert.deepEqual(
    DESTINOS_MAS.map((item) => item.etiqueta),
    ["Historial", "Galería de Flora", "Mis genéticas", "Mis mezclas", "Mis productos", "Calendario"]
  );
  assert.equal(historial?.href, "/registros/historial");
  assert.equal(calendario?.href, "/calendario");
  assert.equal(destinoActivo("/registros/historial", registro), false);
  assert.equal(destinoActivo("/registros/historial", historial), true);
  assert.equal(destinoActivo("/registros/productos", registro), false);
  assert.equal(destinoActivo("/registros/productos", productos), true);
  assert.equal(destinoActivo("/mezclas/abc", registro), false);
  assert.equal(destinoActivo("/mezclas/abc", mezclas), true);
  assert.equal(destinoActivo("/calendario", registro), false);
  assert.equal(destinoActivo("/calendario?tarea=t1", calendario), true);
  assert.equal(DESTINOS_NAVEGACION.some((item) => item.href === "/calendario"), false);
  assert.equal(DESTINOS_NAVEGACION.some((item) => item.href === "/galeria"), false);
  assert.equal(destinoActivo("/galeria", DESTINOS_MAS.find((item) => item.clave === "galeria")), true);
  assert.equal(destinoActivo("/galeria", registro), false);
});

test("destinoActivo distingue Registro e Historial", () => {
  const registro = DESTINOS_NAVEGACION.find((item) => item.clave === "registro");
  const historial = DESTINOS_MAS.find((item) => item.clave === "historial");

  assert.equal(destinoActivo("/registros", registro), true);
  assert.equal(destinoActivo("/registros/historial", registro), false);
  assert.equal(destinoActivo("/registros/historial?unidad=x", historial), true);
  assert.equal(destinoActivo("/registros/historial", historial), true);
  assert.equal(destinoActivo("/cultivos", DESTINOS_NAVEGACION.find((item) => item.clave === "cultivos")), true);
  assert.equal(destinoActivo("/cultivos/abc", DESTINOS_NAVEGACION.find((item) => item.clave === "cultivos")), true);
  assert.equal(destinoActivo("/inicio", DESTINOS_NAVEGACION.find((item) => item.clave === "inicio")), true);
});
