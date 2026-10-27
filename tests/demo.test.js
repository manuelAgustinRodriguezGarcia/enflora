import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ETAPA_INICIAL_DEMO,
  GENETICAS_DEMO,
  generarCultivo,
  textoUnidadesDemo,
  validarConfiguracion,
} from "../lib/demo/generar-cultivo.js";
import {
  CLAVE_DEMO,
  crearEstadoDemo,
  normalizarEstadoDemo,
  pasosGuia,
  puedeRegistrar,
  reducirDemo,
  siguienteSecuencia,
} from "../lib/demo/estado-demo.js";
import {
  aplicarCambioEtapa,
  historialCoherente,
  validarCambioEtapa,
} from "../lib/demo/etapas-demo.js";
import {
  LIMITE_REGISTROS_DEMO,
  construirRegistroDemo,
  idRegistroDemo,
  leerRegistroFormulario,
  prepararRegistroDemo,
  registroDemoValido,
  registrosDeUnidad,
  registrosDePlanta,
  registrosDelDia,
  seguimientoDemo,
  unidadesParaRegistro,
} from "../lib/demo/registros-demo.js";
import { esEtapa } from "../lib/etapas.js";
import { partesFechaLocal, prepararPlantasRegistro } from "../lib/registros.js";
import { esMetodoBase } from "../lib/metodos.js";
import { tipoUnidadPermitido } from "../lib/unidades.js";

const FECHA = "2026-10-23";

function generar(parcial = {}, secuencia = 1) {
  return generarCultivo(
    { nombre: "Mi primer cultivo", tipo: "interior", cantidadUnidades: 1, plantasPorUnidad: 1, ...parcial },
    { secuencia, fecha: FECHA }
  );
}

test("genera un espacio interior con carpas y plantas coherentes", () => {
  const { cultivo } = generar({ cantidadUnidades: 3, plantasPorUnidad: 4 });
  assert.equal(cultivo.espacio.tipo, "interior");
  assert.deepEqual(
    cultivo.unidades.map((unidad) => unidad.nombre),
    ["Carpa 1", "Carpa 2", "Carpa 3"]
  );
  assert.equal(cultivo.plantas.length, 12);
  for (const unidad of cultivo.unidades) {
    assert.equal(unidad.espacio_id, cultivo.espacio.id);
    assert.ok(tipoUnidadPermitido("interior", unidad.tipo));
  }
  const ids = new Set(cultivo.unidades.map((unidad) => unidad.id));
  for (const planta of cultivo.plantas) {
    assert.ok(ids.has(planta.unidad_cultivo_id));
    assert.ok(esEtapa(planta.etapa));
    assert.ok(esMetodoBase(planta.metodo));
    assert.ok(GENETICAS_DEMO.includes(planta.genetica));
    assert.equal(planta.fecha_inicio, FECHA);
    assert.equal(planta.estado, "activa");
    assert.deepEqual(planta.historial, [{ etapa: ETAPA_INICIAL_DEMO, fecha_inicio: FECHA, fecha_fin: null }]);
  }
});

test("genera un espacio exterior con unidades válidas", () => {
  const { cultivo } = generar({ tipo: "exterior", cantidadUnidades: 2, plantasPorUnidad: 2 });
  assert.deepEqual(
    cultivo.unidades.map((unidad) => unidad.nombre),
    ["Invernadero 1", "Invernadero 2"]
  );
  assert.ok(cultivo.unidades.every((unidad) => tipoUnidadPermitido("exterior", unidad.tipo)));
});

test("respeta el tipo de unidad elegido y el nombre personalizado", () => {
  const sala = generar({ tipoUnidad: "sala", plantasPorUnidad: 3 }).cultivo;
  assert.deepEqual(sala.unidades.map((unidad) => [unidad.nombre, unidad.tipo, unidad.tipo_personalizado]), [
    ["Sala", "sala", null],
  ]);
  const armarios = generar({ tipoUnidad: "otro", tipoPersonalizado: "  Armario ", cantidadUnidades: 2 }).cultivo;
  assert.deepEqual(
    armarios.unidades.map((unidad) => [unidad.nombre, unidad.tipo, unidad.tipo_personalizado]),
    [
      ["Armario 1", "otro", "Armario"],
      ["Armario 2", "otro", "Armario"],
    ]
  );
  const aire = generar({ tipo: "exterior", tipoUnidad: "aire_libre" }).cultivo;
  assert.equal(aire.unidades[0].nombre, "Aire libre");
  assert.equal(textoUnidadesDemo("interior", 2, "otro", "Armario"), "2 armarios");
  assert.equal(textoUnidadesDemo("interior", 1, "sala"), "1 sala de cultivo");
  assert.equal(textoUnidadesDemo("exterior", 3), "3 invernaderos");
});

