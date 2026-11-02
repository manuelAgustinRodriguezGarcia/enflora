import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { argumentosRpcRegistro, prepararDatosRegistro } from "../lib/registros.js";
import {
  cantidadAplicada,
  litrosDe,
  mililitrosDe,
} from "../lib/mezclas/calculo.js";
import { detalleMezcla } from "../lib/mezclas/presentacion.js";
import {
  borradorDesdeSnapshot,
  clonarReceta,
  congelarComponente,
  construirPayloadMezcla,
  firmaMezcla,
  fusionarMedicionesMezcla,
  mezclaAjustada,
  mezclaVacia,
  referenciasDeOtroUsuario,
  validarPayloadMezcla,
  validarProducto,
  validarReceta,
} from "../lib/mezclas/reglas.js";

const USUARIO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const PRODUCTO = "33333333-3333-4333-8333-333333333333";
const PRODUCTO_B = "44444444-4444-4444-8444-444444444444";
const RECETA = "55555555-5555-4555-8555-555555555555";
const PLANTA = "66666666-6666-4666-8666-666666666666";
const UNIDAD = "77777777-7777-4777-8777-777777777777";
const ESPACIO = "88888888-8888-4888-8888-888888888888";

const RIEGO = [{ origen: "nativa", clave_nativa: "riego", nombre: "Riego" }];

function entradaRegistro(extra = {}) {
  return {
    alcance: "unidad",
    aplica_a: "plantas",
    espacio_id: ESPACIO,
    unidad_cultivo_id: UNIDAD,
    fecha_evento: "2026-11-01T15:00:00.000Z",
    plantas: [
      {
        id: PLANTA,
        nombre: "Una",
        numero: 1,
        genetica: null,
        unidad_cultivo_id: UNIDAD,
        nombre_unidad: "Carpa",
      },
    ],
    acciones: RIEGO,
    parametros: [],
    observacion: "",
    ...extra,
  };
}

function borradorBase(parcial = {}) {
  return {
    incluir: true,
    recetaId: RECETA,
    volumen: "10",
    unidadVolumen: "L",
    componentes: [{ productoId: PRODUCTO, cantidad: 2, unidad: "ml/L" }],
    origen: { componentes: [{ productoId: PRODUCTO, cantidad: 2, unidad: "ml/L" }] },
    ph: "",
    ec: "",
    ppm: "",
    metodo: "",
    etapa: "",
    ...parcial,
  };
}

