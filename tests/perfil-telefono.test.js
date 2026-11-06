import assert from "node:assert/strict";
import test from "node:test";
import { intentaBorrarTelefono, telefonoIngresado } from "../lib/perfil/telefono.js";

test("un teléfono guardado no se puede dejar vacío", () => {
  assert.equal(intentaBorrarTelefono("11 4200 4200", ""), true);
  assert.equal(intentaBorrarTelefono("11 4200 4200", "   "), true);
  assert.equal(intentaBorrarTelefono("1142004200", null), true);
});

test("se puede cambiar el teléfono por otro número", () => {
  assert.equal(intentaBorrarTelefono("11 4200 4200", "11 5555 1212"), false);
});

test("si nunca hubo teléfono, vacío sigue siendo válido", () => {
  assert.equal(intentaBorrarTelefono("", ""), false);
  assert.equal(intentaBorrarTelefono(null, ""), false);
  assert.equal(intentaBorrarTelefono("   ", ""), false);
});

test("recorta espacios del teléfono ingresado", () => {
  assert.equal(telefonoIngresado("  11 4200 4200  "), "11 4200 4200");
  assert.equal(telefonoIngresado(null), "");
});
