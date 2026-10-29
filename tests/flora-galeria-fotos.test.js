import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluarNivelBeneficiosFlora,
  tandaGaleriaFlora,
  TANDA_GALERIA_GRATUITO,
  TANDA_GALERIA_PLUS,
} from "../lib/flora-beneficios.js";
import {
  compararFotosGaleria,
  cursorDesdeUltimaFoto,
  cadenaFiltroCursorKeysetGaleria,
  indiceDespuesCursorGaleria,
  hayFiltrosActivosGaleria,
  mensajeGaleriaVacia,
  nombrePlantaDesdeRegistro,
  parsearCursorGaleria,
  rangoConfirmadoFechaGaleria,
  rangoFechasGaleriaValido,
} from "../lib/flora-galeria-fotos.js";
import { textoContextoImagenEnflora } from "../lib/flora-imagen-servidor.js";

test("etiqueta de planta desde snapshot registro_plantas (import histórico)", () => {
  const texto = textoContextoImagenEnflora({
    registro: {
      fecha_evento: "2026-01-15",
      unidad_cultivo_id: "550e8400-e29b-41d4-8716-446655440010",
      aplica_a: "plantas",
      unidad: { nombre: "Carpa hidro" },
      registro_plantas: [
        { planta_id: "550e8400-e29b-41d4-8716-446655440011", nombre_planta: "Gorila glue #4" },
        { planta_id: "550e8400-e29b-41d4-8716-446655440012", nombre_planta: "Gorila glue #4" },
      ],
    },
  });
  assert.match(texto, /Carpa hidro/);
  assert.match(texto, /Varias plantas/);
});

test("registro ambiente sin plantas no rompe contexto", () => {
  const texto = textoContextoImagenEnflora({
    registro: {
      fecha_evento: "2026-01-10",
      aplica_a: "ambiente",
      unidad: { nombre: "Carpa hidro" },
      registro_plantas: [],
    },
  });
  assert.match(texto, /ambiente/);
});

test("nombrePlantaDesdeRegistro prioriza snapshot sin join a plantas", () => {
  assert.equal(
    nombrePlantaDesdeRegistro({
      registro_plantas: [{ nombre_planta: "Northern #2" }],
    }),
    "Northern #2",
  );
});

test("rango de fechas rechaza desde posterior a hasta", () => {
  const rango = rangoFechasGaleriaValido("2026-02-01", "2026-01-01");
  assert.equal(rango.ok, false);
});

test("rango confirmado normaliza fechas invertidas", () => {
  assert.deepEqual(rangoConfirmadoFechaGaleria("2026-02-10", "2026-02-01"), {
    desde: "2026-02-01",
    hasta: "2026-02-10",
  });
  assert.deepEqual(rangoConfirmadoFechaGaleria("2026-03-05", ""), {
    desde: "2026-03-05",
    hasta: "2026-03-05",
  });
});

test("cursor keyset cita timestamps ISO para PostgREST", () => {
  const cadena = cadenaFiltroCursorKeysetGaleria({
    fecha_evento: "2026-01-15T03:00:00.000Z",
    id: "550e8400-e29b-41d4-8716-446655440000",
  });
  assert.match(cadena, /registro\.fecha_evento\.lt\."2026-01-15T03:00:00\.000Z"/);
  assert.match(cadena, /id\.lt\."550e8400-e29b-41d4-8716-446655440000"/);
});

test("cursor de galería exige fecha e id válidos", () => {
  assert.equal(parsearCursorGaleria("2026-01-01", "no-es-uuid")?.invalido, true);
  assert.deepEqual(parsearCursorGaleria("2026-01-01T12:00:00.000Z", "550e8400-e29b-41d4-8716-446655440000"), {
    fecha_evento: "2026-01-01T12:00:00.000Z",
    id: "550e8400-e29b-41d4-8716-446655440000",
  });
});

test("indice después del cursor avanza sin saltar ni repetir", () => {
  const filas = [
    { id: "c", registro: { fecha_evento: "2026-09-12T00:00:00.000Z" } },
    { id: "a", registro: { fecha_evento: "2026-09-02T00:00:00.000Z" } },
    { id: "b", registro: { fecha_evento: "2026-08-26T00:00:00.000Z" } },
  ].sort(compararFotosGaleria);
  assert.equal(indiceDespuesCursorGaleria(filas, null), 0);
  assert.equal(indiceDespuesCursorGaleria(filas, { fecha_evento: "2026-09-02T00:00:00.000Z", id: "a" }), 2);
  assert.equal(indiceDespuesCursorGaleria(filas, { fecha_evento: "2026-08-26T00:00:00.000Z", id: "b" }), 3);
});

test("orden de galería usa fecha del registro anidado (filas Supabase)", () => {
  const ordenado = [
    { id: "a", registro: { fecha_evento: "2026-09-02T12:00:00.000Z" } },
    { id: "b", registro: { fecha_evento: "2026-08-26T12:00:00.000Z" } },
    { id: "c", registro: { fecha_evento: "2026-09-12T12:00:00.000Z" } },
  ].sort(compararFotosGaleria);
  assert.deepEqual(
    ordenado.map((f) => f.id),
    ["c", "a", "b"],
  );
});

test("orden de galería es fecha descendente y desempate por id", () => {
  const ordenado = [
    { id: "b", fecha_evento: "2026-01-02" },
    { id: "a", fecha_evento: "2026-01-02" },
    { id: "c", fecha_evento: "2026-01-01" },
  ].sort(compararFotosGaleria);
  assert.deepEqual(
    ordenado.map((f) => f.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(cursorDesdeUltimaFoto(ordenado), { fecha_evento: "2026-01-01", id: "c" });
});

test("beneficios: gratuito 12 fotos, plus o licencia 36", () => {
  assert.equal(tandaGaleriaFlora("gratuito"), TANDA_GALERIA_GRATUITO);
  assert.equal(tandaGaleriaFlora("plus"), TANDA_GALERIA_PLUS);
  assert.equal(evaluarNivelBeneficiosFlora({ plusActivo: false, licenciaEnUnidad: false }), "gratuito");
  assert.equal(evaluarNivelBeneficiosFlora({ plusActivo: true, licenciaEnUnidad: false }), "plus");
  assert.equal(evaluarNivelBeneficiosFlora({ plusActivo: false, licenciaEnUnidad: true }), "plus");
});

test("mensajes distinguen error, filtros vacíos y cuenta sin fotos", () => {
  assert.match(mensajeGaleriaVacia({ sinFotosEnCuenta: true }), /registros/);
  assert.match(mensajeGaleriaVacia({ sinCoincidencias: true }), /filtros/);
  assert.equal(mensajeGaleriaVacia({ errorCarga: true }), "");
  assert.equal(hayFiltrosActivosGaleria({ busqueda: "carpa" }), true);
});
