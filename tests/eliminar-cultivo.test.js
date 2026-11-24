import assert from "node:assert/strict";
import test from "node:test";
import {
  textoCiclosQueBloqueanEspacio,
  textoCiclosQueBloqueanUnidad,
  textoErrorBorrado,
} from "../lib/eliminar-cultivo.js";

test("el espacio bloqueado nombra la unidad y el ciclo de licencia", () => {
  const mensaje = textoCiclosQueBloqueanEspacio("Terraza", [
    { unidad: "Invernadero", ciclo: "Ciclo verano" },
  ]);

  assert.match(mensaje, /Terraza/);
  assert.match(mensaje, /Invernadero/);
  assert.match(mensaje, /Ciclo verano/);
  assert.match(mensaje, /pago de la licencia/);
  assert.doesNotMatch(mensaje, /No se pudo eliminar el espacio/);
});

test("varios ciclos se enumeran en el mensaje del espacio", () => {
  const mensaje = textoCiclosQueBloqueanEspacio("Terraza", [
    { unidad: "Carpa", ciclo: "Uno" },
    { unidad: "Sala", ciclo: "Dos" },
  ]);

  assert.match(mensaje, /Carpa/);
  assert.match(mensaje, /Sala/);
  assert.match(mensaje, /Uno/);
  assert.match(mensaje, /Dos/);
});

test("la unidad bloqueada nombra su ciclo", () => {
  const mensaje = textoCiclosQueBloqueanUnidad("Invernadero", [{ nombre: "Ciclo verano" }]);
  assert.match(mensaje, /Invernadero/);
  assert.match(mensaje, /Ciclo verano/);
});

test("un conflicto de licencia sin nombres sigue explicando el motivo", () => {
  const mensaje = textoErrorBorrado("espacio", {
    code: "23503",
    message: 'violates foreign key constraint "ciclos_cultivo_unidad_ancla_id_fkey" on table "ciclos_cultivo"',
    details: "Key is still referenced from table ciclos_cultivo.",
  });

  assert.match(mensaje, /ciclo de licencia/);
  assert.match(mensaje, /pago/);
});

test("otro vinculo y un fallo de conexión no se muestran como el mismo error", () => {
  const vinculo = textoErrorBorrado("espacio", {
    code: "23503",
    message: 'violates foreign key constraint "otra_tabla_fkey"',
  });
  const conexion = textoErrorBorrado("unidad", { code: "08006", message: "connection failure" });

  assert.match(vinculo, /datos vinculados/);
  assert.match(conexion, /conexión/);
  assert.notEqual(vinculo, conexion);
});