test("rechaza tipos de unidad incoherentes", () => {
  const base = { nombre: "Ok", tipo: "interior", cantidadUnidades: 1, plantasPorUnidad: 1 };
  assert.ok(validarConfiguracion({ ...base, tipoUnidad: "invernadero" }).errores.tipoUnidad);
  assert.ok(validarConfiguracion({ ...base, tipoUnidad: "otro", tipoPersonalizado: "  " }).errores.tipoUnidad);
  assert.ok(validarConfiguracion({ ...base, tipoUnidad: "otro", tipoPersonalizado: "a".repeat(25) }).errores.tipoUnidad);
  assert.ok(validarConfiguracion({ ...base, tipoUnidad: "sala", cantidadUnidades: 2 }).errores.cantidadUnidades);
  assert.ok(
    validarConfiguracion({ ...base, tipo: "exterior", tipoUnidad: "aire_libre", cantidadUnidades: 2 }).errores
      .cantidadUnidades
  );
  assert.equal(validarConfiguracion({ ...base, tipoUnidad: "carpa", tipoPersonalizado: "x" }).datos.tipoPersonalizado, "");
});

test("los ids son únicos, estables y no parecen uuid", () => {
  const primero = generar({ cantidadUnidades: 3, plantasPorUnidad: 4 }).cultivo;
  const segundo = generar({ cantidadUnidades: 3, plantasPorUnidad: 4 }).cultivo;
  const ids = [primero.espacio, ...primero.unidades, ...primero.plantas].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(primero, segundo);
  assert.ok(ids.every((id) => id.startsWith("demo-") && !/^[0-9a-f-]{36}$/.test(id)));
});

test("no genera mediciones ni registros", () => {
  const { cultivo } = generar();
  assert.deepEqual(Object.keys(cultivo).sort(), ["espacio", "plantas", "unidades"]);
});

test("valida el nombre", () => {
  assert.ok(validarConfiguracion({ nombre: "   ", tipo: "interior", cantidadUnidades: 1, plantasPorUnidad: 1 }).errores.nombre);
  assert.ok(validarConfiguracion({ nombre: "a".repeat(41), tipo: "interior", cantidadUnidades: 1, plantasPorUnidad: 1 }).errores.nombre);
  assert.ok(validarConfiguracion({ nombre: "<b>hola</b>", tipo: "interior", cantidadUnidades: 1, plantasPorUnidad: 1 }).errores.nombre);
  assert.equal(
    validarConfiguracion({ nombre: "  Mi   carpa ", tipo: "interior", cantidadUnidades: 1, plantasPorUnidad: 1 }).datos.nombre,
    "Mi carpa"
  );
});

test("rechaza tipos y cantidades fuera de rango", () => {
  const base = { nombre: "Ok", tipo: "interior", cantidadUnidades: 1, plantasPorUnidad: 1 };
  assert.ok(validarConfiguracion({ ...base, tipo: "" }).errores.tipo);
  assert.ok(validarConfiguracion({ ...base, cantidadUnidades: 4 }).errores.cantidadUnidades);
  assert.ok(validarConfiguracion({ ...base, plantasPorUnidad: 0 }).errores.plantasPorUnidad);
  assert.ok(validarConfiguracion({ ...base, plantasPorUnidad: 10 }).errores.plantasPorUnidad);
  assert.ok(!validarConfiguracion({ ...base, cantidadUnidades: 3, plantasPorUnidad: 9 }).errores);
  assert.ok(generarCultivo(base, { secuencia: 1, fecha: "ayer" }).errores);
});

test("agrega cultivos sin pisar los anteriores y evita duplicados", () => {
  let estado = reducirDemo(crearEstadoDemo(), { type: "COMENZAR" });
  assert.equal(estado.fase, "crear");
  const primero = generar({}, siguienteSecuencia(estado)).cultivo;
  estado = reducirDemo(estado, { type: "AGREGAR_CULTIVO", cultivo: primero });
  assert.equal(estado.fase, "espacio");
  assert.equal(estado.modulo, "cultivos");
  assert.deepEqual(estado.aviso, { tipo: "espacio-creado", espacioId: primero.espacio.id });
  assert.equal(estado.navegacion.espacioId, primero.espacio.id);
  const repetido = reducirDemo(estado, { type: "AGREGAR_CULTIVO", cultivo: primero });
  assert.equal(repetido, estado);
  const segundo = generar({ nombre: "Otro" }, siguienteSecuencia(estado)).cultivo;
  estado = reducirDemo(estado, { type: "AGREGAR_CULTIVO", cultivo: segundo });
  assert.equal(estado.espacios.length, 2);
  assert.equal(estado.plantas.length, 2);
  const tercero = generar({ nombre: "Tercero" }, siguienteSecuencia(estado)).cultivo;
  estado = reducirDemo(estado, { type: "AGREGAR_CULTIVO", cultivo: tercero });
  const cuarto = generar({ nombre: "Cuarto" }, siguienteSecuencia(estado)).cultivo;
  assert.equal(reducirDemo(estado, { type: "AGREGAR_CULTIVO", cultivo: cuarto }).espacios.length, 3);
  assert.equal(reducirDemo(estado, { type: "IR", fase: "crear" }).fase, "cultivos");
});

