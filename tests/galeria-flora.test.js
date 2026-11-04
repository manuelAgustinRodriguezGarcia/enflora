import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { compararFotosGaleria } from "../lib/flora-galeria-fotos.js";
import {
  SELECT_GALERIA_FLORA,
  TAMANO_MAXIMO_PAGINA_GALERIA,
  TAMANO_PAGINA_GALERIA,
  anexarFotosGaleria,
  cortarPaginaGaleria,
  etiquetaUnidadGaleria,
  filtrosTrasCambioEspacio,
  hayFiltrosGaleria,
  hrefRegistroGaleria,
  leerContextosGaleria,
  leerPaginaGaleria,
  leerRutaMiniaturaGaleria,
  limitePaginaGaleria,
  mapearFilaGaleria,
  mensajeGaleriaFlora,
  normalizarFiltrosGaleria,
  opcionesEspaciosGaleria,
  opcionesUnidadesGaleria,
  publicarFotosGaleria,
  textoLugarGaleria,
} from "../lib/galeria-flora.js";
import { esRutaApp, esRutaPublica, DESTINOS_MAS, DESTINOS_NAVEGACION } from "../lib/navegacion.js";

const RAIZ = path.resolve(import.meta.dirname, "..");
const USUARIO = "11111111-1111-4111-8111-111111111111";
const OTRO = "99999999-9999-4999-8999-999999999999";
const ESPACIO = "22222222-2222-4222-8222-222222222222";
const ESPACIO_B = "44444444-4444-4444-8444-444444444444";
const UNIDAD = "33333333-3333-4333-8333-333333333333";
const UNIDAD_B = "55555555-5555-4555-8555-555555555555";
const FOTO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const FOTO_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const FOTO_C = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const FOTO_D = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const FOTO_E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function leer(relativo) {
  return fs.readFileSync(path.join(RAIZ, relativo), "utf8");
}

function clienteMock(resolver) {
  const consultas = [];
  return {
    consultas,
    from(tabla) {
      const estado = { tabla, ops: [] };
      consultas.push(estado);
      const cadena = {
        select(columnas, opciones) {
          estado.ops.push(["select", columnas, opciones ?? null]);
          return cadena;
        },
        eq(columna, valor) {
          estado.ops.push(["eq", columna, valor]);
          return cadena;
        },
        order(columna, opciones) {
          estado.ops.push(["order", columna, opciones ?? null]);
          return cadena;
        },
        or(filtro) {
          estado.ops.push(["or", filtro]);
          return cadena;
        },
        limit(cantidad) {
          estado.ops.push(["limit", cantidad]);
          return cadena;
        },
        range(desde, hasta) {
          estado.ops.push(["range", desde, hasta]);
          return cadena;
        },
        maybeSingle() {
          estado.ops.push(["maybeSingle"]);
          return Promise.resolve(resolver(estado));
        },
        then(ok, err) {
          return Promise.resolve(resolver(estado)).then(ok, err);
        },
      };
      return cadena;
    },
  };
}

function valoresEq(estado, columna) {
  return estado.ops.filter((op) => op[0] === "eq" && op[1] === columna).map((op) => op[2]);
}

function esConteo(estado) {
  return estado.ops.some((op) => op[0] === "select" && op[2]?.head);
}

function filaFoto(id, fecha, { espacioId = ESPACIO, unidadId = UNIDAD, espacio = "Indoor", unidad = "Carpa" } = {}) {
  return {
    id,
    ruta_miniatura: `${USUARIO}/registros/${id}_m.webp`,
    ruta: `${USUARIO}/registros/${id}.webp`,
    portada_ruta: `${USUARIO}/portadas/${unidadId}/x.webp`,
    ancho: 1200,
    alto: 800,
    registro_id: "66666666-6666-4666-8666-666666666666",
    registro: {
      id: "66666666-6666-4666-8666-666666666666",
      fecha_evento: fecha,
      espacio_id: espacioId,
      unidad_cultivo_id: unidadId,
      espacio: { id: espacioId, nombre: espacio },
      unidad: { id: unidadId, nombre: unidad },
    },
  };
}

