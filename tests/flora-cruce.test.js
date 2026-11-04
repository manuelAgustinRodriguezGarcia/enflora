import assert from "node:assert/strict";
import test from "node:test";
import { llamadaCubiertaPorRelacion, relacionAlcanzaParaResponder } from "../lib/flora-analisis.js";
import { relacionarEvolucion } from "../lib/flora-cruce.js";
import { DECLARACIONES_HERRAMIENTAS_GEMINI, ejecutarHerramientaFlora } from "../lib/flora-herramientas-gemini.js";
import { INSTRUCCION_SISTEMA_FLORA_BASE } from "../lib/flora-sistema-instrucciones.js";

function parametro(clave, valor, unidad) {
  return {
    origen: "nativa",
    clave_nativa: clave,
    nombre: clave,
    tipo_valor: "numero",
    valor_numero: valor,
    unidad,
  };
}

function accion(clave) {
  return { origen: "nativa", clave_nativa: clave, nombre: clave };
}

function componente(nombre, productoId = "prod-1") {
  return {
    nombre_producto: nombre,
    fabricante: "Aceptacion",
    producto_id: productoId,
    cantidad_receta: 2,
    unidad_receta: "ml/L",
    cantidad_aplicada: 20,
    unidad_aplicada: "ml",
    orden: 1,
  };
}

function mezcla(nombre, producto, productoId) {
  return {
    nombre_receta: nombre,
    volumen_agua: 10,
    unidad_volumen: "L",
    ph: null,
    ec: null,
    ppm: null,
    registro_mezcla_componentes: [componente(producto, productoId)],
  };
}

function registro({ id, fecha, acciones = [], parametros = [], mezclaAplicada = null }) {
  return {
    id,
    fecha_evento: fecha,
    registro_acciones: acciones,
    registro_parametros: parametros,
    registro_mezclas: mezclaAplicada,
  };
}

const ETAPAS = [
  { etapa: "germinacion", etapa_nombre: "Germinación", fechaInicio: "2026-08-01", fechaFin: "2026-09-01" },
  { etapa: "vegetativo", etapa_nombre: "Vegetativo", fechaInicio: "2026-09-01", fechaFin: "2026-09-20" },
  { etapa: "enflora", etapa_nombre: "Enflora", fechaInicio: "2026-09-20", fechaFin: null },
];