describe("cálculo de mezclas", () => {
  it("convierte litros y mililitros y escala solo las dosis por litro", () => {
    assert.equal(mililitrosDe(1, "L"), 1000);
    assert.equal(litrosDe(500, "ml"), 0.5);
    assert.deepEqual(
      cantidadAplicada({ cantidad: 2, unidad: "ml/L", volumenAgua: 10, unidadVolumen: "L" }),
      { cantidad: 20, unidad: "ml" }
    );
    assert.deepEqual(
      cantidadAplicada({ cantidad: 2, unidad: "ml/L", volumenAgua: 500, unidadVolumen: "ml" }),
      { cantidad: 1, unidad: "ml" }
    );
    assert.deepEqual(
      cantidadAplicada({ cantidad: 1.5, unidad: "g/L", volumenAgua: 2, unidadVolumen: "L" }),
      { cantidad: 3, unidad: "g" }
    );
    assert.deepEqual(
      cantidadAplicada({ cantidad: 10, unidad: "ml", volumenAgua: 20, unidadVolumen: "L" }),
      { cantidad: 10, unidad: "ml" }
    );
    assert.deepEqual(
      cantidadAplicada({ cantidad: 0.25, unidad: "L", volumenAgua: 1, unidadVolumen: "ml" }),
      { cantidad: 0.25, unidad: "L" }
    );
  });

  it("no marca como ajustada un recálculo proporcional", () => {
    const base = borradorBase();
    assert.equal(mezclaAjustada(base), false);
    assert.equal(mezclaAjustada({ ...base, volumen: "25", unidadVolumen: "L" }), false);
    assert.equal(mezclaAjustada({ ...base, volumen: "500", unidadVolumen: "ml" }), false);
    assert.equal(
      mezclaAjustada({
        ...base,
        componentes: [{ productoId: PRODUCTO, cantidad: 3, unidad: "ml/L" }],
      }),
      true
    );
    assert.equal(
      mezclaAjustada({
        ...base,
        componentes: [
          { productoId: PRODUCTO, cantidad: 2, unidad: "ml/L" },
          { productoId: PRODUCTO_B, cantidad: 4, unidad: "g" },
        ],
      }),
      true
    );
    assert.equal(
      mezclaAjustada({
        ...base,
        origen: { componentes: [{ productoId: PRODUCTO, cantidad: 10, unidad: "ml" }] },
        componentes: [{ productoId: PRODUCTO, cantidad: 10, unidad: "ml" }],
        volumen: "30",
      }),
      false
    );
    assert.equal(mezclaAjustada({ ...base, origen: null, recetaId: "" }), false);
  });

  it("rechaza cantidades y mediciones inválidas", () => {
    const cero = validarPayloadMezcla(
      {
        receta_id: null,
        volumen_agua: 5,
        unidad_volumen: "L",
        componentes: [{ producto_id: PRODUCTO, cantidad: 0, unidad: "ml" }],
        origen: null,
      },
      { acciones: RIEGO, aplicaA: "plantas" }
    );
    assert.equal(cero.error, "La cantidad del componente no es válida.");

    const negativa = validarProducto({ nombre: "Calmag", tipo: "aditivo", fabricante: "", caracteristicas: "" });
    assert.equal(negativa.error, "");
    const ph = validarPayloadMezcla(
      {
        receta_id: null,
        volumen_agua: 5,
        unidad_volumen: "L",
        ph: 15,
        componentes: [],
        origen: null,
      },
      { acciones: RIEGO, aplicaA: "plantas" }
    );
    assert.equal(ph.error, "El pH de la mezcla no es válido.");
    assert.equal(validarProducto({ nombre: " ", tipo: "aditivo" }).error, "El nombre del producto es obligatorio.");
    assert.equal(validarProducto({ nombre: "A", tipo: "otro" }).error, "El tipo de producto no es válido.");
  });
});

describe("recetas", () => {
  it("duplica con otro id y deja activa la copia de una receta archivada", () => {
    let n = 0;
    const original = {
      id: RECETA,
      nombre: "Floración",
      activa: false,
      componentes: [{ id: "comp", producto_id: PRODUCTO, cantidad: 2, unidad: "ml/L" }],
    };
    const copia = clonarReceta(original, () => `id-${++n}`);
    assert.equal(copia.nombre, "Copia de Floración");
    assert.equal(copia.activa, true);
    assert.equal(original.activa, false);
    assert.notEqual(copia.id, original.id);
    assert.notEqual(copia.componentes[0].id, "comp");
    assert.equal(copia.componentes[0].producto_id, PRODUCTO);
  });

  it("permite una receta con un producto archivado del mismo usuario", () => {
    const resultado = validarReceta(
      {
        usuarioId: USUARIO,
        nombre: "Base",
        volumenAgua: 10,
        unidadVolumen: "L",
        componentes: [{ productoId: PRODUCTO, cantidad: 2, unidad: "ml/L" }],
      },
      [{ id: PRODUCTO, usuario_id: USUARIO, activo: false }]
    );
    assert.equal(resultado.error, "");
    assert.equal(resultado.receta.componentes[0].producto_id, PRODUCTO);
  });
});