test("normaliza estados de la iteración anterior y datos huérfanos", () => {
  const anterior = { ...crearEstadoDemo(), fase: "preparada", modulo: "inicio" };
  assert.equal(normalizarEstadoDemo(anterior).fase, "crear");
  const { cultivo } = generar();
  const guardado = {
    ...crearEstadoDemo(),
    fase: "espacio",
    navegacion: { espacioId: cultivo.espacio.id, unidadId: "", plantaId: "", registro: null },
    espacios: [cultivo.espacio],
    unidades: [...cultivo.unidades, { id: "x", nombre: "X", espacio_id: "nadie" }],
    plantas: [...cultivo.plantas, { id: "y", nombre: "Y", etapa: "germinacion", unidad_cultivo_id: "x" }],
  };
  const normal = normalizarEstadoDemo(JSON.parse(JSON.stringify(guardado)));
  assert.equal(normal.unidades.length, 1);
  assert.equal(normal.plantas.length, 1);
  assert.equal(normal.navegacion.espacioId, cultivo.espacio.id);
  assert.equal(normal.fase, "espacio");
  assert.equal(normalizarEstadoDemo({ ...guardado, espacios: [] }).fase, "crear");
  assert.equal(normalizarEstadoDemo({ version: 2 }), null);
  assert.equal(normalizarEstadoDemo("texto"), null);
});

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOY = partesFechaLocal().fecha;
const RIEGO = { origen: "nativa", clave_nativa: "riego", nombre: "Riego" };
let secuenciaRegistro = 0;

function leer(relativa) {
  return readFileSync(path.join(RAIZ, relativa), "utf8");
}

function estadoConCultivo(parcial = {}, estadoBase = reducirDemo(crearEstadoDemo(), { type: "COMENZAR" })) {
  const { cultivo } = generarCultivo(
    { nombre: "Mi carpa", tipo: "interior", cantidadUnidades: 2, plantasPorUnidad: 4, ...parcial },
    { secuencia: siguienteSecuencia(estadoBase), fecha: HOY }
  );
  return reducirDemo(estadoBase, { type: "AGREGAR_CULTIVO", cultivo });
}

function plantasDe(estado, unidad) {
  return estado.plantas.filter((planta) => planta.unidad_cultivo_id === unidad.id);
}

function entradaRegistro(estado, parcial = {}) {
  const unidad = estado.unidades[0];
  return {
    alcance: "unidad",
    aplica_a: "plantas",
    espacio_id: unidad.espacio_id,
    unidad_cultivo_id: unidad.id,
    genetica_clave: null,
    genetica_etiqueta: null,
    observacion: null,
    fecha_evento: new Date().toISOString(),
    plantas: prepararPlantasRegistro(plantasDe(estado, unidad), unidad),
    acciones: [RIEGO],
    parametros: [],
    ...parcial,
  };
}

function guardar(estado, entrada) {
  const preparado = prepararRegistroDemo(entrada, estado);
  assert.equal(preparado.error, undefined, preparado.error);
  secuenciaRegistro += 1;
  const registro = construirRegistroDemo(preparado.datos, {
    id: idRegistroDemo(Date.now(), secuenciaRegistro),
    ahora: new Date().toISOString(),
  });
  const siguiente = reducirDemo(estado, { type: "AGREGAR_REGISTRO", registro });
  assert.notEqual(siguiente, estado);
  return siguiente;
}

test("navega espacio, unidad y planta y vuelve con atrás", () => {
  let estado = estadoConCultivo();
  const unidad = estado.unidades[1];
  const planta = plantasDe(estado, unidad)[2];
  estado = reducirDemo(estado, { type: "IR", fase: "cultivos" });
  assert.deepEqual([estado.fase, estado.modulo, estado.aviso], ["cultivos", "cultivos", null]);
  estado = reducirDemo(estado, { type: "VER_ESPACIO", espacioId: unidad.espacio_id });
  assert.equal(estado.fase, "espacio");
  estado = reducirDemo(estado, { type: "VER_UNIDAD", unidadId: unidad.id });
  assert.deepEqual([estado.fase, estado.navegacion.unidadId], ["unidad", unidad.id]);
  estado = reducirDemo(estado, { type: "VER_PLANTA", plantaId: planta.id });
  assert.deepEqual([estado.fase, estado.modulo, estado.navegacion.plantaId], ["planta", "cultivos", planta.id]);
  estado = reducirDemo(estado, { type: "ATRAS" });
  assert.deepEqual([estado.fase, estado.navegacion.plantaId], ["unidad", ""]);
  estado = reducirDemo(estado, { type: "ATRAS" });
  assert.equal(estado.fase, "espacio");
  estado = reducirDemo(estado, { type: "ATRAS" });
  assert.equal(estado.fase, "cultivos");
  assert.equal(reducirDemo(estado, { type: "VER_PLANTA", plantaId: "demo-nadie" }), estado);
  assert.equal(reducirDemo(estado, { type: "VER_UNIDAD", unidadId: "demo-nadie" }), estado);
  assert.equal(reducirDemo(estado, { type: "IR", fase: "planta" }), estado);
});

test("los módulos de la navegación inferior llevan a pantallas seguras", () => {
  const vacio = reducirDemo(crearEstadoDemo(), { type: "IR", fase: "cultivos" });
  assert.equal(vacio.fase, "crear");
  const registros = reducirDemo(vacio, { type: "IR", fase: "registros" });
  assert.deepEqual([registros.fase, registros.modulo], ["registros", "registros"]);
  const historial = reducirDemo(registros, { type: "IR", fase: "historial" });
  assert.deepEqual([historial.fase, historial.modulo], ["historial", "historial"]);
  const conDatos = reducirDemo(estadoConCultivo(), { type: "IR", fase: "cultivos" });
  assert.equal(conDatos.fase, "cultivos");
});

