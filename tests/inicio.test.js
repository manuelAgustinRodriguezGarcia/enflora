import assert from "node:assert/strict";
import test from "node:test";
import { cargarPanelInicio } from "../lib/inicio/cargar.js";
import {
  ACCIONES_RAPIDAS,
  CLIMA_DISPONIBLE,
  LIMITE_CUIDADOS,
  LIMITE_RECIENTES,
  LIMITE_TAREAS,
  MODULO_PRODUCTOS_DISPONIBLE,
  armarPanel,
  especificacionesInicio,
  partesInstante,
  textoResumenCultivos,
} from "../lib/inicio/resumen.js";
import { DESTINOS_NAVEGACION, RUTA_INICIO, destinoActivo, esRutaApp } from "../lib/navegacion.js";

const HOY = "2026-11-01";

function ok(filas) {
  return { ok: true, filas, ausente: false };
}

function base() {
  return {
    hoy: HOY,
    espacios: ok([
      { id: "e1", nombre: "Indoor", tipo: "interior" },
      { id: "e2", nombre: "Patio", tipo: "exterior" },
      { id: "e3", nombre: "Vacío", tipo: "interior" },
    ]),
    unidades: ok([
      { id: "u1", espacio_id: "e1", nombre: "Carpa 1", tipo: "carpa", numero: 1 },
      { id: "u2", espacio_id: "e2", nombre: "Sector", tipo: "aire_libre", numero: 1 },
      { id: "u3", espacio_id: "e3", nombre: "Carpa vieja", tipo: "carpa", numero: 1 },
    ]),
    plantas: ok([
      {
        id: "p1",
        nombre: "A",
        etapa: "vegetativo",
        fecha_inicio: "2026-10-01",
        estado: "activa",
        numero: 1,
        unidad_cultivo_id: "u1",
      },
      {
        id: "p2",
        nombre: "B",
        etapa: "vegetativo",
        fecha_inicio: "2026-10-01",
        estado: "activa",
        numero: 2,
        unidad_cultivo_id: "u1",
      },
      {
        id: "p3",
        nombre: "C",
        etapa: "enflora",
        fecha_inicio: "2026-09-01",
        estado: "activa",
        numero: 1,
        unidad_cultivo_id: "u2",
      },
      {
        id: "p4",
        nombre: "D",
        etapa: "finalizado",
        fecha_inicio: "2026-01-01",
        estado: "finalizada",
        numero: 2,
        unidad_cultivo_id: "u2",
      },
      {
        id: "p5",
        nombre: "E",
        etapa: "finalizado",
        fecha_inicio: "2026-01-01",
        estado: "finalizada",
        numero: 1,
        unidad_cultivo_id: "u3",
      },
    ]),
    etapas: ok([
      { planta_id: "p1", etapa: "vegetativo", fecha_inicio: "2026-10-20", fecha_fin: null },
      { planta_id: "p2", etapa: "vegetativo", fecha_inicio: "2026-10-20", fecha_fin: null },
      { planta_id: "p3", etapa: "enflora", fecha_inicio: "2026-10-25", fecha_fin: null },
      { planta_id: "p1b", etapa: "germinacion", fecha_inicio: "2026-10-28", fecha_fin: null },
    ]),
    recientes: ok([]),
    cuidados: ok([]),
    tareas: ok([]),
  };
}

test("el inicio es el primer destino de la navegación inferior", () => {
  assert.equal(RUTA_INICIO, "/inicio");
  assert.equal(esRutaApp("/inicio"), true);
  assert.equal(DESTINOS_NAVEGACION.length, 4);
  assert.equal(DESTINOS_NAVEGACION[0]?.href, "/inicio");
  assert.equal(destinoActivo("/inicio", DESTINOS_NAVEGACION[0]), true);
  for (const destino of DESTINOS_NAVEGACION.slice(1)) {
    assert.equal(destinoActivo("/inicio", destino), false);
  }
});

test("las consultas del inicio son un lote fijo, sin una consulta por unidad", () => {
  const specs = especificacionesInicio("usuario-1");
  const lista = Object.values(specs);
  assert.equal(lista.length, 7);
  assert.deepEqual(lista.map((spec) => spec.tabla), [
    "espacios",
    "unidades_cultivo",
    "plantas",
    "historial_etapas",
    "registros",
    "registros",
    "tareas_programadas",
  ]);
  assert.deepEqual(specs.plantas.eq, [["estado", "activa"]]);
  assert.deepEqual(specs.recientes.eq, [["usuario_id", "usuario-1"]]);
  assert.equal(specs.recientes.limite, LIMITE_RECIENTES);
  assert.equal(specs.cuidados.select.includes("registro_acciones!inner"), true);
  assert.deepEqual(specs.cuidados.in, [["filtro_cuidado.clave_nativa", ["riego", "fertilizacion"]]]);
  assert.equal(specs.cuidados.limite, LIMITE_CUIDADOS);
  assert.deepEqual(specs.tareas.eq, [
    ["usuario_id", "usuario-1"],
    ["completada", false],
  ]);
  assert.deepEqual(specs.tareas.orden[0], ["fecha_programada", { ascending: true }]);
  assert.equal(specs.tareas.limite, LIMITE_TAREAS);
  assert.equal(JSON.stringify(specs).includes("unidad_cultivo_id.eq"), false);
});

