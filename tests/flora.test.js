import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  agruparRegistrosPorDiaEvento,
  buscarEventoAccion,
  clasificarParametroNativo,
  contarAcciones,
  estadisticasMediciones,
  medicionesParametro,
  registroCompacto,
  resumirActividadDesdeRegistros,
} from "../lib/flora-analisis.js";
import {
  buscarEnGuiaCultivo,
  buscarFragmentosEnDocumentos,
  cargarDocumentosGuia,
  normalizarDocumentoGuia,
  obtenerDocumentoGuiaPorId,
  reiniciarCacheGuia,
} from "../lib/flora-conocimiento.js";
import { FUENTE_CULTIVO, FUENTE_GUIA, respuestaFlora } from "../lib/flora-contrato.js";
import { normalizarPeriodo, periodoDesdePreset } from "../lib/flora-periodos.js";
import { opcionesAmbiguas } from "../lib/flora-entidades.js";
import {
  buscarAccionesHistoricas,
  buscarFotosMetadatos,
  obtenerContextoCultivo,
  requiereSesionFlora,
} from "../lib/flora-contexto.js";

const FIXTURES_GUIA = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures",
  "guia-cultivo"
);

const UNIDAD = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const PLANTA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

function registroBase(overrides = {}) {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddd01",
    fecha_evento: "2026-10-26T15:00:00.000Z",
    alcance: "planta",
    aplica_a: "plantas",
    unidad_cultivo_id: UNIDAD,
    observacion: "",
    registro_plantas: [
      {
        planta_id: PLANTA,
        nombre_planta: "Planta A",
        numero_planta: 1,
        genetica_planta: "Gorilla",
        nombre_unidad: "Carpa",
      },
    ],
    registro_acciones: [{ origen: "nativa", clave_nativa: "riego", nombre: "Riego" }],
    registro_parametros: [
      {
        origen: "nativa",
        clave_nativa: "ph",
        nombre: "pH",
        tipo_valor: "numero",
        valor_numero: 6.2,
        unidad: "",
      },
    ],
    registro_fotos: [{ id: "f1", ruta: "privado/foto.jpg", orden: 0 }],
    ...overrides,
  };
}

test("períodos: últimos 7 y semana anterior en calendario", () => {
  const siete = periodoDesdePreset("ultimos_7", { hoy: "2026-10-27" });
  assert.equal(siete.desde, "2026-10-21");
  assert.equal(siete.hasta, "2026-10-27");
  const anterior = periodoDesdePreset("semana_anterior", { hoy: "2026-10-27" });
  assert.ok(anterior.desde < anterior.hasta);
});

test("resumen semanal no inventa ceros en mediciones ausentes", () => {
  const resumen = resumirActividadDesdeRegistros([registroBase()], {
    periodo: { desde: "2026-10-21", hasta: "2026-10-27" },
  });
  assert.equal(resumen.registros, 1);
  assert.equal(resumen.mediciones, 1);
  assert.equal(resumen.riegos, 1);
});

test("último y primer riego histórico en lote", () => {
  const viejo = registroBase({
    id: "r-viejo",
    fecha_evento: "2026-10-01T12:00:00.000Z",
  });
  const nuevo = registroBase({
    id: "r-nuevo",
    fecha_evento: "2026-10-26T18:00:00.000Z",
  });
  const ultimo = buscarEventoAccion([viejo, nuevo], { claveNativa: "riego" });
  const primero = buscarEventoAccion([viejo, nuevo], { claveNativa: "riego" }, { orden: "asc" });
  assert.equal(ultimo.id, "r-nuevo");
  assert.equal(primero.id, "r-viejo");
});

test("estadísticas de parámetro respetan unidades incompatibles", () => {
  const puntos = [
    { valor_numero: 6, unidad: "" },
    { valor_numero: 25, unidad: "°C" },
  ].map((p, i) => ({
    ...p,
    fecha_evento: `2026-10-${20 + i}T12:00:00.000Z`,
    tipo_valor: "numero",
  }));
  const stats = estadisticasMediciones(puntos);
  assert.equal(stats.comparable, false);
  assert.equal(stats.promedio, null);
});

test("parámetro ambiental vs de planta", () => {
  assert.equal(clasificarParametroNativo("temperatura").tipo, "ambiente");
  assert.equal(clasificarParametroNativo("ph").tipo, "planta");
});

test("múltiples registros el mismo día se conservan", () => {
  const a = registroBase({ id: "a", fecha_evento: "2026-10-26T10:00:00.000Z" });
  const b = registroBase({ id: "b", fecha_evento: "2026-10-26T20:00:00.000Z" });
  const dias = agruparRegistrosPorDiaEvento([a, b]);
  assert.equal(dias.length, 1);
  assert.equal(dias[0].cantidad, 2);
});

test("registro compacto no incluye rutas de fotos", () => {
  const compacto = registroCompacto(registroBase());
  assert.equal(compacto.fotos.cantidad, 1);
  assert.deepEqual(compacto.fotos.ids, ["f1"]);
  assert.ok(!JSON.stringify(compacto).includes("privado/foto"));
});

test("snapshots históricos en plantas del registro", () => {
  const compacto = registroCompacto(registroBase());
  assert.equal(compacto.plantas[0].nombre, "Planta A");
  assert.equal(compacto.plantas[0].genetica, "Gorilla");
});