test("al recargar recupera el contexto válido o cae a una pantalla segura", () => {
  let estado = estadoConCultivo();
  estado = estadoConCultivo({ nombre: "Patio", tipo: "exterior", cantidadUnidades: 1 }, estado);
  const planta = estado.plantas[5];
  estado = reducirDemo(estado, { type: "VER_PLANTA", plantaId: planta.id });
  const json = JSON.parse(JSON.stringify(estado));
  const recargado = normalizarEstadoDemo(json);
  assert.deepEqual([recargado.fase, recargado.navegacion.plantaId], ["planta", planta.id]);
  const sinPlanta = normalizarEstadoDemo({ ...json, plantas: json.plantas.filter((item) => item.id !== planta.id) });
  assert.deepEqual([sinPlanta.fase, sinPlanta.navegacion.unidadId], ["unidad", planta.unidad_cultivo_id]);
  const sinUnidad = normalizarEstadoDemo({ ...json, navegacion: { ...json.navegacion, unidadId: "x", plantaId: "y" } });
  assert.equal(sinUnidad.fase, "espacio");
  const otraUnidad = json.unidades.find((item) => item.espacio_id !== json.navegacion.espacioId);
  const cruzado = normalizarEstadoDemo({
    ...json,
    fase: "unidad",
    navegacion: { ...json.navegacion, unidadId: otraUnidad.id, plantaId: "" },
  });
  assert.deepEqual([cruzado.fase, cruzado.navegacion.unidadId], ["espacio", ""]);
  const sinEspacio = normalizarEstadoDemo({ ...json, navegacion: { espacioId: "x", unidadId: "", plantaId: "" } });
  assert.equal(sinEspacio.fase, "cultivos");
  assert.equal(normalizarEstadoDemo({ ...json, fase: "inventada" }).fase, "bienvenida");
  assert.equal(CLAVE_DEMO, "enflora-demo-v1");
});

test("cambia la etapa localmente, cierra la anterior y persiste", () => {
  let estado = estadoConCultivo();
  const planta = estado.plantas[0];
  assert.equal(validarCambioEtapa(planta, "germinacion", HOY, HOY), "La planta ya está en esa etapa.");
  assert.equal(validarCambioEtapa(planta, "inventada", HOY, HOY), "Seleccioná una etapa.");
  assert.equal(
    validarCambioEtapa(planta, "vegetativo", "2000-01-01", HOY),
    "La fecha no puede ser anterior al inicio de la etapa actual."
  );
  assert.equal(validarCambioEtapa(planta, "vegetativo", "2999-01-01", HOY), "La fecha no puede ser posterior a hoy.");
  assert.equal(validarCambioEtapa(planta, "vegetativo", "2026-02-30", HOY), "La fecha de inicio no es válida.");
  assert.equal(
    reducirDemo(estado, { type: "CAMBIAR_ETAPA", plantaId: planta.id, etapa: "germinacion", fecha: HOY, hoy: HOY }),
    estado
  );
  estado = reducirDemo(estado, { type: "CAMBIAR_ETAPA", plantaId: planta.id, etapa: "vegetativo", fecha: HOY, hoy: HOY });
  const cambiada = estado.plantas.find((item) => item.id === planta.id);
  assert.equal(cambiada.etapa, "vegetativo");
  assert.deepEqual(cambiada.historial, [
    { etapa: "germinacion", fecha_inicio: HOY, fecha_fin: HOY },
    { etapa: "vegetativo", fecha_inicio: HOY, fecha_fin: null },
  ]);
  assert.ok(historialCoherente(cambiada));
  assert.equal(estado.plantas.filter((item) => item.etapa === "vegetativo").length, 1);
  estado = reducirDemo(estado, { type: "CAMBIAR_ETAPA", plantaId: planta.id, etapa: "finalizado", fecha: HOY, hoy: HOY });
  const final = estado.plantas.find((item) => item.id === planta.id);
  assert.equal(final.estado, "finalizada");
  const recargado = normalizarEstadoDemo(JSON.parse(JSON.stringify(estado)));
  assert.deepEqual(recargado.plantas.find((item) => item.id === planta.id).historial, final.historial);
});

test("reconstruye historiales de etapa corruptos y aplica cierres coherentes", () => {
  const json = JSON.parse(JSON.stringify(estadoConCultivo()));
  json.plantas[0].etapa = "enflora";
  json.plantas[0].historial = [{ etapa: "germinacion", fecha_inicio: "x", fecha_fin: null }];
  json.plantas[1].etapa = "etapa-inventada";
  const normal = normalizarEstadoDemo(json);
  assert.ok(historialCoherente(normal.plantas[0]));
  assert.equal(normal.plantas[0].historial.at(-1).etapa, "enflora");
  assert.equal(normal.plantas.length, json.plantas.length - 1);
  const aplicado = aplicarCambioEtapa(
    { etapa: "plantula", historial: [{ etapa: "plantula", fecha_inicio: "2026-01-01", fecha_fin: null }] },
    "vegetativo",
    "2026-01-10"
  );
  assert.deepEqual(
    aplicado.historial.map((fila) => fila.fecha_fin),
    ["2026-01-10", null]
  );
});

