import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { argumentosRpcRegistro, prepararDatosRegistro } from "../lib/registros.js";
import {
  cantidadAplicada,
  litrosDe,
  mililitrosDe,
} from "../lib/mezclas/calculo.js";
import { detalleMezcla, textoResumenReceta } from "../lib/mezclas/presentacion.js";
import {
  aplicarRecetaEnBorrador,
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
const PRODUCTO_C = "99999999-9999-4999-8999-999999999999";
const PRODUCTO_D = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
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
    assert.deepEqual(
      cantidadAplicada({ cantidad: 2, unidad: "gotas/L", volumenAgua: 3, unidadVolumen: "L" }),
      { cantidad: 6, unidad: "gotas" }
    );
    assert.equal(
      cantidadAplicada({ cantidad: 2, unidad: "gotas/L", volumenAgua: "", unidadVolumen: "L" }),
      null
    );
    assert.deepEqual(
      cantidadAplicada({ cantidad: 4, unidad: "gotas", volumenAgua: 10, unidadVolumen: "L" }),
      { cantidad: 4, unidad: "gotas" }
    );
    assert.equal(
      detalleMezcla({
        nombre_receta: "Base",
        volumen_agua: 10,
        unidad_volumen: "L",
        registro_mezcla_componentes: [
          {
            nombre_producto: "Gotero",
            cantidad_aplicada: 6,
            unidad_aplicada: "gotas",
            cantidad_receta: 2,
            unidad_receta: "gotas/L",
          },
        ],
      }).componentes[0].texto,
      "Gotero · 6 gotas (2 gotas/L)"
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
    assert.equal(validarProducto({ nombre: "A", tipo: "otro" }).error, "Escribí el nombre de la categoría.");
    const propia = validarProducto({ nombre: "A", tipo: "otro", categoria: "Micorrizas" });
    assert.equal(propia.error, "");
    assert.equal(propia.producto.tipo, "Micorrizas");
    assert.equal(validarProducto({ nombre: "A", tipo: "enzimas" }).producto.tipo, "enzimas");
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

  it("acepta coma decimal y rechaza filas incompletas, duplicadas, negativas o en cero", () => {
    const propios = [{ id: PRODUCTO, usuario_id: USUARIO, activo: true }];
    const coma = validarReceta(
      {
        nombre: "Crecimiento",
        volumenAgua: "10",
        unidadVolumen: "L",
        componentes: [{ productoId: PRODUCTO, cantidad: "0,5", unidad: "ml/L" }],
      },
      propios
    );
    assert.equal(coma.error, "");
    assert.equal(coma.receta.componentes[0].cantidad, 0.5);
    assert.equal(coma.receta.componentes[0].unidad, "ml/L");

    assert.equal(
      validarReceta({
        nombre: "Crecimiento",
        volumenAgua: "10",
        unidadVolumen: "L",
        componentes: [{ productoId: "", cantidad: "", unidad: "ml/L" }],
      }).error,
      "Completá el producto y la cantidad de cada fila."
    );
    assert.equal(
      validarReceta(
        {
          nombre: "Crecimiento",
          volumenAgua: "10",
          unidadVolumen: "L",
          componentes: [{ productoId: PRODUCTO, cantidad: "0", unidad: "gotas" }],
        },
        propios
      ).error,
      "La cantidad del componente no es válida."
    );
    assert.equal(
      validarReceta(
        {
          nombre: "Crecimiento",
          volumenAgua: "10",
          unidadVolumen: "L",
          componentes: [{ productoId: PRODUCTO, cantidad: "-2", unidad: "ml" }],
        },
        propios
      ).error,
      "La cantidad del componente no es válida."
    );
    assert.equal(
      validarReceta(
        {
          nombre: "Crecimiento",
          volumenAgua: "10",
          unidadVolumen: "L",
          componentes: [
            { productoId: PRODUCTO, cantidad: "1", unidad: "ml/L" },
            { productoId: PRODUCTO, cantidad: "2", unidad: "g" },
          ],
        },
        propios
      ).error,
      "Hay un componente duplicado."
    );
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

  it("suma productos sueltos sin cambiar la receta y permite dosis sin volumen", () => {
    const suelto = construirPayloadMezcla({
      borrador: {
        ...mezclaVacia(),
        incluir: true,
        componentes: [{ productoId: PRODUCTO, cantidad: "4", unidad: "gotas" }],
      },
      acciones: RIEGO,
      aplicaA: "plantas",
      habiaMezcla: false,
    });
    assert.equal(suelto.error, "");
    assert.equal(suelto.mezcla.volumen_agua, null);
    assert.equal(suelto.mezcla.receta_id, null);
    assert.equal(suelto.mezcla.componentes[0].cantidad, 4);
    assert.equal(suelto.mezcla.componentes[0].unidad, "gotas");

    const receta = {
      id: RECETA,
      nombre: "Base",
      volumen_agua: 10,
      unidad_volumen: "L",
      componentes: [{ producto_id: PRODUCTO, cantidad: 2, unidad: "ml/L" }],
    };
    const extra = {
      ...mezclaVacia(),
      incluir: true,
      componentes: [{ productoId: PRODUCTO_B, cantidad: "1", unidad: "g" }],
    };
    const aplicado = aplicarRecetaEnBorrador(extra, receta);
    assert.equal(aplicado.aviso, "");
    assert.equal(aplicado.borrador.recetaId, RECETA);
    assert.equal(aplicado.borrador.componentes.length, 2);
    assert.equal(aplicado.borrador.origen.componentes.length, 1);

    const choque = aplicarRecetaEnBorrador(
      {
        ...mezclaVacia(),
        incluir: true,
        componentes: [{ productoId: PRODUCTO, cantidad: "3", unidad: "ml" }],
      },
      receta
    );
    assert.equal(choque.aviso, "Ese producto ya está en la mezcla.");
    assert.deepEqual(
      choque.borrador.componentes.map((item) => item.productoId),
      [PRODUCTO]
    );

    const sinReceta = aplicarRecetaEnBorrador(aplicado.borrador, null);
    assert.equal(sinReceta.borrador.recetaId, "");
    assert.equal(sinReceta.borrador.componentes.length, 1);
    assert.equal(sinReceta.borrador.componentes[0].productoId, PRODUCTO_B);

    const historico = congelarComponente(
      { id: PRODUCTO, nombre: "Fertilizante A", fabricante: null, tipo: "fertilizantes_nutrientes" },
      {
        cantidad_aplicada: 20,
        unidad_aplicada: "ml",
        cantidad_receta: 2,
        unidad_receta: "ml/L",
      }
    );
    receta.componentes[0].cantidad = 9;
    receta.componentes[0].unidad = "g/L";
    assert.equal(historico.cantidad_receta, 2);
    assert.equal(historico.unidad_receta, "ml/L");
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
      "No se puede usar una mezcla de otro usuario."
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

describe("resumen de la mezcla", () => {
  it("junta el producto con el agua en mililitros o litros", () => {
    const productos = [
      { id: PRODUCTO, nombre: "Fish Mix" },
      { id: PRODUCTO_B, nombre: "Calmag" },
    ];
    assert.equal(
      textoResumenReceta(
        {
          volumen_agua: 2,
          unidad_volumen: "L",
          componentes: [{ producto_id: PRODUCTO, orden: 0, cantidad: 4, unidad: "ml/L" }],
        },
        productos
      ),
      "Fish Mix + 2 L agua"
    );
    assert.equal(
      textoResumenReceta(
        {
          volumen_agua: 500,
          unidad_volumen: "ml",
          componentes: [
            { producto_id: PRODUCTO, orden: 0, cantidad: 4, unidad: "ml" },
            { producto_id: PRODUCTO_B, orden: 1, cantidad: 1, unidad: "g" },
          ],
        },
        productos
      ),
      "Fish Mix, Calmag + 500 ml agua"
    );
    assert.equal(
      textoResumenReceta({ volumen_agua: null, unidad_volumen: "L", componentes: [] }, productos),
      ""
    );
  });
});

describe("volumen usado al preparar", () => {
  function recetaDeDiezLitros() {
    return {
      id: RECETA,
      nombre: "Base",
      volumen_agua: 10,
      unidad_volumen: "L",
      componentes: [
        { producto_id: PRODUCTO, orden: 0, cantidad: 2, unidad: "ml/L" },
        { producto_id: PRODUCTO_B, orden: 1, cantidad: 1.5, unidad: "g/L" },
        { producto_id: PRODUCTO_C, orden: 2, cantidad: 3, unidad: "gotas/L" },
      ],
    };
  }

  it("conserva la dosis de una receta de 10 L al prepararla en 20 L", () => {
    const receta = recetaDeDiezLitros();
    const copia = structuredClone(receta);
    const elegido = aplicarRecetaEnBorrador(mezclaVacia(), receta);
    const preparado = { ...elegido.borrador, volumen: "20" };

    assert.equal(preparado.volumen, "20");
    assert.equal(mezclaAjustada(preparado), false);
    assert.deepEqual(receta, copia);
    assert.deepEqual(
      preparado.componentes.map(({ cantidad, unidad }) => ({ cantidad, unidad })),
      [
        { cantidad: 2, unidad: "ml/L" },
        { cantidad: 1.5, unidad: "g/L" },
        { cantidad: 3, unidad: "gotas/L" },
      ]
    );

    assert.deepEqual(cantidadAplicada({ cantidad: 2, unidad: "ml/L", volumenAgua: "20", unidadVolumen: "L" }), {
      cantidad: 40,
      unidad: "ml",
    });
    assert.deepEqual(cantidadAplicada({ cantidad: 1.5, unidad: "g/L", volumenAgua: "20", unidadVolumen: "L" }), {
      cantidad: 30,
      unidad: "g",
    });
    assert.deepEqual(cantidadAplicada({ cantidad: 3, unidad: "gotas/L", volumenAgua: "20", unidadVolumen: "L" }), {
      cantidad: 60,
      unidad: "gotas",
    });
    assert.deepEqual(cantidadAplicada({ cantidad: 2, unidad: "ml/L", volumenAgua: "20,5", unidadVolumen: "L" }), {
      cantidad: 41,
      unidad: "ml",
    });

    const payload = construirPayloadMezcla({
      borrador: {
        ...preparado,
        componentes: [...preparado.componentes, { productoId: PRODUCTO_D, cantidad: "4", unidad: "gotas" }],
      },
      acciones: RIEGO,
      aplicaA: "plantas",
      habiaMezcla: false,
    });
    assert.equal(payload.error, "");
    assert.equal(payload.mezcla.volumen_agua, 20);
    assert.equal(payload.mezcla.receta_id, RECETA);
    assert.equal(payload.mezcla.origen.componentes.length, 3);
    assert.deepEqual(
      payload.mezcla.componentes.map(({ cantidad, unidad }) => ({ cantidad, unidad })),
      [
        { cantidad: 2, unidad: "ml/L" },
        { cantidad: 1.5, unidad: "g/L" },
        { cantidad: 3, unidad: "gotas/L" },
        { cantidad: 4, unidad: "gotas" },
      ]
    );
    assert.deepEqual(receta, copia);

    const reabierto = borradorDesdeSnapshot({
      receta_id: RECETA,
      volumen_agua: 20,
      unidad_volumen: "L",
      origen: {
        componentes: receta.componentes.map(({ producto_id, cantidad, unidad }) => ({ producto_id, cantidad, unidad })),
      },
      registro_mezcla_componentes: [
        {
          producto_id: PRODUCTO,
          orden: 0,
          cantidad_aplicada: 40,
          unidad_aplicada: "ml",
          cantidad_receta: 2,
          unidad_receta: "ml/L",
        },
        {
          producto_id: PRODUCTO_B,
          orden: 1,
          cantidad_aplicada: 30,
          unidad_aplicada: "g",
          cantidad_receta: 1.5,
          unidad_receta: "g/L",
        },
        {
          producto_id: PRODUCTO_C,
          orden: 2,
          cantidad_aplicada: 60,
          unidad_aplicada: "gotas",
          cantidad_receta: 3,
          unidad_receta: "gotas/L",
        },
      ],
    });
    assert.equal(reabierto.volumen, "20");
    assert.equal(mezclaAjustada(reabierto), false);
    assert.deepEqual(
      reabierto.componentes.map(({ cantidad, unidad }) => ({ cantidad, unidad })),
      [
        { cantidad: 2, unidad: "ml/L" },
        { cantidad: 1.5, unidad: "g/L" },
        { cantidad: 3, unidad: "gotas/L" },
      ]
    );

    const historial = detalleMezcla({
      nombre_receta: "Base",
      volumen_agua: 20,
      unidad_volumen: "L",
      registro_mezcla_componentes: [
        {
          nombre_producto: "Líquido",
          cantidad_aplicada: 40,
          unidad_aplicada: "ml",
          cantidad_receta: 2,
          unidad_receta: "ml/L",
        },
        {
          nombre_producto: "Polvo",
          cantidad_aplicada: 30,
          unidad_aplicada: "g",
          cantidad_receta: 1.5,
          unidad_receta: "g/L",
        },
        {
          nombre_producto: "Gotero",
          cantidad_aplicada: 60,
          unidad_aplicada: "gotas",
          cantidad_receta: 3,
          unidad_receta: "gotas/L",
        },
      ],
    });
    assert.deepEqual(
      historial.componentes.map((item) => item.texto),
      ["Líquido · 40 ml (2 ml/L)", "Polvo · 30 g (1,5 g/L)", "Gotero · 60 gotas (3 gotas/L)"]
    );
  });

  it("no multiplica ml, g ni gotas y no inventa un total sin volumen", () => {
    for (const unidad of ["ml", "g", "gotas"]) {
      assert.deepEqual(
        cantidadAplicada({ cantidad: 5, unidad, volumenAgua: 20, unidadVolumen: "L" }),
        { cantidad: 5, unidad }
      );
    }

    const absolutas = construirPayloadMezcla({
      borrador: {
        ...mezclaVacia(),
        incluir: true,
        volumen: "20",
        unidadVolumen: "L",
        componentes: [
          { productoId: PRODUCTO, cantidad: "5", unidad: "ml" },
          { productoId: PRODUCTO_B, cantidad: "2", unidad: "g" },
          { productoId: PRODUCTO_C, cantidad: "8", unidad: "gotas" },
        ],
      },
      acciones: RIEGO,
      aplicaA: "plantas",
      habiaMezcla: false,
    });
    assert.deepEqual(
      absolutas.mezcla.componentes.map(({ cantidad, unidad }) => ({ cantidad, unidad })),
      [
        { cantidad: 5, unidad: "ml" },
        { cantidad: 2, unidad: "g" },
        { cantidad: 8, unidad: "gotas" },
      ]
    );

    assert.equal(
      cantidadAplicada({ cantidad: 2, unidad: "ml/L", volumenAgua: "", unidadVolumen: "L" }),
      null
    );
    assert.equal(
      cantidadAplicada({ cantidad: 1.5, unidad: "g/L", volumenAgua: null, unidadVolumen: "L" }),
      null
    );
    assert.equal(
      cantidadAplicada({ cantidad: 3, unidad: "gotas/L", volumenAgua: undefined, unidadVolumen: "L" }),
      null
    );

    const sinVolumen = construirPayloadMezcla({
      borrador: {
        ...mezclaVacia(),
        incluir: true,
        componentes: [
          { productoId: PRODUCTO, cantidad: "2", unidad: "ml/L" },
          { productoId: PRODUCTO_B, cantidad: "1,5", unidad: "g/L" },
          { productoId: PRODUCTO_C, cantidad: "3", unidad: "gotas/L" },
        ],
      },
      acciones: RIEGO,
      aplicaA: "plantas",
      habiaMezcla: false,
    });
    assert.equal(sinVolumen.error, "");
    assert.equal(sinVolumen.mezcla.volumen_agua, null);
    assert.deepEqual(
      sinVolumen.mezcla.componentes.map(({ cantidad, unidad }) => ({ cantidad, unidad })),
      [
        { cantidad: 2, unidad: "ml/L" },
        { cantidad: 1.5, unidad: "g/L" },
        { cantidad: 3, unidad: "gotas/L" },
      ]
    );

    const texto = detalleMezcla({
      nombre_receta: null,
      volumen_agua: null,
      unidad_volumen: "L",
      registro_mezcla_componentes: [
        {
          nombre_producto: "Líquido",
          cantidad_aplicada: 2,
          unidad_aplicada: "ml/L",
          cantidad_receta: 2,
          unidad_receta: "ml/L",
        },
      ],
    }).componentes[0].texto;
    assert.equal(texto, "Líquido · 2 ml/L");

    const dosisGuardada = borradorDesdeSnapshot({
      volumen_agua: 20,
      unidad_volumen: "L",
      registro_mezcla_componentes: [
        {
          producto_id: PRODUCTO,
          orden: 0,
          cantidad_aplicada: 2,
          unidad_aplicada: "ml/L",
          cantidad_receta: 2,
          unidad_receta: "ml/L",
        },
        {
          producto_id: PRODUCTO_B,
          orden: 1,
          cantidad_aplicada: 5,
          unidad_aplicada: "ml",
          cantidad_receta: 5,
          unidad_receta: "ml",
        },
      ],
    });
    assert.equal(dosisGuardada.componentes[0].cantidad, 2);
    assert.equal(dosisGuardada.componentes[0].unidad, "ml/L");
    assert.equal(dosisGuardada.componentes[1].cantidad, 5);
    assert.equal(dosisGuardada.componentes[1].unidad, "ml");
  });

  it("el riego no reescribe la receta y usa PackageOpen", () => {
    const fuente = fs.readFileSync(new URL("../componentes/seccion-mezcla-registro.js", import.meta.url), "utf8");
    assert.match(fuente, /import \{ PackageOpen \} from "lucide-react"/);
    assert.match(fuente, /<PackageOpen[\s\S]*?\/>\s*Agregar producto/);
    assert.doesNotMatch(fuente, /guardarRecetaMezcla/);
    assert.doesNotMatch(fuente, /required/);
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
    assert.match(sql, /No se puede usar una mezcla de otro usuario/);
    assert.match(sql, /if not v_riego then/);
    assert.doesNotMatch(sql, /historial_mezclas/);
    assert.doesNotMatch(sql, /update\s+public\.registro_mezcla/i);
    assert.match(sql, /insert into public\.registro_mezcla_componentes/);
    assert.match(sql, /create or replace function public\.eliminar_receta_mezcla\(p_id uuid\)/);
    assert.match(sql, /grant execute on function public\.eliminar_receta_mezcla\(uuid\) to authenticated/);
    assert.match(sql, /delete from public\.recetas_mezcla/);
  });
});

describe("sql de dosis", () => {
  const sql = fs.readFileSync(new URL("../supabase/mezclas-dosis.sql", import.meta.url), "utf8");

  it("agrega gotas sin CASCADE y no convierte gotas a mililitros", () => {
    assert.doesNotMatch(sql, /drop\s+(table|function|policy|trigger|schema)\b[^;]*\bcascade\b/i);
    assert.match(sql, /drop constraint if exists receta_componentes_unidad_valida/);
    assert.match(sql, /alter column volumen_agua drop not null/);
    assert.match(sql, /volumen_agua is null or \(volumen_agua > 0/);
    assert.match(sql, /'gotas\/L'/);
    assert.match(sql, /v_unidad = 'gotas\/L' and v_litros is not null/);
    assert.match(sql, /v_unidad_aplicada := 'gotas'/);
    assert.doesNotMatch(sql, /gotas\/L'[\s\S]{0,80}v_unidad_aplicada := 'ml'/);
    assert.match(sql, /usuario_id = p_usuario/);
    assert.match(sql, /usuario_id = usuario/);
    assert.match(sql, /if usuario is null then/);
    assert.match(sql, /v_litros := case when v_unidad_volumen = 'L' then v_volumen else v_volumen \/ 1000 end/);
    assert.doesNotMatch(sql, /recetas_mezcla\.volumen_agua/);
    assert.match(
      sql,
      /elsif v_unidad in \('ml', 'g', 'L', 'gotas', 'ml\/L', 'g\/L', 'gotas\/L'\) then\s+v_aplicada := round\(v_cantidad, 4\);/
    );
    assert.doesNotMatch(sql, /update\s+public\.registro_mezcla/i);
    const migracion = sql.slice(0, sql.indexOf("create or replace function"));
    assert.doesNotMatch(migracion, /\b(insert|update|delete)\b/i);
    const guardar = sql.slice(sql.indexOf("create or replace function public.guardar_receta_mezcla"));
    assert.doesNotMatch(guardar, /registro_mezcla/);
    assert.match(guardar, /where id = v_id\s+and usuario_id = usuario/);
  });
});
