import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planificarCreacionRegistros } from "../lib/registro-formulario.js";
import {
  catalogoParametrosGrupo,
  filtrarCatalogoParametrosPorGrupo,
  PARAMETROS_DESTACADOS_AMBIENTE,
} from "../lib/registros.js";

const catalogoVacio = { prioritarias: [], secundarias: [] };

describe("planificarCreacionRegistros", () => {
  const ambiente = {
    prioritarias: [
      {
        origen: "nativa",
        clave: "temperatura",
        etiqueta: "Temperatura",
        tipo_valor: "numero",
      },
    ],
    secundarias: [],
  };
  const plantas = {
    prioritarias: [
      {
        origen: "nativa",
        clave: "ph",
        etiqueta: "pH",
        tipo_valor: "numero",
      },
    ],
    secundarias: [],
  };

  it("rechaza formulario vacío", () => {
    const r = planificarCreacionRegistros({
      valoresParametros: {},
      catalogoAmbiente: ambiente,
      catalogoPlantas: plantas,
      cantidadAcciones: 0,
      observacion: "",
      hayFotos: false,
      plantasSeleccionadas: 1,
    });
    assert.match(r.error, /necesita/);
  });

  it("solo ambiente genera un tipo ambiente", () => {
    const r = planificarCreacionRegistros({
      valoresParametros: { "nativa:temperatura": "24" },
      catalogoAmbiente: ambiente,
      catalogoPlantas: plantas,
      cantidadAcciones: 0,
      observacion: "",
      hayFotos: false,
      plantasSeleccionadas: 0,
    });
    assert.equal(r.error, "");
    assert.deepEqual(r.tipos, ["ambiente"]);
  });

  it("acepta 0 numérico en plantas", () => {
    const r = planificarCreacionRegistros({
      valoresParametros: { "nativa:ph": "0" },
      catalogoAmbiente: catalogoVacio,
      catalogoPlantas: plantas,
      cantidadAcciones: 0,
      observacion: "",
      hayFotos: false,
      plantasSeleccionadas: 2,
    });
    assert.equal(r.error, "");
    assert.deepEqual(r.tipos, ["plantas"]);
    assert.equal(r.parametrosPlantas.length, 1);
    assert.equal(r.parametrosPlantas[0].valor_numero, 0);
  });

  it("nota sola exige plantas", () => {
    const r = planificarCreacionRegistros({
      valoresParametros: {},
      catalogoAmbiente: catalogoVacio,
      catalogoPlantas: plantas,
      cantidadAcciones: 0,
      observacion: "hola",
      hayFotos: false,
      plantasSeleccionadas: 0,
    });
    assert.match(r.error, /planta/);
  });

  it("ambiente y plantas generan dos tipos", () => {
    const r = planificarCreacionRegistros({
      valoresParametros: { "nativa:temperatura": "22", "nativa:ph": "6" },
      catalogoAmbiente: ambiente,
      catalogoPlantas: plantas,
      cantidadAcciones: 0,
      observacion: "",
      hayFotos: false,
      plantasSeleccionadas: 1,
    });
    assert.deepEqual(r.tipos, ["ambiente", "plantas"]);
  });

  it("omite ambiente ya guardado en reintento", () => {
    const r = planificarCreacionRegistros({
      valoresParametros: { "nativa:temperatura": "22", "nativa:ph": "6" },
      catalogoAmbiente: ambiente,
      catalogoPlantas: plantas,
      cantidadAcciones: 0,
      observacion: "",
      hayFotos: false,
      plantasSeleccionadas: 1,
      yaGuardadoAmbiente: true,
    });
    assert.deepEqual(r.tipos, ["plantas"]);
  });
});

describe("filtrarCatalogoParametrosPorGrupo", () => {
  it("no clasifica personalizados como ambiente", () => {
    const items = [
      { origen: "personalizada", clave: "x", opcion_id: "x" },
      { origen: "nativa", clave: "temperatura" },
    ];
    const amb = filtrarCatalogoParametrosPorGrupo(items, "ambiente");
    assert.equal(amb.length, 1);
    assert.equal(amb[0].clave, PARAMETROS_DESTACADOS_AMBIENTE[0]);
    const pla = filtrarCatalogoParametrosPorGrupo(items, "plantas");
    assert.equal(pla.length, 1);
    assert.equal(pla[0].origen, "personalizada");
  });
});
