import assert from "node:assert/strict";
import test from "node:test";
import { ilustracionEspacio } from "../lib/imagenes-espacio.js";
import { rutaPortadaUnidad, rutaFotoValida } from "../lib/fotos.js";

test("ilustraciones de espacio usan fallback hasta que existan archivos en public/", () => {
  assert.equal(ilustracionEspacio("interior"), null);
  assert.equal(ilustracionEspacio("exterior"), null);
});

test("ruta de portada cumple el patrón validado en el servidor", () => {
  const usuarioId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const unidadId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const archivoId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const ruta = rutaPortadaUnidad(usuarioId, unidadId, archivoId, "webp");
  const miniatura = rutaPortadaUnidad(usuarioId, unidadId, archivoId, "webp", true);
  assert.ok(rutaFotoValida(ruta));
  assert.ok(rutaFotoValida(miniatura));
  assert.match(ruta, new RegExp(`^${usuarioId}/portadas/${unidadId}/`));
});