test("los últimos tres riegos conservan el orden, las dosis y el pH real", () => {
  const registros = [
    registro({ id: "viejo", fecha: "2026-09-01T15:00:00.000Z", acciones: [accion("riego")] }),
    registro({ id: "ph-antes", fecha: "2026-10-01T12:00:00.000Z", parametros: [parametro("ph", 5.8, "")] }),
    registro({
      id: "riego-1",
      fecha: "2026-10-01T15:00:00.000Z",
      acciones: [accion("riego")],
      mezclaAplicada: mezcla("Mezcla uno", "Base Vieja"),
    }),
    registro({ id: "ph-medio", fecha: "2026-10-02T15:00:00.000Z", parametros: [parametro("ph", 6.1, "")] }),
    registro({
      id: "riego-2",
      fecha: "2026-10-05T15:00:00.000Z",
      acciones: [accion("riego"), accion("fertilizacion")],
      parametros: [parametro("ph", 6.4, "")],
      mezclaAplicada: mezcla("Mezcla dos", "Base Nueva"),
    }),
    registro({ id: "ph-despues", fecha: "2026-10-06T15:00:00.000Z", parametros: [parametro("ph", 6.6, "")] }),
    registro({ id: "ph-raro", fecha: "2026-10-07T15:00:00.000Z", parametros: [parametro("ph", 33, "")] }),
    registro({ id: "riego-3", fecha: "2026-10-08T15:00:00.000Z", acciones: [accion("riego")] }),
  ];

  const cruce = relacionarEvolucion(registros, {
    modo: "despues_de_accion",
    claveAccion: "riego",
    claveParametro: "ph",
    cantidad: 3,
  });

  assert.equal(cruce.eventos.length, 3);
  assert.equal(cruce.anteriores_no_incluidos, 1);
  assert.equal(cruce.eventos[0].fecha_local, "2026-10-01");
  assert.equal(cruce.eventos[0].hora_local, "12:00");
  assert.equal(cruce.eventos[0].anterior.valor_almacenado, 5.8);
  assert.equal(cruce.eventos[0].posterior.valor_almacenado, 6.1);
  assert.equal(cruce.eventos[0].delta, 0.3);
  assert.equal(cruce.eventos[0].productos[0].nombre_producto, "Base Vieja");
  assert.deepEqual(cruce.eventos[0].productos[0].dosis_por_litro, { cantidad: 2, unidad: "ml/L" });
  assert.deepEqual(cruce.eventos[0].productos[0].cantidad_absoluta, { cantidad: 20, unidad: "ml" });
  assert.equal(cruce.eventos[0].volumen_preparado.cantidad, 10);
  assert.equal(cruce.eventos[0].volumen_preparado.significado, "agua_preparada");
  assert.equal(cruce.eventos[1].simultanea.valor_almacenado, 6.4);
  assert.equal(cruce.eventos[1].posterior.valor_almacenado, 6.6);
  assert.equal(cruce.eventos[1].delta, 0.2);
  assert.equal(cruce.eventos[1].productos[0].nombre_producto, "Base Nueva");
  assert.equal(cruce.eventos[2].anterior.estado, "sospechoso");
  assert.equal(cruce.eventos[2].anterior.valor_almacenado, 33);
  assert.equal(cruce.eventos[2].anterior.correccion, "no_aplicada");
  assert.equal(cruce.eventos[2].anterior.usable_en_calculo, false);
  assert.equal(cruce.eventos[2].anterior.revision, "manual");
  assert.equal(Object.hasOwn(cruce.eventos[2].anterior, "valor_corregido"), false);
  assert.equal(JSON.stringify(cruce.eventos[2]).includes("3.3"), false);
  assert.equal(cruce.eventos[2].posterior, null);
  assert.equal(cruce.eventos[2].delta, null);
  assert.equal(cruce.eventos[2].comparable, false);
  assert.equal(cruce.eventos[2].evidencia, "parcial");
  assert.equal(cruce.eventos[2].motivo_sin_delta, "medicion_sospechosa");
  assert.equal(cruce.politica_mediciones.correccion_automatica, "prohibida");
  assert.equal(cruce.politica_mediciones.valores_corregidos, "ausentes");
  assert.equal(cruce.cobertura.solicitados, 3);
  assert.equal(cruce.cobertura.encontrados, 3);
  assert.equal(cruce.cobertura.anteriores_en_ventana, 1);
  assert.equal(cruce.cobertura.existencia, "hay_anteriores_en_la_ventana");
  assert.equal(cruce.cobertura.variaciones, "calculadas");
  assert.equal(cruce.cobertura.se_puede_afirmar_ausencia, true);
  assert.equal(cruce.eventos[0].atribucion, "no_determinada");
  assert.equal(cruce.eventos[0].relacion, "temporal");
  assert.equal(Object.hasOwn(cruce.eventos[0], "causa"), false);
  assert.match(cruce.nota, /no demuestra/);
});

test("un riego sin mediciones cercanas queda como información insuficiente", () => {
  const cruce = relacionarEvolucion(
    [registro({ id: "solo", fecha: "2026-10-03T15:00:00.000Z", acciones: [accion("riego")] })],
    { modo: "despues_de_accion", claveAccion: "riego", claveParametro: "ph", cantidad: 3 },
  );
  assert.equal(cruce.eventos[0].evidencia, "insuficiente");
  assert.equal(cruce.eventos[0].motivo_sin_delta, "medicion_ausente");
  assert.equal(cruce.cobertura.variaciones, "insuficientes");
  assert.equal(cruce.cobertura.existencia, "no_hay_mas_en_el_periodo");
  assert.equal(cruce.cobertura.se_puede_afirmar_ausencia, true);
  assert.equal(cruce.eventos[0].anterior, null);
  assert.equal(cruce.eventos[0].posterior, null);
  assert.equal(cruce.eventos[0].delta, null);
});

