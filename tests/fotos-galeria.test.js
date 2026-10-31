import assert from "node:assert/strict";
import test from "node:test";
import { ilustracionEspacio } from "../lib/imagenes-espacio.js";
import { rutaFotoFloraChat, rutaFotoFloraChatValida, rutaPortadaUnidad, rutaFotoValida } from "../lib/fotos.js";

test("ilustraciones de espacio apuntan a las imágenes de cultivo", () => {
  assert.equal(ilustracionEspacio("interior"), "/images/app/interior-cultivos.png");
  assert.equal(ilustracionEspacio("exterior"), "/images/app/exterior-cultivos.png");
  assert.equal(ilustracionEspacio("otro"), null);
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

test("ruta de foto de Flora queda bajo la carpeta del usuario", () => {
  const usuarioId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const archivoId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const ruta = rutaFotoFloraChat(usuarioId, archivoId, "webp");
  assert.equal(rutaFotoFloraChatValida(ruta), true);
  assert.equal(rutaFotoValida(ruta), true);
  assert.equal(rutaFotoValida(`${usuarioId}/flora/no-es-uuid.webp`), false);
  assert.equal(rutaFotoFloraChatValida(`${usuarioId}/registros/${archivoId}.webp`), false);
});
