import assert from "node:assert/strict";
import test from "node:test";
import {
  agruparHistorial,
  citaFiltro,
  coincideContenido,
  compararEventos,
  diaArgentina,
  etapasVisibles,
  filtrosDesdeConsulta,
  fusionarPaginaHistorial,
  hrefHistorial,
  limitesFechaHistorial,
  ramasDeContenido,
  ramasDeGenetica,
  TAMANO_PAGINA_HISTORIAL,
} from "../lib/historial-registros.js";
import {
  aplicarConservacionEdicion,
  combinarFechaHoraLocal,
  debeConservarPlantas,
  fechaEventoAlEditar,
  ordenarAccionesRegistro,
  plantasDesdeSnapshot,
} from "../lib/registros.js";

const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const ID_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const ID_C = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const PLANTA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const PLANTA_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const UNIDAD = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";

test("el día en Buenos Aires no se corre al día UTC", () => {
  assert.equal(diaArgentina("2026-10-27T01:30:00.000Z"), "2026-10-26");
  assert.equal(diaArgentina("2026-10-26T15:00:00.000Z"), "2026-10-26");
});

test("el rango de una fecha civil usa la medianoche argentina", () => {
  const rango = limitesFechaHistorial("2026-10-26", "2026-10-26");
  assert.equal(rango.desde, "2026-10-26T03:00:00.000Z");
  assert.equal(rango.hasta, "2026-10-27T02:59:59.999Z");
});

test("un filtro de URL inválido no se convierte en una consulta", () => {
  assert.equal(filtrosDesdeConsulta({ unidad: "ajena" }).error, "El filtro de unidad no es válido.");
  assert.equal(filtrosDesdeConsulta({ planta: "no-es-uuid" }).error, "El filtro de planta no es válido.");
  assert.equal(
    filtrosDesdeConsulta({ desde: "2026-10-28", hasta: "2026-10-01" }).error,
    "El período no es válido."
  );
  assert.equal(filtrosDesdeConsulta({ contenido: "fotos" }).error, "El tipo de contenido no es válido.");
});

test("los filtros válidos viajan en la URL y se leen de nuevo", () => {
  const filtros = {
    unidadId: UNIDAD,
    plantaId: PLANTA,
    genetica: "gelato",
    desde: "2026-10-01",
    hasta: "2026-10-26",
    contenidos: ["acciones", "observaciones"],
    sinContenido: false,
    cursor: null,
  };
  const href = hrefHistorial(filtros);
  const consulta = Object.fromEntries(new URL(href, "https://enflora.com.ar").searchParams);
  const leido = filtrosDesdeConsulta(consulta);
  assert.equal(leido.error, "");
  assert.deepEqual(leido.filtros, filtros);
});

test("sin tipo de contenido la consulta no trae registros por accidente", () => {
  const leido = filtrosDesdeConsulta({ contenido: "ninguno" });
  assert.equal(leido.filtros.sinContenido, true);
  assert.deepEqual(leido.filtros.contenidos, []);
});

test("un registro con los tres contenidos entra en cualquiera de esos filtros", () => {
  const registro = {
    registro_acciones: [{ id: "1" }],
    registro_parametros: [{ id: "2" }],
    observacion: "Noté hojas nuevas",
  };
  assert.equal(coincideContenido(registro, ["acciones"]), true);
  assert.equal(coincideContenido(registro, ["parametros"]), true);
  assert.equal(coincideContenido(registro, ["observaciones"]), true);
  assert.equal(coincideContenido({ observacion: "solo texto" }, ["acciones"]), false);
  assert.deepEqual(ramasDeContenido(["parametros", "observaciones"]), ["parametros", "observaciones"]);
  assert.deepEqual(ramasDeContenido(["acciones", "parametros", "observaciones"]), ["todos"]);
  assert.deepEqual(ramasDeGenetica("gelato"), ["clave", "snapshot"]);
});

