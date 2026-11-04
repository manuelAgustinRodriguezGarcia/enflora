import assert from "node:assert/strict";
import test from "node:test";
import { cargarPanelInicio } from "../lib/inicio/cargar.js";
import { saludoInicio } from "../lib/inicio/saludo.js";
import {
  ACCIONES_CULTIVO,
  ACCIONES_RAPIDAS,
  MODULO_PRODUCTOS_DISPONIBLE,
  accionRegistroDesdeConsulta,
  armarPanel,
  especificacionesInicio,
  hrefAccionCultivo,
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
  assert.equal(lista.length, 4);
  assert.deepEqual(lista.map((spec) => spec.tabla), [
    "espacios",
    "unidades_cultivo",
    "plantas",
    "historial_etapas",
  ]);
  assert.deepEqual(specs.plantas.eq, [["estado", "activa"]]);
  assert.equal(JSON.stringify(specs).includes("tareas_programadas"), false);
  assert.equal(JSON.stringify(specs).includes("unidad_cultivo_id.eq"), false);
});

test("las acciones de un cultivo apuntan a esa unidad", () => {
  const unidad = { id: "u1", href: "/cultivos/e1/unidades/u1" };
  assert.deepEqual(
    ACCIONES_CULTIVO.map((item) => item.etiqueta),
    ["Registrar", "Foto", "Riego", "Etapa", "Problema"]
  );
  assert.equal(hrefAccionCultivo(unidad, "registrar"), "/registros?unidad=u1");
  assert.equal(hrefAccionCultivo(unidad, "foto"), "/registros?unidad=u1&accion=foto");
  assert.equal(hrefAccionCultivo(unidad, "problema"), "/registros?unidad=u1&accion=problema");
  assert.equal(hrefAccionCultivo(unidad, "riego"), "/registros?unidad=u1&accion=riego");
  assert.equal(hrefAccionCultivo(unidad, "etapa"), "/cultivos/e1/unidades/u1?accion=etapa");
  assert.equal(accionRegistroDesdeConsulta("riego"), "riego");
  assert.equal(accionRegistroDesdeConsulta("etapa"), "");
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
  assert.equal(carpa.espacioNombre, "Indoor");
  assert.equal(carpa.href, "/cultivos/e1/unidades/u1");
  assert.equal(carpa.hrefEspacio, "/cultivos/e1");
  assert.equal(carpa.hrefHistorial, "/registros/historial?unidad=u1");
  assert.equal(carpa.plantasActivas, 2);
  assert.equal(carpa.uniforme, true);
  assert.equal(carpa.etapaCodigo, "vegetativo");
  assert.equal(carpa.diaUnico, 12);
  assert.equal(carpa.diaUnidad, 31);
  const sector = panel.cultivos.unidades[1];
  assert.equal(sector.plantasActivas, 1);
  assert.equal(sector.etapaCodigo, "enflora");
  assert.equal(sector.diaUnico, 7);
  assert.equal(sector.diaUnidad, 61);
  assert.equal(sector.tipoEtiqueta, "Exterior");
  assert.equal(sector.espacioNombre, "Patio");
  assert.equal(sector.hrefEspacio, "/cultivos/e2");
  assert.equal(panel.cultivos.unidades.some((unidad) => unidad.id === "u3"), false);
});

test("si las plantas de una unidad no comparten etapa, lista cada una", () => {
  const entrada = base();
  entrada.plantas.filas[1].etapa = "enflora";
  entrada.etapas.filas[1].etapa = "enflora";
  entrada.etapas.filas[1].fecha_inicio = "2026-10-28";
  const carpa = armarPanel(entrada).cultivos.unidades[0];
  assert.equal(carpa.uniforme, false);
  assert.equal(carpa.diaUnidad, 31);
  assert.deepEqual(carpa.etapasConPlantas, [
    { etapa: "vegetativo", cantidad: 1, dias: [12] },
    { etapa: "enflora", cantidad: 1, dias: [4] },
  ]);
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
  assert.equal(carpa.diaUnidad, 31);
  assert.equal(armarPanel(entrada).cultivos.avisoEtapas, "");
});

test("un error de etapas avisa y no inventa el día de la etapa", () => {
  const entrada = base();
  entrada.etapas = { ok: false, filas: [], ausente: false };
  const panel = armarPanel(entrada);
  assert.match(panel.cultivos.avisoEtapas, /fecha de inicio/);
  assert.equal(panel.cultivos.unidades[0].diaUnico, 31);
  assert.equal(panel.cultivos.unidades[0].diaUnidad, 31);
});

test("si fallan los cultivos no se inventan unidades", () => {
  const entrada = base();
  entrada.espacios = { ok: false, filas: [], ausente: false };
  const panel = armarPanel(entrada);
  assert.equal(panel.cultivos.estado, "error");
  assert.deepEqual(panel.cultivos.unidades, []);
});

test("el saludo de inicio sigue la personalidad de Flora", () => {
  assert.equal(saludoInicio("cercana_divertida", "Mati"), "¿Qué hacés Mati, todo bien?");
  assert.equal(saludoInicio("cercana_natural", "Mati"), "Qué bueno verte, Mati");
  assert.equal(saludoInicio("tecnica_profesional", "Mati"), "A la espera de sus órdenes Mati!");
  assert.equal(saludoInicio("inexistente", "Mati"), "Qué bueno verte, Mati");
  assert.equal(saludoInicio("cercana_divertida", "  "), "¿Qué hacés, todo bien?");
  assert.equal(saludoInicio("cercana_natural", ""), "Qué bueno verte");
  assert.equal(saludoInicio("tecnica_profesional", ""), "A la espera de sus órdenes!");
});

test("las acciones rápidas no inventan productos ni recetas", () => {
  const panel = armarPanel(base());
  assert.equal(MODULO_PRODUCTOS_DISPONIBLE, false);
  assert.equal(panel.productosDisponibles, false);
  assert.deepEqual(
    ACCIONES_RAPIDAS.map((accion) => accion.href),
    ["/registros", "/flora", "/cultivos", "/registros/historial"]
  );
  assert.equal(ACCIONES_RAPIDAS.some((accion) => /producto|receta/i.test(accion.href)), false);
});

test("cargar el panel hace las consultas en paralelo", async () => {
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
  assert.equal(consultas.length, 4);
  assert.equal(panel.cultivos.unidades.length, 2);
  assert.equal(consultas.filter((consulta) => consulta.tabla === "unidades_cultivo").length, 1);
  assert.equal(consultas.some((consulta) => consulta.tabla === "registros"), false);
});

function claveDe(estado) {
  if (estado.tabla === "espacios") return "espacios";
  if (estado.tabla === "unidades_cultivo") return "unidades";
  if (estado.tabla === "plantas") return "plantas";
  if (estado.tabla === "historial_etapas") return "etapas";
  return "";
}
