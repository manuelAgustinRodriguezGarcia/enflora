import assert from "node:assert/strict";
import test from "node:test";
import {
  MENSAJE_USUARIO_OCUPADO,
  armarSugerenciasNombreUsuario,
  normalizarNombreUsuario,
} from "../lib/perfil/nombre-usuario.js";

test("normaliza el nombre y conserva el punto", () => {
  assert.equal(normalizarNombreUsuario("  Manu.AR1.420 "), "manu.ar1.420");
  assert.equal(normalizarNombreUsuario("Pedro!!"), "pedro");
  assert.equal(normalizarNombreUsuario("..ana.."), "ana");
});

test("la primera sugerencia suma .420", () => {
  assert.equal(armarSugerenciasNombreUsuario("Pedro")[0], "pedro.420");
  assert.equal(armarSugerenciasNombreUsuario("manu_ar1")[0], "manu_ar1.420");
});

test("si .420 ya es el nombre, ofrece el siguiente", () => {
  const sugerencias = armarSugerenciasNombreUsuario("pedro.420");
  assert.equal(sugerencias[0], "pedro.421");
  assert.equal(sugerencias.includes("pedro.420"), false);
});

test("el aviso de nombre ocupado es el de la pantalla", () => {
  assert.equal(MENSAJE_USUARIO_OCUPADO, "Uy, alguien ya tiene este nombre de usuario!");
});