test("los productos anteriores a un aumento de EC salen del intervalo y no de otra unidad", () => {
  const registros = [
    registro({ id: "ec-1", fecha: "2026-10-01T15:00:00.000Z", parametros: [parametro("ec", 1, "mS/cm")] }),
    registro({
      id: "calcio",
      fecha: "2026-10-02T15:00:00.000Z",
      acciones: [accion("fertilizacion")],
      mezclaAplicada: mezcla("Calcio", "Calcio", "prod-calcio"),
    }),
    registro({ id: "ec-2", fecha: "2026-10-03T15:00:00.000Z", parametros: [parametro("ec", 1.4, "mS/cm")] }),
    registro({ id: "us-1", fecha: "2026-10-10T15:00:00.000Z", parametros: [parametro("ec", 1.2, "mS/cm")] }),
    registro({ id: "us-2", fecha: "2026-10-11T15:00:00.000Z", parametros: [parametro("ec", 800, "µS/cm")] }),
  ];
  const cruce = relacionarEvolucion(registros, { modo: "antes_de_variacion", claveParametro: "ec" });
  assert.equal(cruce.variacion.desde.valor_almacenado, 1);
  assert.equal(cruce.variacion.hasta.valor_almacenado, 1.4);
  assert.equal(cruce.variacion.delta, 0.4);
  assert.equal(cruce.variacion.atribucion, "no_determinada");
  assert.equal(cruce.productos_entre_mediciones.length, 1);
  assert.equal(cruce.productos_entre_mediciones[0].productos[0].nombre_producto, "Calcio");
  assert.equal(cruce.unidades_incompatibles.length, 1);
  assert.equal(cruce.unidades_incompatibles[0].desde.unidad, "mS/cm");
  assert.equal(cruce.unidades_incompatibles[0].hasta.unidad, "µS/cm");
});

test("dos etapas comparan solo mediciones compatibles y dejan el día límite en la etapa que empieza", () => {
  const registros = [
    registro({ id: "v1", fecha: "2026-09-10T15:00:00.000Z", parametros: [parametro("ph", 5.8, "")] }),
    registro({ id: "v-raro", fecha: "2026-09-12T15:00:00.000Z", parametros: [parametro("ph", 33, "")] }),
    registro({ id: "v2", fecha: "2026-09-15T15:00:00.000Z", parametros: [parametro("ph", 6, "")] }),
    registro({
      id: "limite",
      fecha: "2026-09-20T15:00:00.000Z",
      parametros: [parametro("ph", 6.2, "")],
      acciones: [accion("fertilizacion")],
      mezclaAplicada: mezcla("Cambio", "Base Nueva", "prod-nueva"),
    }),
    registro({ id: "e2", fecha: "2026-10-01T15:00:00.000Z", parametros: [parametro("ph", 6.4, "")] }),
  ];
  const entre = relacionarEvolucion(registros, {
    modo: "entre_etapas",
    claveParametro: "ph",
    etapa: "vegetativo",
    etapaB: "enflora",
    etapas: ETAPAS,
  });
  assert.equal(entre.etapa_a.estadisticas.promedio, 5.9);
  assert.equal(entre.etapa_a.sospechosos, 1);
  assert.equal(entre.etapa_b.estadisticas.promedio, 6.3);
  assert.equal(entre.diferencia_promedio, 0.4);
  assert.equal(entre.comparable, true);
  assert.equal(entre.etapa_b.productos[0].nombre_producto, "Base Nueva");
  assert.equal(entre.atribucion, "no_determinada");

  const vacia = relacionarEvolucion(registros, {
    modo: "durante_etapa",
    claveParametro: "ph",
    etapa: "germinacion",
    etapas: ETAPAS,
  });
  assert.equal(vacia.sin_datos, true);
  assert.equal(vacia.mediciones.length, 0);
});