test("registra toda la unidad, una genética, varias plantas o una sola", () => {
  const estado = estadoConCultivo();
  const unidad = estado.unidades[0];
  const plantas = plantasDe(estado, unidad);
  const todas = prepararRegistroDemo(entradaRegistro(estado), estado);
  assert.deepEqual([todas.datos.alcance, todas.datos.plantas.length], ["unidad", 4]);
  const grupo = plantas.filter((planta) => planta.genetica === plantas[0].genetica);
  assert.equal(grupo.length, 2);
  const genetica = prepararRegistroDemo(
    entradaRegistro(estado, { alcance: "genetica", plantas: prepararPlantasRegistro(grupo, unidad) }),
    estado
  );
  assert.deepEqual([genetica.datos.alcance, genetica.datos.genetica_etiqueta], ["genetica", grupo[0].genetica]);
  const varias = prepararRegistroDemo(
    entradaRegistro(estado, { alcance: "plantas", plantas: prepararPlantasRegistro([plantas[0], plantas[2]], unidad) }),
    estado
  );
  assert.equal(varias.datos.alcance, "plantas");
  const una = prepararRegistroDemo(
    entradaRegistro(estado, { alcance: "planta", plantas: prepararPlantasRegistro([plantas[3]], unidad) }),
    estado
  );
  assert.deepEqual([una.datos.alcance, una.datos.plantas[0].id], ["planta", plantas[3].id]);
});

test("rechaza registros sin plantas, cruzados o con datos fuera del catálogo", () => {
  const estado = estadoConCultivo();
  const otra = estado.unidades[1];
  const ajena = prepararPlantasRegistro(plantasDe(estado, otra).slice(0, 1), otra);
  const casos = [
    { plantas: [] },
    { alcance: "planta", plantas: ajena },
    { unidad_cultivo_id: "demo-inexistente" },
    { espacio_id: "demo-espacio-99" },
    { alcance: "plantas" },
    { alcance: "espacio" },
    { acciones: [{ origen: "nativa", clave_nativa: "cosecha" }] },
    { acciones: [{ origen: "personalizada", opcion_id: "x", nombre: "Mía" }] },
    { acciones: [RIEGO, RIEGO] },
    { acciones: [], parametros: [{ origen: "nativa", clave_nativa: "ph", tipo_valor: "numero", valor_numero: "abc" }] },
    { acciones: [], parametros: [{ origen: "nativa", clave_nativa: "co2", tipo_valor: "numero", valor_numero: 1 }] },
    { acciones: [] },
    { fecha_evento: "ayer" },
    { observacion: "a".repeat(4001) },
    { id: "demo-registro-inexistente" },
  ];
  for (const parcial of casos) {
    assert.ok(prepararRegistroDemo(entradaRegistro(estado, parcial), estado).error, JSON.stringify(parcial).slice(0, 80));
  }
  assert.equal(
    prepararRegistroDemo(entradaRegistro(estado, { acciones: [{ origen: "nativa", clave_nativa: "foto" }] }), estado).error,
    "Las fotos están disponibles en la aplicación completa."
  );
  assert.equal(prepararRegistroDemo(null, estado).error, "No se pudo leer el registro.");
});

test("registra ambiente sin plantas ni acciones", () => {
  const estado = estadoConCultivo();
  const ambiente = entradaRegistro(estado, {
    aplica_a: "ambiente",
    plantas: [],
    acciones: [],
    parametros: [
      { origen: "nativa", clave_nativa: "temperatura", tipo_valor: "numero", valor_numero: 24.5 },
      { origen: "nativa", clave_nativa: "humedad", tipo_valor: "numero", valor_numero: "60" },
    ],
  });
  const preparado = prepararRegistroDemo(ambiente, estado);
  assert.deepEqual([preparado.datos.alcance, preparado.datos.plantas.length], ["unidad", 0]);
  assert.deepEqual(
    preparado.datos.parametros.map((fila) => [fila.valor_numero, fila.unidad]),
    [[24.5, "°C"], [60, "%"]]
  );
  assert.ok(prepararRegistroDemo({ ...ambiente, acciones: [RIEGO] }, estado).error);
  assert.ok(prepararRegistroDemo({ ...ambiente, plantas: entradaRegistro(estado).plantas }, estado).error);
});