test("guía vacía sin inventar fragmentos", () => {
  reiniciarCacheGuia();
  const vacia = buscarEnGuiaCultivo({ consulta: "ph", carpeta: path.join(FIXTURES_GUIA, "inexistente") });
  assert.equal(vacia.fuente, FUENTE_GUIA);
  assert.equal(vacia.datos.length, 0);
  assert.ok(vacia.limitaciones?.[0]?.includes("guía"));
});

test("búsqueda en guía conserva referencias bibliográficas", () => {
  reiniciarCacheGuia();
  const docs = cargarDocumentosGuia({ carpeta: FIXTURES_GUIA, forzar: true });
  assert.equal(docs.length, 1);
  const fragmentos = buscarFragmentosEnDocumentos(docs, { consulta: "ph" });
  assert.ok(fragmentos[0].referencias.length);
  assert.equal(fragmentos[0].bibliografia.autor, "Equipo de pruebas");
});

test("documento inexistente devuelve error explícito", () => {
  const doc = obtenerDocumentoGuiaPorId("no-existe", { carpeta: FIXTURES_GUIA, forzar: true });
  assert.equal(doc, null);
});

test("normalizar documento separa metadatos y secciones", () => {
  const doc = normalizarDocumentoGuia({
    id: "x",
    titulo: "T",
    secciones: [{ id: "s", contenido: "Cuerpo" }],
  });
  assert.equal(doc.secciones.length, 1);
  assert.equal(doc.titulo, "T");
});

test("contrato marca procedencia cultivo vs guía", () => {
  const cultivo = respuestaFlora({ fuente: FUENTE_CULTIVO, tipoConsulta: "t", datos: {} });
  const guia = respuestaFlora({ fuente: FUENTE_GUIA, tipoConsulta: "t", datos: [] });
  assert.notEqual(cultivo.fuente, guia.fuente);
});

test("ambigüedad de entidades devuelve opciones", () => {
  const opciones = opcionesAmbiguas("planta", [
    { id: "1", nombre: "A" },
    { id: "2", nombre: "A" },
  ]);
  assert.equal(opciones.length, 2);
});

test("sin sesión se rechaza contexto privado", async () => {
  const supabase = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  const respuesta = await obtenerContextoCultivo(supabase);
  assert.match(respuesta.error || "", /sesión/i);
});

test("requiereSesionFlora sin usuario", async () => {
  const supabase = { auth: { getUser: async () => ({ data: {}, error: null }) } };
  const r = await requiereSesionFlora(supabase);
  assert.equal(r.ok, false);
});

function supabaseMockHistorial(registros) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from(tabla) {
      if (tabla === "plantas") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                data: [
                  {
                    id: PLANTA,
                    nombre: "Planta A",
                    genetica: "Gorilla",
                    metodo: "tierra",
                    sustrato: "turba",
                    etapa: "vegetativo",
                    fecha_inicio: "2026-09-01",
                    estado: "activa",
                    numero: 1,
                    unidad_cultivo_id: UNIDAD,
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (tabla === "historial_etapas") {
        return {
          select: () => ({
            in: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      if (tabla === "registros") {
        const chain = {
          _select: "",
          select(sel) {
            chain._select = sel;
            return chain;
          },
          eq() {
            return chain;
          },
          gte() {
            return chain;
          },
          lte() {
            return chain;
          },
          not() {
            return chain;
          },
          or() {
            return chain;
          },
          in: async () => ({ data: registros, error: null }),
          order() {
            return chain;
          },
          limit: async () => {
            if (chain._select.includes("filtro_acciones") || chain._select.includes("filtro_parametros")) {
              return {
                data: registros.map((r) => ({ id: r.id, fecha_evento: r.fecha_evento })),
                error: null,
              };
            }
            return { data: registros, error: null };
          },
        };
        return chain;
      }
      if (tabla === "unidades_cultivo") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: UNIDAD },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      };
    },
  };
}

test("metadatos de fotos sin URLs ni base64", async () => {
  const supabase = supabaseMockHistorial([registroBase()]);
  const respuesta = await buscarFotosMetadatos(supabase, {
    unidadId: UNIDAD,
    preset: "ultimos_7",
  });
  assert.equal(respuesta.datos.cantidad, 1);
  assert.ok(!JSON.stringify(respuesta).includes("ruta"));
  assert.ok(respuesta.limitaciones?.[0]?.includes("metadatos"));
});

test("buscar acciones modo contar", async () => {
  const supabase = supabaseMockHistorial([registroBase()]);
  const respuesta = await buscarAccionesHistoricas(supabase, {
    unidadId: UNIDAD,
    claveNativa: "riego",
    modo: "contar",
    preset: "ultimos_7",
  });
  assert.equal(respuesta.datos.cantidad, 1);
});

test("mediciones de parámetro en período", () => {
  const filas = medicionesParametro([registroBase()], { claveNativa: "ph" });
  assert.equal(filas.length, 1);
  assert.equal(filas[0].valor_numero, 6.2);
});

test("resultado vacío explícito", () => {
  const resumen = resumirActividadDesdeRegistros([], { periodo: null });
  assert.equal(resumen.registros, 0);
  assert.equal(resumen.riegos, 0);
});

test("límite de fragmentos de guía", () => {
  const docs = cargarDocumentosGuia({ carpeta: FIXTURES_GUIA, forzar: true });
  const fragmentos = buscarFragmentosEnDocumentos(docs, { consulta: "ph", limite: 1 });
  assert.equal(fragmentos.length, 1);
});

test("normalizar período por defecto usa 7 días", () => {
  const p = normalizarPeriodo({});
  assert.equal(p.periodo.preset, "ultimos_7");
});