test("la galería no mezcla portadas ni la ruta original en el listado", () => {
  assert.doesNotMatch(SELECT_GALERIA_FLORA, /portada/);
  assert.match(SELECT_GALERIA_FLORA, /ruta_miniatura/);
  assert.equal(/\bruta\b/.test(SELECT_GALERIA_FLORA.replaceAll("ruta_miniatura", "")), false);
  const foto = mapearFilaGaleria(filaFoto(FOTO_A, "2026-05-02T00:00:00.000Z"));
  assert.equal(foto.portada_ruta, undefined);
  assert.equal(foto.ruta, undefined);
  assert.equal(foto.espacio_nombre, "Indoor");
  assert.equal(foto.unidad_nombre, "Carpa");
});

test("filtros rechazan identificadores inválidos y detectan combinación", () => {
  assert.equal(normalizarFiltrosGaleria({ espacioId: "no" }).ok, false);
  assert.equal(normalizarFiltrosGaleria({ unidadId: "no" }).ok, false);
  assert.deepEqual(normalizarFiltrosGaleria({ espacioId: ESPACIO, unidadId: UNIDAD }), {
    ok: true,
    espacioId: ESPACIO,
    unidadId: UNIDAD,
  });
  assert.equal(hayFiltrosGaleria({}), false);
  assert.equal(hayFiltrosGaleria({ espacioId: ESPACIO }), true);
  assert.equal(limitePaginaGaleria(undefined), TAMANO_PAGINA_GALERIA);
  assert.equal(limitePaginaGaleria(500), TAMANO_MAXIMO_PAGINA_GALERIA);
});

test("cambiar de espacio limpia la unidad que ya no pertenece", () => {
  const unidades = [
    { id: UNIDAD, espacio_id: ESPACIO, nombre: "Carpa", espacio_nombre: "Indoor" },
    { id: UNIDAD_B, espacio_id: ESPACIO_B, nombre: "Balcón", espacio_nombre: "Exterior" },
  ];
  assert.deepEqual(filtrosTrasCambioEspacio({ espacioId: ESPACIO_B, unidadId: UNIDAD, unidades }), {
    espacioId: ESPACIO_B,
    unidadId: "",
  });
  assert.deepEqual(filtrosTrasCambioEspacio({ espacioId: ESPACIO, unidadId: UNIDAD, unidades }), {
    espacioId: ESPACIO,
    unidadId: UNIDAD,
  });
  assert.deepEqual(filtrosTrasCambioEspacio({ espacioId: "", unidadId: UNIDAD_B, unidades }), {
    espacioId: "",
    unidadId: UNIDAD_B,
  });
});

test("las unidades se identifican con su espacio cuando no hay filtro de espacio", () => {
  const unidades = [
    { id: UNIDAD_B, espacio_id: ESPACIO_B, nombre: "Balcón", espacio_nombre: "Exterior", numero: 1 },
    { id: UNIDAD, espacio_id: ESPACIO, nombre: "Carpa", espacio_nombre: "Indoor", numero: 2 },
  ];
  assert.deepEqual(
    opcionesUnidadesGaleria(unidades, "").map((item) => item.etiqueta),
    ["Balcón · Exterior", "Carpa · Indoor"],
  );
  assert.deepEqual(
    opcionesUnidadesGaleria(unidades, ESPACIO).map((item) => item.etiqueta),
    ["Carpa"],
  );
  assert.equal(etiquetaUnidadGaleria({ nombre: "Carpa" }, { conEspacio: true }), "Carpa");
  assert.deepEqual(opcionesEspaciosGaleria([{ id: ESPACIO_B, nombre: "Exterior" }, { id: ESPACIO, nombre: "Indoor" }]).map((item) => item.etiqueta), [
    "Exterior",
    "Indoor",
  ]);
});

