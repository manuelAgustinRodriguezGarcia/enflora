import assert from "node:assert/strict";
import test from "node:test";
import {
  aligerarResultadoModelo,
  claveLlamadaHerramienta,
  comparacionAlcanzaParaResponder,
  llamadaCubiertaPorComparacion,
  registroCompacto,
} from "../lib/flora-analisis.js";
import { revisarMedicionPlausible } from "../lib/flora-mediciones.js";
import { INSTRUCCION_SISTEMA_FLORA_BASE } from "../lib/flora-sistema-instrucciones.js";

test("pH 33 es sospechoso y un valor ausente no se marca como medición", () => {
  const sospechoso = revisarMedicionPlausible("ph", 33, "");
  assert.equal(sospechoso.estado, "sospechoso");
  assert.match(sospechoso.advertencia, /0 a 14/);

  const ausente = revisarMedicionPlausible("ph", null, "");
  assert.equal(ausente.estado, "ausente");
  assert.equal(ausente.advertencia, undefined);

  assert.equal(revisarMedicionPlausible("ph", 6.6, "").estado, "presente");
  assert.equal(revisarMedicionPlausible("ec", 3, "").estado, "presente");
  assert.equal(revisarMedicionPlausible("vpd", 123, "kPa").estado, "sospechoso");
  assert.equal(revisarMedicionPlausible("humedad", 26, "%").estado, "presente");
});

test("el registro muestra la hora de Argentina y conserva el pH imposible", () => {
  const compacto = registroCompacto({
    id: "r-ph",
    fecha_evento: "2026-10-27T18:28:00.000Z",
    registro_parametros: [
      {
        origen: "nativa",
        clave_nativa: "ph",
        nombre: "pH",
        tipo_valor: "numero",
        valor_numero: 33,
        unidad: "",
      },
    ],
    registro_acciones: [],
    registro_plantas: [],
    registro_fotos: [{ id: "f1" }],
  });

  assert.equal(compacto.fecha_evento, "2026-10-27T18:28:00.000Z");
  assert.equal(compacto.fecha_local, "2026-10-27");
  assert.equal(compacto.hora_local, "15:28");
  assert.equal(compacto.parametros[0].valor_numero, 33);
  assert.match(compacto.parametros[0].advertencia, /plausible/);

  const liviano = aligerarResultadoModelo({ datos: compacto });
  assert.equal(liviano.datos.fotos.cantidad, 1);
  assert.equal(liviano.datos.fotos.ids, undefined);
  assert.equal(liviano.datos.parametros[0].valor_numero, 33);
});

test("la misma llamada de herramienta se reconoce aunque cambie el orden de los argumentos", () => {
  const una = claveLlamadaHerramienta("consultar_tareas_programadas", { vista: "pendientes", tipo: "" });
  const otra = claveLlamadaHerramienta("consultar_tareas_programadas", { tipo: "", vista: "pendientes" });
  const distinta = claveLlamadaHerramienta("consultar_tareas_programadas", { vista: "completadas" });
  assert.equal(una, otra);
  assert.notEqual(una, distinta);
});

test("una comparación exitosa deja afuera los resúmenes del mismo período", () => {
  const lista = { tipoConsulta: "comparar_periodos", datos: { periodo_a: {}, periodo_b: {} } };
  const fallida = { tipoConsulta: "comparar_periodos", error: "Se requiere una sesión autenticada" };
  assert.equal(comparacionAlcanzaParaResponder(lista), true);
  assert.equal(comparacionAlcanzaParaResponder(fallida), false);
  assert.equal(llamadaCubiertaPorComparacion("resumir_actividad_periodo", true), true);
  assert.equal(llamadaCubiertaPorComparacion("consultar_actividad_por_fechas", true), true);
  assert.equal(llamadaCubiertaPorComparacion("buscar_acciones_historicas", true), false);
  assert.equal(llamadaCubiertaPorComparacion("resumir_actividad_periodo", false), false);
});

test("la instrucción distingue hora local, UTC y mediciones sospechosas", () => {
  assert.match(INSTRUCCION_SISTEMA_FLORA_BASE, /America\/Argentina\/Buenos_Aires/);
  assert.match(INSTRUCCION_SISTEMA_FLORA_BASE, /fecha_evento es el instante original en UTC/);
  assert.match(INSTRUCCION_SISTEMA_FLORA_BASE, /lo trates como ausente/i);
});