test("guarda, separa fecha del evento y de carga, y edita sin duplicar", () => {
  let estado = estadoConCultivo();
  estado = guardar(estado, entradaRegistro(estado));
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(0, 0, 0, 0);
  estado = guardar(estado, entradaRegistro(estado, { fecha_evento: ayer.toISOString(), observacion: "Ayer regué" }));
  assert.equal(estado.registros.length, 2);
  const deHoy = registrosDelDia(estado.registros);
  assert.equal(deHoy.length, 1);
  assert.notEqual(deHoy[0].observacion, "Ayer regué");
  const registro = estado.registros[0];
  assert.ok(registro.id.startsWith("demo-registro-"));
  assert.ok(!/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(registro.id));
  assert.equal(registro.fecha_actualizacion, null);
  assert.equal(reducirDemo(estado, { type: "AGREGAR_REGISTRO", registro }), estado);
  const preparado = prepararRegistroDemo(entradaRegistro(estado, { id: registro.id, observacion: "Corregido" }), estado);
  const editado = construirRegistroDemo(preparado.datos, {
    id: registro.id,
    ahora: "2099-01-01T00:00:00.000Z",
    anterior: registro,
  });
  const tras = reducirDemo(estado, { type: "EDITAR_REGISTRO", registro: editado });
  assert.equal(tras.registros.length, 2);
  const fila = tras.registros.find((item) => item.id === registro.id);
  assert.deepEqual(
    [fila.observacion, fila.fecha_creacion, fila.fecha_actualizacion],
    ["Corregido", registro.fecha_creacion, "2099-01-01T00:00:00.000Z"]
  );
  assert.equal(registrosDePlanta(tras.registros, estado.plantas[0].id).length, 2);
  assert.equal(registrosDeUnidad(tras.registros, estado.unidades[1].id).length, 0);
  const recargado = normalizarEstadoDemo(JSON.parse(JSON.stringify(tras)));
  assert.equal(recargado.registros.length, 2);
  assert.ok(recargado.registros.every((item) => registroDemoValido(item, recargado)));
});

test("respeta el límite de registros sin descartar los anteriores", () => {
  let estado = estadoConCultivo();
  for (let indice = 0; indice < LIMITE_REGISTROS_DEMO; indice += 1) {
    estado = guardar(estado, entradaRegistro(estado, { acciones: [], observacion: `Nota ${indice}` }));
  }
  assert.equal(estado.registros.length, LIMITE_REGISTROS_DEMO);
  assert.equal(puedeRegistrar(estado), false);
  const preparado = prepararRegistroDemo(entradaRegistro(estado), estado);
  const extra = construirRegistroDemo(preparado.datos, {
    id: idRegistroDemo(Date.now(), 99999),
    ahora: new Date().toISOString(),
  });
  assert.equal(reducirDemo(estado, { type: "AGREGAR_REGISTRO", registro: extra }), estado);
  assert.equal(estado.registros[0].observacion, "Nota 0");
});

test("descarta registros huérfanos, duplicados o manipulados al recargar", () => {
  let estado = estadoConCultivo();
  estado = guardar(estado, entradaRegistro(estado));
  const json = JSON.parse(JSON.stringify(estado));
  const base = json.registros[0];
  json.registros.push({ ...base, id: "demo-registro-x-1", unidad_cultivo_id: "nadie" });
  json.registros.push({ ...base, id: "11111111-1111-1111-1111-111111111111" });
  json.registros.push({ ...base, id: "demo-registro-x-2", registro_acciones: [{ origen: "nativa", clave_nativa: "cosecha" }] });
  json.registros.push({ ...base });
  assert.equal(normalizarEstadoDemo(json).registros.length, 1);
});

test("prepara unidades con su espacio y lee el formulario local", () => {
  let estado = estadoConCultivo();
  estado = estadoConCultivo({ nombre: "Patio", tipo: "exterior", cantidadUnidades: 2, plantasPorUnidad: 1 }, estado);
  const unidades = unidadesParaRegistro(estado);
  assert.equal(unidades.length, 4);
  assert.deepEqual(
    unidades.map((unidad) => `${unidad.espacio_nombre} · ${unidad.nombre} · ${unidad.plantas.length}`),
    ["Mi carpa · Carpa 1 · 4", "Mi carpa · Carpa 2 · 4", "Patio · Invernadero 1 · 1", "Patio · Invernadero 2 · 1"]
  );
  const formulario = new FormData();
  formulario.set("registro", JSON.stringify({ alcance: "unidad" }));
  assert.deepEqual(leerRegistroFormulario(formulario), { alcance: "unidad" });
  formulario.set("registro", "{roto");
  assert.equal(leerRegistroFormulario(formulario), null);
  const seguimiento = seguimientoDemo();
  assert.equal(seguimiento.tipo, "profesional");
  assert.deepEqual(seguimiento.opciones, []);
  assert.ok(seguimiento.parametros.includes("ph"));
});

test("registrar desde una planta o unidad preselecciona y vuelve al origen", () => {
  let estado = estadoConCultivo();
  const planta = estado.plantas[6];
  estado = reducirDemo(estado, { type: "VER_PLANTA", plantaId: planta.id });
  estado = reducirDemo(estado, {
    type: "REGISTRAR_DESDE",
    unidadId: planta.unidad_cultivo_id,
    tipo: "plantas",
    plantaIds: [planta.id, "demo-intrusa"],
  });
  assert.deepEqual([estado.fase, estado.modulo], ["registros", "registros"]);
  assert.deepEqual(estado.navegacion.registro.plantaIds, [planta.id]);
  assert.equal(estado.navegacion.registro.origen.fase, "planta");
  const recargado = normalizarEstadoDemo(JSON.parse(JSON.stringify(estado)));
  assert.deepEqual(recargado.navegacion.registro, estado.navegacion.registro);
  estado = reducirDemo(estado, { type: "ATRAS" });
  assert.deepEqual([estado.fase, estado.navegacion.plantaId, estado.navegacion.registro], ["planta", planta.id, null]);
  estado = reducirDemo(estado, { type: "VER_UNIDAD", unidadId: planta.unidad_cultivo_id });
  estado = reducirDemo(estado, {
    type: "REGISTRAR_DESDE",
    unidadId: planta.unidad_cultivo_id,
    plantaIds: [planta.id],
  });
  assert.deepEqual(estado.navegacion.registro.plantaIds, [planta.id]);
  assert.equal(estado.navegacion.registro.origen.fase, "unidad");
  assert.equal(reducirDemo(estado, { type: "IR", fase: "registros" }).navegacion.registro, null);
  assert.equal(reducirDemo(estado, { type: "REGISTRAR_DESDE", unidadId: "nadie", tipo: "plantas" }), estado);
  assert.equal(reducirDemo(estado, { type: "ATRAS" }).fase, "unidad");
});