test("una serie incompatible no inventa un promedio ni una conversión", () => {
  const cruce = relacionarEvolucion(
    [
      registro({ id: "a", fecha: "2026-10-01T15:00:00.000Z", parametros: [parametro("ec", 1.2, "mS/cm")] }),
      registro({ id: "b", fecha: "2026-10-02T15:00:00.000Z", parametros: [parametro("ec", 800, "µS/cm")] }),
    ],
    { modo: "antes_de_variacion", claveParametro: "ec" },
  );
  assert.equal(cruce.variacion, null);
  assert.equal(cruce.sin_datos, true);
  assert.equal(cruce.unidades_incompatibles.length, 1);
});

test("relacionar evolución exige sesión y rechaza un modo desconocido", async () => {
  const sinSesion = await ejecutarHerramientaFlora(
    { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
    "relacionar_evolucion_cultivo",
    { modo: "despues_de_accion", clave_nativa_accion: "riego", clave_parametro: "ph" },
  );
  assert.match(sinSesion.error, /sesión/i);

  const modo = await ejecutarHerramientaFlora(
    { auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) } },
    "relacionar_evolucion_cultivo",
    { modo: "causar", clave_parametro: "ph" },
  );
  assert.match(modo.error, /modo/i);
  assert.equal(relacionAlcanzaParaResponder({ tipoConsulta: "evolucion_cultivo", datos: {} }), true);
  assert.equal(llamadaCubiertaPorRelacion("consultar_parametros", true), true);
  assert.equal(llamadaCubiertaPorRelacion("consultar_parametros", false), false);
  assert.match(INSTRUCCION_SISTEMA_FLORA_BASE, /relacionar_evolucion_cultivo/);
  assert.match(INSTRUCCION_SISTEMA_FLORA_BASE, /no_determinada/);
  assert.match(INSTRUCCION_SISTEMA_FLORA_BASE, /valor_almacenado/);
  assert.match(INSTRUCCION_SISTEMA_FLORA_BASE, /se_puede_afirmar_ausencia/);
  assert.match(INSTRUCCION_SISTEMA_FLORA_BASE, /sin obtener_contexto_cultivo antes/);
  const contexto = DECLARACIONES_HERRAMIENTAS_GEMINI.find((item) => item.name === "obtener_contexto_cultivo");
  assert.equal(contexto.description.includes("Usar al inicio"), false);
  assert.match(contexto.description, /ni antes de relacionar_evolucion_cultivo/);
});

test("una ventana incompleta no afirma que falten riegos", () => {
  const uno = [
    registro({ id: "riego", fecha: "2026-10-08T15:00:00.000Z", acciones: [accion("riego")] }),
  ];
  const indeterminada = relacionarEvolucion(uno, {
    modo: "despues_de_accion",
    claveAccion: "riego",
    claveParametro: "ph",
    cantidad: 3,
    ventana: "parcial",
  });
  assert.equal(indeterminada.cobertura.encontrados, 1);
  assert.equal(indeterminada.cobertura.existencia, "indeterminada");
  assert.equal(indeterminada.cobertura.se_puede_afirmar_ausencia, false);
  assert.match(indeterminada.cobertura.nota, /no se puede afirmar/i);

  const conSonda = relacionarEvolucion(uno, {
    modo: "despues_de_accion",
    claveAccion: "riego",
    claveParametro: "ph",
    cantidad: 3,
    ventana: "parcial",
    sonda: { fechas: ["2026-10-08T15:00:00.000Z", "2026-09-01T15:00:00.000Z"], completa: true },
  });
  assert.equal(conSonda.cobertura.existencia, "hay_eventos_fuera_de_la_ventana");
  assert.deepEqual(conSonda.cobertura.fuera_de_ventana, ["2026-09-01T15:00:00.000Z"]);
  assert.equal(conSonda.cobertura.se_puede_afirmar_ausencia, false);
  assert.equal(conSonda.eventos.length, 1);

  const confirmada = relacionarEvolucion(uno, {
    modo: "despues_de_accion",
    claveAccion: "riego",
    claveParametro: "ph",
    cantidad: 3,
    ventana: "parcial",
    sonda: { fechas: ["2026-10-08T15:00:00.000Z"], completa: true },
  });
  assert.equal(confirmada.cobertura.existencia, "no_hay_mas_en_el_periodo");
  assert.equal(confirmada.cobertura.se_puede_afirmar_ausencia, true);
});