test("la página fusionada no se saltea un evento más nuevo de otra rama", () => {
  const limite = 2;
  const primera = fusionarPaginaHistorial(
    [
      { filas: [{ id: ID_A, fecha_evento: "2026-10-10T10:00:00.000Z" }, { id: ID_C, fecha_evento: "2026-10-03T10:00:00.000Z" }, { id: "extra", fecha_evento: "2026-10-01T10:00:00.000Z" }], hayMas: true },
      { filas: [{ id: ID_B, fecha_evento: "2026-10-09T10:00:00.000Z" }, { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9", fecha_evento: "2026-10-08T10:00:00.000Z" }], hayMas: false },
    ],
    limite
  );
  assert.deepEqual(primera.registros.map((item) => item.id), [ID_A, ID_B]);
  assert.equal(primera.hayMas, true);

  const segunda = fusionarPaginaHistorial(
    [
      { filas: [{ id: ID_C, fecha_evento: "2026-10-03T10:00:00.000Z" }], hayMas: false },
      { filas: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9", fecha_evento: "2026-10-08T10:00:00.000Z" }], hayMas: false },
    ],
    limite
  );
  assert.deepEqual(segunda.registros.map((item) => item.id), [
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9",
    ID_C,
  ]);
  assert.equal(TAMANO_PAGINA_HISTORIAL, 15);
});

test("el cursor cita los dos puntos de la fecha", () => {
  assert.equal(citaFiltro("2026-10-26T03:00:00.000Z"), '"2026-10-26T03:00:00.000Z"');
});

test("dos registros del mismo día quedan en el mismo grupo y el más nuevo arriba", () => {
  const grupos = agruparHistorial(
    [
      { id: ID_A, fecha_evento: "2026-10-26T18:00:00.000Z" },
      { id: ID_B, fecha_evento: "2026-10-26T22:30:00.000Z" },
      { id: ID_C, fecha_evento: "2026-10-25T15:00:00.000Z" },
    ],
    [{ id: "etapa-1", etapa: "vegetativo", fecha_inicio: "2026-10-26", fecha_fin: null }]
  );
  assert.equal(grupos[0].dia, "2026-10-26");
  assert.deepEqual(
    grupos[0].eventos.map((evento) => evento.tipo),
    ["registro", "registro", "etapa"]
  );
  assert.equal(grupos[1].dia, "2026-10-25");
  assert.ok(compararEventos({ id: ID_B, fecha_evento: "2026-10-26T22:30:00.000Z" }, { id: ID_A, fecha_evento: "2026-10-26T18:00:00.000Z" }) < 0);
});

test("las etapas anteriores al tramo cargado esperan a la página siguiente", () => {
  const etapas = [
    { id: "1", fecha_inicio: "2026-10-26" },
    { id: "2", fecha_inicio: "2026-08-01" },
  ];
  const registros = [{ id: ID_A, fecha_evento: "2026-10-26T18:00:00.000Z" }];
  assert.deepEqual(etapasVisibles(etapas, registros, true).map((item) => item.id), ["1"]);
  assert.deepEqual(etapasVisibles(etapas, registros, false).map((item) => item.id), ["1", "2"]);
});

test("editar el mismo día conserva la hora original", () => {
  const original = combinarFechaHoraLocal("2024-05-10", "15:45");
  assert.equal(
    fechaEventoAlEditar({ fechaSeleccionada: "2024-05-10", fechaOriginalIso: original }),
    new Date(original).toISOString()
  );
  assert.equal(
    fechaEventoAlEditar({ fechaSeleccionada: "2024-05-11", fechaOriginalIso: original }),
    combinarFechaHoraLocal("2024-05-11", "00:00")
  );
});

test("editar sin tocar las plantas conserva el snapshot y el alcance", () => {
  const base = {
    id: ID_A,
    alcance: "unidad",
    aplica_a: "plantas",
    unidad_cultivo_id: UNIDAD,
    espacio_id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
    genetica_clave: null,
    genetica_etiqueta: null,
    registro_plantas: [
      {
        planta_id: PLANTA,
        nombre_planta: "Norte",
        numero_planta: 1,
        genetica_planta: "Gelato",
        unidad_cultivo_id: UNIDAD,
        nombre_unidad: "Carpa 1",
      },
      {
        planta_id: PLANTA_2,
        nombre_planta: "Sur",
        numero_planta: 2,
        genetica_planta: "Gelato",
        unidad_cultivo_id: UNIDAD,
        nombre_unidad: "Carpa 1",
      },
    ],
  };
  const ids = new Set([PLANTA, PLANTA_2]);
  assert.equal(
    debeConservarPlantas({
      base,
      unidadId: UNIDAD,
      aplicaA: "plantas",
      idsSeleccionados: ids,
      idsPlantasUnidad: [PLANTA, PLANTA_2, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3"],
    }),
    true
  );
  const conservado = aplicarConservacionEdicion(
    {
      id: ID_A,
      alcance: "plantas",
      aplica_a: "plantas",
      unidad_cultivo_id: UNIDAD,
      espacio_id: base.espacio_id,
      observacion: "Sigue igual",
      plantas: [{ id: PLANTA, nombre: "Nombre nuevo" }],
    },
    { base, idsSeleccionados: ids, idsPlantasUnidad: [PLANTA, PLANTA_2, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3"] }
  );
  assert.equal(conservado.alcance, "unidad");
  assert.equal(conservado.observacion, "Sigue igual");
  assert.deepEqual(conservado.plantas, plantasDesdeSnapshot(base.registro_plantas));
  assert.equal(conservado.plantas[0].nombre, "Norte");

  const recortado = new Set([PLANTA]);
  assert.equal(
    debeConservarPlantas({
      base,
      unidadId: UNIDAD,
      aplicaA: "plantas",
      idsSeleccionados: recortado,
      idsPlantasUnidad: [PLANTA, PLANTA_2],
    }),
    false
  );
});

test("una acción personalizada histórica sigue disponible al editar", () => {
  const opcion = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
  const orden = ordenarAccionesRegistro([], [], [
    { origen: "personalizada", opcion_id: opcion, nombre: "Defoliación" },
  ]);
  assert.equal(orden.prioritarias.some((item) => item.clave === opcion && item.etiqueta === "Defoliación"), true);
});