test("la guía marca los pasos solo cuando se completan", () => {
  assert.deepEqual(pasosGuia(crearEstadoDemo()).map((paso) => paso.hecho), [false, false, false]);
  let estado = estadoConCultivo();
  estado = reducirDemo(estado, { type: "VER_PLANTA", plantaId: estado.plantas[0].id });
  assert.deepEqual(pasosGuia(estado).map((paso) => paso.hecho), [true, false, false]);
  estado = reducirDemo(estado, { type: "IR", fase: "registros" });
  assert.deepEqual(pasosGuia(estado).map((paso) => paso.hecho), [true, false, false]);
  estado = guardar(estado, entradaRegistro(estado));
  assert.deepEqual(pasosGuia(estado).map((paso) => paso.hecho), [true, false, true]);
  estado = reducirDemo(estado, { type: "CAMBIAR_ETAPA", plantaId: estado.plantas[0].id, etapa: "plantula", fecha: HOY, hoy: HOY });
  assert.deepEqual(pasosGuia(estado).map((paso) => paso.hecho), [true, true, true]);
  estado = reducirDemo(reducirDemo(estado, { type: "OCULTAR_GUIA" }), { type: "DESCARTAR_CONVERSION" });
  const recargado = normalizarEstadoDemo(JSON.parse(JSON.stringify(estado)));
  assert.deepEqual([recargado.guia.oculta, recargado.conversion.descartada], [true, true]);
  assert.deepEqual(reducirDemo(estado, { type: "REINICIAR" }), crearEstadoDemo());
});