describe("snapshots y edición", () => {
  it("no cambia el snapshot cuando después se edita el producto", () => {
    const producto = { id: PRODUCTO, nombre: "Calmag", fabricante: "Athena", tipo: "aditivo" };
    const snapshot = congelarComponente(producto, {
      cantidad_aplicada: 20,
      unidad_aplicada: "ml",
      cantidad_receta: 2,
      unidad_receta: "ml/L",
    });
    producto.nombre = "Calmag nuevo";
    producto.fabricante = "Otro";
    assert.equal(snapshot.nombre_producto, "Calmag");
    assert.equal(snapshot.fabricante, "Athena");
    assert.equal(detalleMezcla({
      nombre_receta: "Base",
      volumen_agua: 10,
      unidad_volumen: "L",
      ajustada: false,
      registro_mezcla_componentes: [snapshot],
    }).componentes[0].texto.includes("Calmag"), true);
  });

  it("conserva la mezcla si la edición no la cambia y la quita si se va el riego", () => {
    const borrador = borradorBase();
    const firma = firmaMezcla(borrador);
    const igual = construirPayloadMezcla({
      borrador,
      firmaInicial: firma,
      acciones: RIEGO,
      aplicaA: "plantas",
      habiaMezcla: true,
    });
    assert.equal(igual.mezcla, null);

    const sinAccion = construirPayloadMezcla({
      borrador,
      firmaInicial: firma,
      acciones: [{ origen: "nativa", clave_nativa: "poda", nombre: "Poda" }],
      aplicaA: "plantas",
      habiaMezcla: true,
    });
    assert.deepEqual(sinAccion.mezcla, { aplicar: false });

    const ajustado = borradorDesdeSnapshot({
      receta_id: RECETA,
      volumen_agua: 10,
      unidad_volumen: "L",
      origen: { componentes: [{ producto_id: PRODUCTO, cantidad: 2, unidad: "ml/L" }] },
      registro_mezcla_componentes: [
        {
          producto_id: PRODUCTO,
          orden: 0,
          cantidad_aplicada: 30,
          unidad_aplicada: "ml",
          cantidad_receta: 2,
          unidad_receta: "ml/L",
        },
      ],
    });
    assert.equal(mezclaAjustada(ajustado), true);
    assert.equal(
      construirPayloadMezcla({
        borrador: ajustado,
        firmaInicial: firmaMezcla(ajustado),
        acciones: RIEGO,
        aplicaA: "plantas",
        habiaMezcla: true,
      }).mezcla,
      null
    );
  });

  it("arma un riego con volumen y sin productos, y uno solo con la acción", () => {
    const volumen = construirPayloadMezcla({
      borrador: borradorBase({
        recetaId: "",
        origen: null,
        componentes: [],
        volumen: "5",
      }),
      acciones: RIEGO,
      aplicaA: "plantas",
      habiaMezcla: false,
    });
    assert.equal(volumen.error, "");
    assert.equal(volumen.mezcla.volumen_agua, 5);
    assert.deepEqual(volumen.mezcla.componentes, []);
    assert.equal(volumen.mezcla.receta_id, null);

    const chip = construirPayloadMezcla({
      borrador: mezclaVacia(),
      acciones: RIEGO,
      aplicaA: "plantas",
      habiaMezcla: false,
    });
    assert.equal(chip.mezcla, null);
  });
});