test("el resumen usa la etapa abierta y deja afuera plantas finalizadas", () => {
  const panel = armarPanel(base());
  assert.equal(panel.cultivos.estado, "listo");
  assert.equal(
    panel.cultivos.resumen,
    textoResumenCultivos({ espacios: 2, unidades: 2, plantas: 3 })
  );
  assert.equal(panel.cultivos.avisoEtapas, "");
  const carpa = panel.cultivos.unidades[0];
  assert.equal(carpa.nombre, "Carpa 1");
  assert.equal(carpa.href, "/espacios/e1/unidades/u1");
  assert.equal(carpa.hrefHistorial, "/registros/historial?unidad=u1");
  assert.equal(carpa.plantasActivas, 2);
  assert.equal(carpa.uniforme, true);
  assert.equal(carpa.etapaCodigo, "vegetativo");
  assert.equal(carpa.diaUnico, 12);
  const sector = panel.cultivos.unidades[1];
  assert.equal(sector.plantasActivas, 1);
  assert.equal(sector.etapaCodigo, "enflora");
  assert.equal(sector.diaUnico, 7);
  assert.equal(sector.tipoEtiqueta, "Exterior");
  assert.equal(panel.cultivos.unidades.some((unidad) => unidad.id === "u3"), false);
});

test("si las plantas de una unidad no comparten etapa, lista cada una", () => {
  const entrada = base();
  entrada.plantas.filas[1].etapa = "enflora";
  entrada.etapas.filas[1].etapa = "enflora";
  entrada.etapas.filas[1].fecha_inicio = "2026-10-28";
  const carpa = armarPanel(entrada).cultivos.unidades[0];
  assert.equal(carpa.uniforme, false);
  assert.deepEqual(
    carpa.lineas.map((linea) => [linea.nombre, linea.etapa, linea.dia]),
    [
      ["A", "vegetativo", 12],
      ["B", "enflora", 4],
    ]
  );
});

test("sin historial de etapa, el día sale de la fecha de inicio de la planta", () => {
  const entrada = base();
  entrada.etapas = { ok: false, filas: [], ausente: true };
  const carpa = armarPanel(entrada).cultivos.unidades[0];
  assert.equal(carpa.diaUnico, 31);
  assert.equal(armarPanel(entrada).cultivos.avisoEtapas, "");
});

test("un error de etapas avisa y no inventa el día de la etapa", () => {
  const entrada = base();
  entrada.etapas = { ok: false, filas: [], ausente: false };
  const panel = armarPanel(entrada);
  assert.match(panel.cultivos.avisoEtapas, /fecha de inicio/);
  assert.equal(panel.cultivos.unidades[0].diaUnico, 31);
});

test("si fallan los cultivos no se inventan unidades", () => {
  const entrada = base();
  entrada.espacios = { ok: false, filas: [], ausente: false };
  const panel = armarPanel(entrada);
  assert.equal(panel.cultivos.estado, "error");
  assert.deepEqual(panel.cultivos.unidades, []);
  assert.equal(panel.exterior.estado, "error");
});

test("la actividad separa registros de riegos y enlaza el historial real", () => {
  const entrada = base();
  entrada.recientes = ok([
    {
      id: "r-viejo",
      fecha_evento: "2026-10-30T15:00:00.000Z",
      unidad_cultivo_id: "u1",
      observacion: "nota suelta",
      registro_acciones: [],
    },
    {
      id: "r-nuevo",
      fecha_evento: "2026-11-01T15:30:00.000Z",
      unidad_cultivo_id: null,
      espacio_id: "e1",
      observacion: "",
      registro_acciones: [{ clave_nativa: "poda", nombre: "Poda" }],
    },
  ]);
  entrada.cuidados = ok([
    {
      id: "c1",
      fecha_evento: "2026-10-31T18:00:00.000Z",
      unidad_cultivo_id: "u2",
      filtro_cuidado: [
        { clave_nativa: "riego", nombre: "Riego" },
        { clave_nativa: "fertilizacion", nombre: "Fertilización" },
      ],
    },
    {
      id: "c2",
      fecha_evento: "2026-11-01T12:00:00.000Z",
      filtro_cuidado: [{ clave_nativa: "poda", nombre: "Poda" }],
    },
  ]);
  const panel = armarPanel(entrada);
  assert.deepEqual(
    panel.actividad.recientes.items.map((item) => item.titulo),
    ["Poda", "Nota"]
  );
  assert.equal(panel.actividad.recientes.items[0].href, "/registros/historial");
  assert.equal(panel.actividad.recientes.items[1].href, "/registros/historial?unidad=u1");
  assert.equal(panel.actividad.recientes.items[1].unidadNombre, "Carpa 1");
  assert.deepEqual(
    panel.actividad.cuidados.items.map((item) => [item.titulo, item.unidadNombre]),
    [["Riego, Fertilización", "Sector"]]
  );
  const partes = partesInstante("2026-11-01T15:30:00.000Z");
  assert.equal(partes.hour, "12");
  assert.equal(partes.minute, "30");
  assert.match(panel.actividad.recientes.items[0].textoFecha, /12:30/);
});