function resolverImport(desde, especificador) {
  let base;
  if (especificador.startsWith("@/")) base = path.join(RAIZ, especificador.slice(2));
  else if (especificador.startsWith(".")) base = path.resolve(path.dirname(desde), especificador);
  else return null;
  for (const candidato of [`${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, "index.js"), base]) {
    if (existsSync(candidato) && /\.(m?js|jsx)$/.test(candidato)) return candidato;
  }
  return undefined;
}

function grafoImportaciones(entradas) {
  const visitados = new Set();
  const externos = new Set();
  const pendientes = entradas.map((entrada) => path.join(RAIZ, entrada));
  const patron = /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;
  while (pendientes.length) {
    const archivo = pendientes.pop();
    if (visitados.has(archivo)) continue;
    visitados.add(archivo);
    const fuente = readFileSync(archivo, "utf8");
    for (const coincidencia of fuente.matchAll(patron)) {
      const especificador = coincidencia[1] || coincidencia[2] || coincidencia[3];
      const resuelto = resolverImport(archivo, especificador);
      if (resuelto === null) externos.add(especificador);
      else if (resuelto) pendientes.push(resuelto);
      else assert.fail(`No se pudo resolver ${especificador} desde ${archivo}`);
    }
  }
  return {
    archivos: [...visitados].map((archivo) => path.relative(RAIZ, archivo).split(path.sep).join("/")),
    externos: [...externos],
  };
}

test("la demo no puede alcanzar Server Actions, Supabase ni componentes con persistencia real", () => {
  const { archivos, externos } = grafoImportaciones(["app/demo/page.js", "app/demo/layout.js"]);
  const prohibidos = [
    /^app\/.*acciones\.js$/,
    /^lib\/supabase\//,
    /^lib\/push\//,
    /^componentes\/(editor-seguimiento|cambiar-etapa|etapa-progreso|seleccion-plantas-unidad|cabecera-unidad|formulario-crear-registro|formulario-unidad|formulario-planta|panel-agregar-planta|eliminar-[a-z-]+)\.js$/,
  ];
  for (const archivo of archivos) {
    assert.ok(!prohibidos.some((patron) => patron.test(archivo)), `La demo importa ${archivo}`);
    assert.ok(!/^\s*["']use server["']/.test(leer(archivo)), `La demo importa un módulo de servidor: ${archivo}`);
  }
  assert.ok(!externos.some((nombre) => nombre.startsWith("@supabase/")), externos.join(", "));
  assert.ok(!archivos.includes("componentes/formulario-registro.js"), "La demo no debe usar el alta de cuenta");
  for (const reutilizado of [
    "componentes/formulario-registro-cultivo.js",
    "componentes/seccion-parametros-registro.js",
    "componentes/contenido-tarjeta-planta.js",
    "componentes/opciones-etapa.js",
    "componentes/selector-fecha.js",
    "componentes/indicador-etapa.js",
  ]) {
    assert.ok(archivos.includes(reutilizado), `La demo debería reutilizar ${reutilizado}`);
  }
});

test("el formulario compartido no tiene persistencia propia y producción conserva la suya", () => {
  const compartido = leer("componentes/formulario-registro-cultivo.js");
  assert.ok(!/acciones|supabase|editor-seguimiento/.test(compartido.split("\n").filter((linea) => linea.startsWith("import")).join("\n")));
  assert.match(compartido, /accionGuardar = sinPersistencia/);
  assert.match(compartido, /cargarRegistro = null/);
  assert.match(compartido, /EditorSeguimiento = null/);
  assert.match(compartido, /registrosHoyControlados = false/);
  assert.match(compartido, /seleccionInicial = null/);
  const produccion = leer("componentes/formulario-crear-registro.js");
  assert.match(
    produccion,
    /import \{[\s\S]*agendarTarea[\s\S]*guardarRegistro[\s\S]*\} from "@\/app\/registros\/acciones"/
  );
  assert.match(produccion, /accionGuardar=\{guardarRegistro\}/);
  assert.match(produccion, /agendarTarea=\{agendarTarea\}/);
  assert.match(produccion, /cargarRegistro=\{obtenerRegistroCompleto\}/);
  assert.match(produccion, /EditorSeguimiento=\{EditorSeguimiento\}/);
  assert.ok(!/registrosHoyControlados|seleccionInicial|accionesOcultas/.test(produccion));
  assert.match(leer("app/registros/page.js"), /FormularioCrearRegistro/);
  const demo = leer("componentes/demo/vista-registros.js");
  assert.match(demo, /accionGuardar=\{guardarRegistroLocal\}/);
  assert.match(demo, /cargarRegistro=\{cargarRegistroLocal\}/);
  assert.ok(!/EditorSeguimiento=/.test(demo));
});

test("el alta de cuenta conserva su formulario y su acción", () => {
  const alta = leer("componentes/formulario-registro.js");
  assert.match(alta, /import \{ registrar \} from "@\/app\/acciones\/sesion"/);
  assert.match(alta, /useActionState\(registrar, null\)/);
  assert.match(leer("app/registro/page.js"), /import \{ FormularioRegistro \} from "@\/componentes\/formulario-registro"/);
  assert.match(leer("componentes/demo/conversion.js"), /href="\/registro"/);
});

test("las pantallas reales de cultivos conservan sus acciones de producción", () => {
  const seleccion = leer("componentes/seleccion-plantas-unidad.js");
  assert.match(seleccion, /import \{ cambiarEtapaMasiva \} from "@\/app\/espacios\/\[id\]\/acciones"/);
  assert.match(seleccion, /ContenidoTarjetaPlanta as ContenidoTarjeta/);
  assert.match(leer("componentes/etapa-progreso.js"), /useActionState\(cambiarEtapa, null\)/);
  assert.match(leer("componentes/cambiar-etapa.js"), /useActionState\(cambiarEtapa, null\)/);
  const unidad = leer("app/espacios/[id]/unidades/[unidadId]/page.js");
  assert.match(unidad, /<SeleccionPlantasUnidad/);
  assert.match(unidad, /<CabeceraUnidad/);
  const planta = leer("app/espacios/[id]/unidades/[unidadId]/plantas/[plantaId]/page.js");
  assert.match(planta, /<EtapaProgreso/);
  assert.match(planta, /<CambiarEtapa /);
  assert.match(leer("app/espacios/page.js"), /href=\{`\/espacios\/\$\{espacio\.id\}`\}/);
});

test("navegación, landing, conversión e historial usan destinos y textos acordados", () => {
  const navegacion = leer("componentes/demo/navegacion-demo.js");
  assert.ok(!navegacion.includes("lib/navegacion"));
  assert.ok(!/href=/.test(navegacion));
  for (const etiqueta of ["Cultivos", "Registros", "Historial"]) assert.ok(navegacion.includes(`"${etiqueta}"`));
  const landing = leer("componentes/landing/vista-previa-funcionalidad.js");
  assert.match(landing, /href="\/demo"/);
  assert.ok(landing.includes("¿Querés probarlo vos?"));
  assert.ok(landing.includes("Probar demo"));
  const conversion = leer("componentes/demo/conversion.js");
  for (const texto of [
    "¿Te imaginás seguir tus propios cultivos así?",
    "Crear mi cuenta gratis",
    "Seguir probando",
    'href="/registro"',
    "Los datos de esta demostración no se transferirán a tu cuenta.",
  ]) {
    assert.ok(conversion.includes(texto), texto);
  }
  const historial = leer("componentes/demo/vista-historial.js").replace(/\s+/g, " ");
  assert.match(historial, /HISTORIAL_DEMO/);
  for (const componente of [
    "HistorialCabecera",
    "HistorialCrecimiento",
    "HistorialResumen",
    "HistorialEtapas",
    "HistorialTimeline",
    "HistorialMetricas",
  ]) {
    assert.ok(historial.includes(`<${componente} `), componente);
  }
  assert.ok(!/fetch\(|supabase|\.json"|estado\.(registros|espacios)/.test(historial));
  const cabecera = leer("componentes/demo/historial-cabecera.js");
  assert.ok(!cabecera.includes("Solo lectura"));
  assert.ok(cabecera.includes("historial-portada__titulo"));
});