test("la paginación no repite fotos y desempatan por id", () => {
  const filas = [
    { id: FOTO_A, fecha_evento: "2026-05-01T00:00:00.000Z" },
    { id: FOTO_B, fecha_evento: "2026-05-01T00:00:00.000Z" },
    { id: FOTO_C, fecha_evento: "2026-04-01T00:00:00.000Z" },
    { id: FOTO_D, fecha_evento: "2026-06-01T00:00:00.000Z" },
    { id: FOTO_E, fecha_evento: "2026-04-01T00:00:00.000Z" },
  ].sort(compararFotosGaleria);

  const primera = cortarPaginaGaleria(filas, null, 2);
  const segunda = cortarPaginaGaleria(filas, primera.cursor, 2);
  const tercera = cortarPaginaGaleria(filas, segunda.cursor, 2);
  const ids = [...primera.fotos, ...segunda.fotos, ...tercera.fotos].map((foto) => foto.id);

  assert.deepEqual(ids, [FOTO_D, FOTO_B, FOTO_A, FOTO_E, FOTO_C]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(tercera.hayMas, false);
  assert.deepEqual(
    anexarFotosGaleria(primera.fotos, [...segunda.fotos, primera.fotos[0]]).map((foto) => foto.id),
    [FOTO_D, FOTO_B, FOTO_A, FOTO_E],
  );
});

test("mensajes, lugar y enlace al registro", () => {
  assert.match(mensajeGaleriaFlora({ sinFotos: true }), /registros/);
  assert.match(mensajeGaleriaFlora({ sinCoincidencias: true }), /filtros/);
  assert.equal(mensajeGaleriaFlora({ error: "No se pudieron cargar las fotos." }), "No se pudieron cargar las fotos.");
  assert.equal(textoLugarGaleria({ unidad_nombre: "Carpa hidro", espacio_nombre: "Casa delfi" }), "Carpa hidro en Casa delfi");
  assert.equal(textoLugarGaleria({ unidad_nombre: "Carpa hidro" }), "Carpa hidro");
  assert.equal(textoLugarGaleria({ espacio_nombre: "Casa delfi" }), "Casa delfi");
  assert.equal(hrefRegistroGaleria(FOTO_A), `/registros?editar=${FOTO_A}`);
  assert.equal(hrefRegistroGaleria("no-es-uuid"), "");
});

test("publicar fotos firma solo la miniatura y no expone la ruta", () => {
  const foto = mapearFilaGaleria(filaFoto(FOTO_A, "2026-05-02T00:00:00.000Z"));
  const [publica] = publicarFotosGaleria([foto], new Map([[foto.ruta_miniatura, "https://firmada.example/mini"]]));
  assert.equal(publica.url_miniatura, "https://firmada.example/mini");
  assert.equal(Object.hasOwn(publica, "ruta_miniatura"), false);
  assert.equal(Object.hasOwn(publica, "ruta"), false);
  assert.equal(publicarFotosGaleria([foto], new Map())[0].url_miniatura, "");
});

test("la consulta de todas las fotos pagina por fecha del registro y usuario", async () => {
  const filas = [
    filaFoto(FOTO_C, "2026-04-01T00:00:00.000Z"),
    filaFoto(FOTO_A, "2026-05-01T00:00:00.000Z"),
    filaFoto(FOTO_B, "2026-05-01T00:00:00.000Z"),
  ];
  const supabase = clienteMock((estado) => {
    if (esConteo(estado)) return { count: 3, error: null, data: null };
    return { data: filas, error: null };
  });

  const pagina = await leerPaginaGaleria(supabase, USUARIO, { limite: 2 });
  const lista = supabase.consultas.find((consulta) => consulta.tabla === "registro_fotos" && !esConteo(consulta));
  const conteo = supabase.consultas.find((consulta) => consulta.tabla === "registro_fotos" && esConteo(consulta));

  assert.equal(pagina.ok, true);
  assert.deepEqual(pagina.fotos.map((foto) => foto.id), [FOTO_B, FOTO_A]);
  assert.equal(pagina.hay_mas, true);
  assert.equal(pagina.total, 3);
  assert.deepEqual(valoresEq(lista, "usuario_id"), [USUARIO]);
  assert.deepEqual(valoresEq(conteo, "usuario_id"), [USUARIO]);
  assert.equal(lista.ops.find((op) => op[0] === "select")[1], SELECT_GALERIA_FLORA);
  assert.deepEqual(lista.ops.find((op) => op[0] === "range")?.slice(1), [0, 999]);
  assert.equal(lista.ops.some((op) => op[0] === "or"), false);

  const porDefecto = clienteMock(() => ({ data: [], count: 0, error: null }));
  await leerPaginaGaleria(porDefecto, USUARIO, {});
  const listaDefecto = porDefecto.consultas.find((consulta) => consulta.tabla === "registro_fotos" && !esConteo(consulta));
  assert.deepEqual(listaDefecto.ops.find((op) => op[0] === "range")?.slice(1), [0, 999]);
  assert.equal(supabase.consultas.some((consulta) => /portada/.test(JSON.stringify(consulta.ops))), false);
});

test("los filtros de espacio y unidad se aplican juntos y el cursor no se repite", async () => {
  const cursor = { fecha_evento: "2026-05-01T00:00:00.000Z", id: FOTO_B };
  const supabase = clienteMock((estado) => {
    if (estado.tabla === "espacios") return { data: { id: ESPACIO }, error: null };
    if (estado.tabla === "unidades_cultivo") return { data: { id: UNIDAD, espacio_id: ESPACIO }, error: null };
    if (esConteo(estado)) return { count: 4, error: null };
    return {
      data: [
        filaFoto(FOTO_C, "2026-06-01T00:00:00.000Z"),
        filaFoto(FOTO_B, "2026-05-01T00:00:00.000Z"),
        filaFoto(FOTO_A, "2026-04-01T00:00:00.000Z"),
      ],
      error: null,
    };
  });

  const pagina = await leerPaginaGaleria(supabase, USUARIO, {
    espacioId: ESPACIO,
    unidadId: UNIDAD,
    cursorFecha: cursor.fecha_evento,
    cursorId: cursor.id,
    limite: 2,
  });
  const lista = supabase.consultas.find((consulta) => consulta.tabla === "registro_fotos" && !esConteo(consulta));

  assert.equal(pagina.ok, true);
  assert.deepEqual(valoresEq(lista, "registro.espacio_id"), [ESPACIO]);
  assert.deepEqual(valoresEq(lista, "registro.unidad_cultivo_id"), [UNIDAD]);
  assert.deepEqual(valoresEq(lista, "usuario_id"), [USUARIO]);
  assert.equal(lista.ops.some((op) => op[0] === "or"), false);
  assert.deepEqual(pagina.fotos.map((foto) => foto.id), [FOTO_A]);
  assert.equal(pagina.hay_mas, false);
});

test("un espacio de otra persona no consulta fotografías", async () => {
  const supabase = clienteMock((estado) => {
    if (estado.tabla === "espacios") return { data: null, error: null };
    return { data: [filaFoto(FOTO_A, "2026-05-01T00:00:00.000Z")], error: null };
  });

  const pagina = await leerPaginaGaleria(supabase, USUARIO, { espacioId: ESPACIO_B });
  assert.equal(pagina.ok, true);
  assert.deepEqual(pagina.fotos, []);
  assert.equal(supabase.consultas.some((consulta) => consulta.tabla === "registro_fotos"), false);
  assert.deepEqual(
    valoresEq(supabase.consultas.find((consulta) => consulta.tabla === "espacios"), "usuario_id"),
    [USUARIO],
  );
});

test("una unidad ajena o incompatible con el espacio no devuelve fotos", async () => {
  const ajena = clienteMock(() => ({ data: null, error: null }));
  const sinFila = await leerPaginaGaleria(ajena, USUARIO, { unidadId: UNIDAD_B });
  assert.equal(sinFila.ok, true);
  assert.equal(sinFila.unidad_invalida, false);
  assert.equal(ajena.consultas.some((consulta) => consulta.tabla === "registro_fotos"), false);

  const cruce = clienteMock((estado) => {
    if (estado.tabla === "espacios") return { data: { id: ESPACIO }, error: null };
    if (estado.tabla === "unidades_cultivo") return { data: { id: UNIDAD_B, espacio_id: ESPACIO_B }, error: null };
    return { data: [filaFoto(FOTO_A, "2026-05-01T00:00:00.000Z")], error: null };
  });
  const pagina = await leerPaginaGaleria(cruce, USUARIO, { espacioId: ESPACIO, unidadId: UNIDAD_B });
  assert.equal(pagina.unidad_invalida, true);
  assert.deepEqual(pagina.fotos, []);
  assert.equal(cruce.consultas.some((consulta) => consulta.tabla === "registro_fotos"), false);
});

test("cursor inválido e identificadores ajenos no arman la consulta de fotos", async () => {
  const supabase = clienteMock(() => ({ data: [], error: null }));
  const cursor = await leerPaginaGaleria(supabase, USUARIO, { cursorFecha: "2026-01-01", cursorId: "no" });
  const filtros = await leerPaginaGaleria(supabase, USUARIO, { espacioId: "otro" });
  const sesion = await leerPaginaGaleria(supabase, "nadie", {});
  assert.equal(cursor.ok, false);
  assert.equal(filtros.ok, false);
  assert.equal(sesion.ok, false);
  assert.equal(supabase.consultas.length, 0);
});

test("la miniatura se resuelve solo para una foto del usuario", async () => {
  const supabase = clienteMock((estado) => {
    const usuario = valoresEq(estado, "usuario_id")[0];
    const id = valoresEq(estado, "id")[0];
    if (usuario !== USUARIO || id !== FOTO_A) return { data: null, error: null };
    return { data: { ruta_miniatura: `${USUARIO}/registros/${FOTO_A}_m.webp` }, error: null };
  });

  const propia = await leerRutaMiniaturaGaleria(supabase, USUARIO, FOTO_A);
  const ajena = await leerRutaMiniaturaGaleria(supabase, OTRO, FOTO_A);
  assert.equal(propia.ok, true);
  assert.match(propia.ruta, /_m\.webp$/);
  assert.equal(ajena.ok, false);
  assert.equal(supabase.consultas.every((consulta) => consulta.tabla === "registro_fotos"), true);
  assert.equal(supabase.consultas.every((consulta) => valoresEq(consulta, "usuario_id").length === 1), true);
  assert.doesNotMatch(JSON.stringify(supabase.consultas), /portada/);
});

test("los contextos de filtro salen de espacios y unidades, no de portadas", async () => {
  const supabase = clienteMock((estado) => {
    if (estado.tabla === "espacios") return { data: [{ id: ESPACIO, nombre: "Indoor" }], error: null };
    return {
      data: [{ id: UNIDAD, nombre: "Carpa", espacio_id: ESPACIO, numero: 1, espacio: { nombre: "Indoor" } }],
      error: null,
    };
  });
  const contextos = await leerContextosGaleria(supabase);
  assert.equal(contextos.ok, true);
  assert.equal(contextos.unidades[0].espacio_nombre, "Indoor");
  assert.doesNotMatch(JSON.stringify(supabase.consultas), /portada/);
});

test("la ruta de galería exige sesión y no entra en la navegación inferior", () => {
  assert.equal(esRutaPublica("/galeria"), false);
  assert.equal(esRutaApp("/galeria"), true);
  assert.equal(DESTINOS_NAVEGACION.some((item) => item.href === "/galeria"), false);
  assert.equal(DESTINOS_MAS.some((item) => item.href === "/galeria"), true);

  const pagina = leer("app/galeria/page.js");
  const acciones = leer("app/galeria/acciones.js");
  const servidor = leer("lib/galeria-flora-servidor.js");
  const visor = leer("componentes/galeria/visor-galeria-flora.js");
  const panel = leer("componentes/galeria/panel-galeria-flora.js");
  const estilos = leer("estilos/paginas/_galeria.scss");
  const inicio = leer("componentes/inicio/panel-inicio.js");

  assert.match(pagina, /redirect\("\/ingreso"\)/);
  assert.match(pagina, /listarPaginaGaleria/);
  assert.match(acciones, /acceso\.user\.id/);
  assert.match(acciones, /TAMANO_PAGINA_GALERIA/);
  assert.doesNotMatch(acciones, /entrada\?\.usuario|entrada\.usuarioId|SERVICE_ROLE/);
  assert.match(servidor, /firmarRutas/);
  assert.match(servidor, /SEGUNDOS_URL_MINIATURA/);
  assert.match(servidor, /publicarFotosGaleria/);
  assert.doesNotMatch(`${pagina}\n${acciones}\n${servidor}`, /SERVICE_ROLE|portada_ruta|createSignedUrl/);
  assert.match(visor, /yet-another-react-lightbox\/plugins\/zoom/);
  assert.match(visor, /imageFit:\s*"contain"/);
  assert.match(visor, /closeOnEscape:\s*true/);
  assert.match(visor, /noScroll/);
  assert.match(visor, /urlFotoOriginal/);
  assert.match(visor, /hrefRegistroGaleria/);
  assert.match(visor, /Close:\s*"Cerrar"/);
  assert.doesNotMatch(visor, /createSignedUrl|portada_ruta|disableSwipeNavigation:\s*true/);
  assert.match(panel, /IntersectionObserver/);
  assert.match(panel, /filtrosTrasCambioEspacio/);
  assert.match(panel, /anexarFotosGaleria/);
  assert.match(inicio, /href="\/galeria"/);
  assert.match(estilos, /repeat\(3,/);
  assert.match(estilos, /repeat\(4,/);
  assert.match(estilos, /repeat\(5,/);
  assert.match(estilos, /repeat\(6,/);
  assert.match(estilos, /object-fit:\s*cover/);
  assert.match(estilos, /gap:\s*3px/);
  assert.match(estilos, /prefers-reduced-motion:\s*reduce/);
  assert.match(estilos, /backdrop-filter:\s*blur\(18px\)/);
  assert.match(estilos, /animation:\s*none/);
});