test("las tareas pendientes se ordenan por vencimiento y no se simulan", () => {
  const entrada = base();
  entrada.tareas = ok([
    {
      id: "t2",
      descripcion: "Medir pH",
      fecha_programada: "2026-11-03",
      fecha_creacion: "2026-10-01T00:00:00.000Z",
      unidad_cultivo_id: "u1",
    },
    {
      id: "t1",
      descripcion: "Regar",
      fecha_programada: "2026-10-30",
      fecha_creacion: "2026-10-01T00:00:00.000Z",
      unidad_cultivo_id: "u2",
    },
    {
      id: "t3",
      descripcion: "Hoy",
      fecha_programada: "2026-11-01",
      fecha_creacion: "2026-10-02T00:00:00.000Z",
      unidad_cultivo_id: "u1",
    },
  ]);
  const panel = armarPanel(entrada);
  assert.deepEqual(
    panel.tareas.items.map((item) => [item.descripcion, item.vencida, item.href]),
    [
      ["Regar", true, "/espacios/e2/unidades/u2"],
      ["Hoy", false, "/espacios/e1/unidades/u1"],
      ["Medir pH", false, "/espacios/e1/unidades/u1"],
    ]
  );
  entrada.tareas = { ok: false, filas: [], ausente: true };
  assert.equal(armarPanel(entrada).tareas.estado, "no_disponible");
  assert.deepEqual(armarPanel(entrada).tareas.items, []);
  entrada.tareas = ok([]);
  assert.equal(armarPanel(entrada).tareas.estado, "vacio");
});

test("no hay clima ni productos inventados", () => {
  const panel = armarPanel(base());
  assert.equal(CLIMA_DISPONIBLE, false);
  assert.equal(panel.clima.disponible, false);
  assert.equal(panel.clima.motivo, "sin_ubicacion_ni_fuente");
  assert.equal("temperatura" in panel.clima, false);
  assert.equal("pronostico" in panel.clima, false);
  assert.deepEqual(
    panel.exterior.unidades.map((unidad) => unidad.nombre),
    ["Sector"]
  );
  assert.equal(MODULO_PRODUCTOS_DISPONIBLE, false);
  assert.equal(panel.productosDisponibles, false);
  assert.deepEqual(
    ACCIONES_RAPIDAS.map((accion) => accion.href),
    ["/registros", "/flora", "/espacios", "/registros/historial"]
  );
  assert.equal(ACCIONES_RAPIDAS.some((accion) => /producto|receta/i.test(accion.href)), false);
});

test("cargar el panel hace las siete consultas en paralelo", async () => {
  const consultas = [];
  const supabase = {
    from(tabla) {
      const estado = { tabla, select: "", eq: [], in: [], is: [], orden: [], limite: null };
      consultas.push(estado);
      const cadena = {
        select(valor) {
          estado.select = valor;
          return cadena;
        },
        eq(columna, valor) {
          estado.eq.push([columna, valor]);
          return cadena;
        },
        in(columna, valor) {
          estado.in.push([columna, valor]);
          return cadena;
        },
        is(columna, valor) {
          estado.is.push([columna, valor]);
          return cadena;
        },
        order(columna, opciones) {
          estado.orden.push([columna, opciones]);
          return cadena;
        },
        limit(cantidad) {
          estado.limite = cantidad;
          return cadena;
        },
        then(resolver, rechazar) {
          const datos = base();
          const filas = datos[claveDe(estado)]?.filas || [];
          return Promise.resolve({ data: filas, error: null }).then(resolver, rechazar);
        },
      };
      return cadena;
    },
  };

  const panel = await cargarPanelInicio(supabase, "usuario-1", { hoy: HOY });
  assert.equal(consultas.length, 7);
  assert.equal(panel.cultivos.unidades.length, 2);
  assert.equal(consultas.filter((consulta) => consulta.tabla === "unidades_cultivo").length, 1);
});

function claveDe(estado) {
  if (estado.tabla === "espacios") return "espacios";
  if (estado.tabla === "unidades_cultivo") return "unidades";
  if (estado.tabla === "plantas") return "plantas";
  if (estado.tabla === "historial_etapas") return "etapas";
  if (estado.tabla === "tareas_programadas") return "tareas";
  if (estado.select.includes("!inner")) return "cuidados";
  return "recientes";
}