describe("compatibilidad y aislamiento", () => {
  it("un cliente anterior no envía p_mezcla", () => {
    const preparado = prepararDatosRegistro(entradaRegistro());
    assert.equal(preparado.error, "");
    assert.equal(preparado.datos.mezcla, null);
    const args = argumentosRpcRegistro(preparado.datos);
    assert.equal(Object.hasOwn(args, "p_mezcla"), false);
    assert.equal(Object.hasOwn(args, "p_fotos"), false);
  });

  it("mantiene pH, EC y PPM coherentes con los parámetros", () => {
    const agregado = fusionarMedicionesMezcla([], { ph: 6.2, ec: null, ppm: 400 });
    assert.equal(agregado.error, "");
    assert.deepEqual(
      agregado.parametros.map((item) => item.clave_nativa),
      ["ph", "ppm"]
    );

    const igual = fusionarMedicionesMezcla(
      [
        {
          origen: "nativa",
          clave_nativa: "ph",
          nombre: "pH",
          tipo_valor: "numero",
          valor_numero: 6.2,
          valor_texto: null,
          unidad: null,
        },
      ],
      { ph: 6.2, ec: null, ppm: null }
    );
    assert.equal(igual.parametros.length, 1);

    const conflicto = fusionarMedicionesMezcla(
      [
        {
          origen: "nativa",
          clave_nativa: "ph",
          nombre: "pH",
          tipo_valor: "numero",
          valor_numero: 6.5,
          valor_texto: null,
          unidad: null,
        },
      ],
      { ph: 6.2, ec: null, ppm: null }
    );
    assert.equal(conflicto.error, "El pH de la mezcla no coincide con el parámetro.");

    const preparado = prepararDatosRegistro(
      entradaRegistro({
        mezcla: {
          receta_id: null,
          volumen_agua: 4,
          unidad_volumen: "L",
          ph: 6.1,
          ec: null,
          ppm: null,
          componentes: [],
          origen: null,
        },
      })
    );
    assert.equal(preparado.error, "");
    assert.equal(preparado.datos.parametros[0].clave_nativa, "ph");
    assert.equal(preparado.datos.parametros[0].valor_numero, 6.1);
    assert.equal(argumentosRpcRegistro(preparado.datos).p_mezcla.volumen_agua, 4);
  });

  it("rechaza productos y recetas de otro usuario, y el acceso anónimo", () => {
    assert.equal(referenciasDeOtroUsuario({ usuarioId: null, productos: [] }), "No hay sesión.");
    assert.equal(
      referenciasDeOtroUsuario({
        usuarioId: USUARIO,
        receta: { usuario_id: OTRO },
        productos: [],
      }),
      "No se puede usar una receta de otro usuario."
    );
    const ajeno = validarReceta(
      {
        usuarioId: USUARIO,
        nombre: "Base",
        volumenAgua: 10,
        unidadVolumen: "L",
        componentes: [{ productoId: PRODUCTO, cantidad: 1, unidad: "g" }],
      },
      [{ id: PRODUCTO, usuario_id: OTRO, activo: true }]
    );
    assert.equal(ajeno.error, "No se puede usar un producto de otro usuario.");
    assert.equal(
      validarPayloadMezcla(
        { volumen_agua: 1, unidad_volumen: "L", componentes: [], origen: null },
        { acciones: [], aplicaA: "plantas" }
      ).error,
      "La mezcla requiere un riego o una fertilización."
    );
    assert.equal(
      validarPayloadMezcla(
        { volumen_agua: 1, unidad_volumen: "L", componentes: [], origen: null },
        { acciones: RIEGO, aplicaA: "ambiente" }
      ).error,
      "Una medición ambiental no lleva mezcla."
    );
  });
});

describe("sql de mezclas", () => {
  const sql = fs.readFileSync(new URL("../supabase/mezclas.sql", import.meta.url), "utf8");

  it("reemplaza las firmas sin CASCADE y aísla el catálogo", () => {
    assert.doesNotMatch(sql, /drop\s+(table|function|policy|trigger|schema)\b[^;]*\bcascade\b/i);
    assert.match(
      sql,
      /drop function if exists public\.crear_registro\(text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb\)/
    );
    assert.match(
      sql,
      /drop function if exists public\.editar_registro\(uuid, text, text, uuid, uuid, text, text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb\)/
    );
    assert.match(sql, /p_mezcla jsonb default null/);
    assert.match(sql, /registro_id uuid not null unique/);
    assert.match(sql, /on delete restrict/);
    assert.match(sql, /on delete set null/);
    assert.match(sql, /revoke all on public\.productos_cultivo from public, anon, authenticated/);
    assert.match(sql, /revoke all on function public\.crear_registro\([\s\S]*?\) from public, anon/);
    assert.match(sql, /if usuario is null then/);
    assert.match(sql, /No se puede usar un producto de otro usuario/);
    assert.match(sql, /No se puede usar una receta de otro usuario/);
    assert.match(sql, /if not v_riego then/);
    assert.doesNotMatch(sql, /historial_mezclas/);
    assert.doesNotMatch(sql, /update\s+public\.registro_mezcla/i);
    assert.match(sql, /insert into public\.registro_mezcla_componentes/);
  });
});
