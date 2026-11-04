import assert from "node:assert/strict";
import test from "node:test";
import {
  TOPE_MENSAJE_REPORTE_FLORA,
  alcanceRegistroDeReporte,
  armarMensajeFloraReporte,
  claveSesionReporte,
  descripcionReporteValida,
  plantasAfectadasReporte,
  seleccionInicialReporte,
  tituloChatReporte,
} from "../lib/reportes-problema.js";

const UNIDAD = "11111111-1111-4111-8111-111111111111";
const PLANTA_A = "22222222-2222-4222-8222-222222222222";
const PLANTA_B = "33333333-3333-4333-8333-333333333333";
const AJENA = "44444444-4444-4444-8444-444444444444";

const PLANTAS = [
  { id: PLANTA_A, nombre: "Mango", genetica: "Critical", numero: 1 },
  { id: PLANTA_B, nombre: "Limón", genetica: "", numero: 2 },
];

test("la descripción vacía o en blanco no sirve", () => {
  assert.equal(descripcionReporteValida("").ok, false);
  assert.equal(descripcionReporteValida("   \n  ").ok, false);
  assert.equal(descripcionReporteValida("  hojas amarillas  ").texto, "hojas amarillas");
});

test("todas las plantas de la unidad entran juntas y una selección exige al menos una", () => {
  const todas = plantasAfectadasReporte({ alcance: "unidad", plantasUnidad: PLANTAS, idsSeleccionados: [] });
  assert.equal(todas.ok, true);
  assert.equal(todas.plantas.length, 2);

  const vacia = plantasAfectadasReporte({
    alcance: "seleccion",
    plantasUnidad: PLANTAS,
    idsSeleccionados: [],
  });
  assert.equal(vacia.ok, false);

  const algunas = plantasAfectadasReporte({
    alcance: "seleccion",
    plantasUnidad: PLANTAS,
    idsSeleccionados: [PLANTA_B],
  });
  assert.deepEqual(algunas.plantas.map((planta) => planta.id), [PLANTA_B]);
});

test("rechaza una planta que no está en la unidad", () => {
  const resultado = plantasAfectadasReporte({
    alcance: "seleccion",
    plantasUnidad: PLANTAS,
    idsSeleccionados: [PLANTA_A, AJENA],
  });
  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /no pertenece/);
});

test("una sola planta queda como alcance de toda la unidad", () => {
  const seleccion = seleccionInicialReporte({
    origen: "planta",
    plantaIds: [PLANTA_A],
    plantasUnidad: [PLANTAS[0]],
  });
  assert.equal(seleccion.alcance, "unidad");
  assert.deepEqual(seleccion.ids, [PLANTA_A]);
});

test("la ficha de una planta entre varias preselecciona solo esa, y se puede ampliar", () => {
  const seleccion = seleccionInicialReporte({
    origen: "planta",
    plantaIds: [PLANTA_A],
    plantasUnidad: PLANTAS,
  });
  assert.equal(seleccion.alcance, "seleccion");
  assert.deepEqual(seleccion.ids, [PLANTA_A]);
});

test("cambiar de unidad no conserva plantas de la unidad anterior", () => {
  const seleccion = seleccionInicialReporte({
    origen: "inicio",
    plantaIds: [AJENA],
    plantasUnidad: PLANTAS,
  });
  assert.equal(seleccion.alcance, "unidad");
  assert.deepEqual(seleccion.ids, [PLANTA_A, PLANTA_B]);
});

test("el alcance del registro distingue toda la unidad de una selección", () => {
  assert.equal(alcanceRegistroDeReporte("unidad", 4), "unidad");
  assert.equal(alcanceRegistroDeReporte("seleccion", 1), "planta");
  assert.equal(alcanceRegistroDeReporte("seleccion", 3), "plantas");
});

test("el mensaje para Flora cabe en el límite, separa el relato y nombra las plantas", () => {
  const relato = "las hojas inferiores están amarillas";
  const mensaje = armarMensajeFloraReporte({
    unidadNombre: "Carpa 1",
    unidadId: UNIDAD,
    alcance: "seleccion",
    plantas: [PLANTAS[0]],
    descripcion: relato,
    fechaIso: "2026-11-04T19:02:00.000Z",
    registroId: AJENA,
  });

  assert.ok(mensaje.length <= TOPE_MENSAJE_REPORTE_FLORA);
  assert.match(mensaje, /no un diagnóstico/);
  assert.match(mensaje, /selección específica/);
  assert.match(mensaje, /Mango \(Critical\)/);
  assert.match(mensaje, new RegExp(PLANTA_A));
  assert.match(mensaje, new RegExp(UNIDAD));
  assert.match(mensaje, new RegExp(relato));
  assert.match(mensaje, /diagnóstico confirmado/);
});

test("una descripción larga se recorta en el mensaje y el registro conserva el aviso", () => {
  const mensaje = armarMensajeFloraReporte({
    unidadNombre: "Carpa 1",
    unidadId: UNIDAD,
    alcance: "unidad",
    plantas: PLANTAS,
    descripcion: "a".repeat(4000),
    fechaIso: "2026-11-04T19:02:00.000Z",
    registroId: AJENA,
  });
  assert.equal(mensaje.length <= TOPE_MENSAJE_REPORTE_FLORA, true);
  assert.match(mensaje, /descripción completa quedó en el registro/);
});

test("la clave de sesión del reporte es estable y entra en un chat", () => {
  assert.equal(claveSesionReporte(UNIDAD), `reporte-${UNIDAD.replace(/-/g, "")}`);
  assert.ok(tituloChatReporte("Carpa norte").startsWith("Problema en "));
});
