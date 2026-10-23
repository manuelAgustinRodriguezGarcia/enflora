import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { leerFilasCsv, parsearCsvHistorial, parsearManifest } from "../lib/demo/historial/parsear-growndona.js";
import {
  accionEnflora,
  etapaEnFecha,
  etapaEnflora,
  medicionesEnflora,
  normalizarHistorial,
  problemasDatasetPublico,
  seriePorParametro,
} from "../lib/demo/historial/normalizar-historial.js";
import { HISTORIAL_RDWC1 } from "../lib/demo/historial/rdwc1-dataset.js";
import {
  agruparPorMes,
  diasFiltrados,
  etapasConRegistros,
  fechaLarga,
  fotosDeDia,
  historialParaCiclo,
  mesDeFecha,
  tarjetasResumen,
  textoDiaCultivo,
  textoMedicion,
  textoMedicionCompleto,
} from "../lib/demo/historial/historial-demo.js";
import { crearEstadoDemo, normalizarEstadoDemo, reducirDemo } from "../lib/demo/estado-demo.js";
import { esEtapa } from "../lib/etapas.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function leer(relativo) {
  return readFileSync(path.join(RAIZ, relativo), "utf8");
}

function csvDe(objeto) {
  const json = JSON.stringify(objeto).replace(/"/g, '""');
  return `historial_completo\n"${json}"\n`;
}

const EXPORTADO = {
  cultivo: {
    id: "7d4f2a90-1111-4bbb-8ccc-000000000001",
    user_id: "7d4f2a90-2222-4bbb-8ccc-000000000002",
    name: "Prueba #1",
    method: "RDWC",
    medium: "Lana de roca",
    genetics: "Genética X",
    status: "active",
    start_date: "2026-07-26",
    end_date: null,
    plant_count: 2,
    cover_image_url: "user/cover.jpg",
    description: "  Descripción  ",
  },
  etapas: [
    { type: "flowering", name: "Floración", start_date: "2026-09-19", end_date: null },
    { type: "vegetative", name: "Crecimiento", start_date: "2026-07-26", end_date: "2026-09-19" },
  ],
  plantas: [
    { id: "p2", number: 2, genetics: null },
    { id: "p1", number: 1, genetics: "Genética X" },
  ],
  geneticas: [],
  problemas: [],
  registros: [
    {
      entrada: { id: "e2", notes: "Día 1 flora", entry_date: "2026-09-19" },
      acciones: [{ type: "defoliation", notes: "Saqué hojas", title: null }],
      mediciones: [{ ec: 2150, ph: 6.3, ppm: 1070, humidity: 60, temperature: 24.6 }],
      fotografias: [{ storage_path: "user/b.jpg", created_at: "2026-09-19T10:00:00Z", caption: null }],
      riegos: [],
    },
    {
      entrada: { id: "e1", notes: "Noté algas\r\n", entry_date: "2026-08-13" },
      acciones: [],
      mediciones: [{ ec: 530, ph: 5.5, ppm: 265, humidity: 60, temperature: 21.8 }],
      fotografias: [
        { storage_path: "user/a2.jpg", created_at: "2026-08-13T12:00:00Z", caption: "Segunda" },
        { storage_path: "user/a1.jpg", created_at: "2026-08-13T09:00:00Z", caption: null },
        { storage_path: "user/perdida.jpg", created_at: "2026-08-13T13:00:00Z", caption: null },
      ],
      riegos: [],
    },
  ],
};

const FOTOS_LOCALES = {
  "user/a1.jpg": "aaaaaaaaaaa1",
  "user/a2.jpg": "aaaaaaaaaaa2",
  "user/b.jpg": "bbbbbbbbbbbb",
  "user/cover.jpg": "cccccccccccc",
};

function resolverFotoPrueba(storagePath) {
  const clave = FOTOS_LOCALES[storagePath];
  if (!clave) return null;
  return {
    clave,
    url: `/demo/historial/prueba/fotos/${clave}.webp`,
    miniatura: `/demo/historial/prueba/thumbs/${clave}.webp`,
    ancho: 900,
    alto: 1200,
    anchoMiniatura: 360,
    altoMiniatura: 480,
  };
}

function normalizarPrueba(extra = {}) {
  return normalizarHistorial({ exportado: EXPORTADO, resolverFoto: resolverFotoPrueba, fechaCorte: "2026-10-23", ...extra });
}

test("lee CSV con comillas escapadas, saltos de línea y BOM", () => {
  const filas = leerFilasCsv('\uFEFFa,b\n"x ""y"",\nz",2\r\n');
  assert.deepEqual(filas, [
    ["a", "b"],
    ['x "y",\nz', "2"],
  ]);
});

test("parsea el CSV exportado y devuelve el JSON del historial", () => {
  const exportado = parsearCsvHistorial(csvDe(EXPORTADO));
  assert.equal(exportado.cultivo.name, "Prueba #1");
  assert.equal(exportado.registros.length, 2);
});

test("rechaza CSV sin la columna esperada, con varias filas o con JSON inválido", () => {
  assert.throws(() => parsearCsvHistorial("otra\n{}\n"), /historial_completo/);
  assert.throws(() => parsearCsvHistorial('historial_completo\n"{}"\n"{}"\n'), /más de una fila/);
  assert.throws(() => parsearCsvHistorial("historial_completo\n{no-json}\n"), /JSON válido/);
  assert.throws(() => parsearCsvHistorial(csvDe({ cultivo: {}, etapas: [] })), /Faltan secciones/);
});

test("parsea el manifest y descarta entradas incompletas o con error", () => {
  const lista = parsearManifest([
    { tipo: "entry", estado: "ok", storage_path: "u/a.jpg", archivo_local: "x/a.jpeg", sha256: "s1", fecha_registro: "2026-08-13", daily_entry_id: "e1" },
    { tipo: "cover", estado: "ok", storage_path: "u/c.jpg", archivo_local: "x/c.jpeg", sha256: "s2" },
    { tipo: "entry", estado: "error", storage_path: "u/b.jpg", archivo_local: "x/b.jpeg" },
    { tipo: "entry", estado: "ok", storage_path: "u/d.jpg" },
  ]);
  assert.deepEqual(
    lista.map((item) => [item.tipo, item.storagePath]),
    [
      ["registro", "u/a.jpg"],
      ["portada", "u/c.jpg"],
    ]
  );
  assert.throws(() => parsearManifest({}), /no es una lista/);
});

test("traduce etapas, acciones y mediciones al vocabulario de Enflora", () => {
  assert.equal(etapaEnflora("vegetative", "Crecimiento"), "vegetativo");
  assert.equal(etapaEnflora("flowering", "Floración"), "enflora");
  assert.equal(etapaEnflora("", "Secado"), "secado");
  assert.equal(etapaEnflora("", "Desconocida"), "");
  assert.deepEqual(accionEnflora({ type: "solution_change", notes: " nota ", title: null }), {
    tipo: "cambio_solucion",
    etiqueta: "Cambio de solución",
    nota: "nota",
  });
  assert.equal(accionEnflora({ type: "rarisima" }).etiqueta, "Otra acción");
  assert.deepEqual(medicionesEnflora([{ temperature: "24.66", humidity: 60, ph: 5.555, ec: null, ppm: "" }]), [
    { parametro: "temperatura", valor: 24.7 },
    { parametro: "humedad", valor: 60 },
    { parametro: "ph", valor: 5.56 },
  ]);
});

test("normaliza el historial con días numerados desde el inicio y etapas por fecha", () => {
  const historial = normalizarPrueba();
  assert.equal(historial.cultivo.nombre, "Prueba #1");
  assert.equal(historial.cultivo.estado, "en_curso");
  assert.equal(historial.cultivo.descripcion, "Descripción");
  assert.equal(historial.cultivo.diaActual, 89);
  assert.equal(historial.cultivo.etapaActual, "enflora");
  assert.deepEqual(
    historial.etapas.map((etapa) => [etapa.id, etapa.etapa, etapa.diaInicio, etapa.diaFin, etapa.duracion, etapa.actual]),
    [
      ["etapa-1", "vegetativo", 0, 55, 55, false],
      ["etapa-2", "enflora", 55, null, 34, true],
    ]
  );
  assert.deepEqual(
    historial.dias.map((dia) => [dia.dia, dia.fecha, dia.etapa, dia.nota]),
    [
      [18, "2026-08-13", "vegetativo", "Noté algas"],
      [55, "2026-09-19", "enflora", "Día 1 flora"],
    ]
  );
  assert.equal(etapaEnFecha(historial.etapas, "2026-09-18").etapa, "vegetativo");
  assert.equal(etapaEnFecha(historial.etapas, "2026-09-19").etapa, "enflora");
  assert.equal(etapaEnFecha(historial.etapas, "2026-07-01"), null);
  assert.deepEqual(
    historial.plantas.map((planta) => [planta.id, planta.genetica]),
    [
      ["planta-1", "Genética X"],
      ["planta-2", "Genética X"],
    ]
  );
});

test("asocia cada foto a su día, respeta el orden de captura y omite las que faltan", () => {
  const historial = normalizarPrueba();
  const [agosto, septiembre] = historial.dias;
  assert.deepEqual(agosto.fotos, ["foto-aaaaaaaaaaa1", "foto-aaaaaaaaaaa2"]);
  assert.deepEqual(septiembre.fotos, ["foto-bbbbbbbbbbbb"]);
  assert.equal(historial.fotos.length, 3);
  const segunda = historial.fotos.find((foto) => foto.id === "foto-aaaaaaaaaaa2");
  assert.equal(segunda.descripcion, "Segunda");
  assert.equal(segunda.diaId, "dia-2026-08-13");
  assert.equal(segunda.dia, 18);
  assert.equal(historial.cultivo.portada.id, "foto-cccccccccccc");
  assert.equal(historial.cultivo.portada.tipo, "portada");
  assert.equal(historial.resumen.fotos, 4);
  assert.equal(historial.resumen.fotosDeRegistros, 3);
  assert.equal(historial.resumen.diasConFotos, 2);
  assert.deepEqual(fotosDeDia(historial, agosto).map((foto) => foto.id), agosto.fotos);
});

test("calcula resumen, métricas y series por parámetro", () => {
  const historial = normalizarPrueba();
  assert.equal(historial.resumen.mediciones, 10);
  assert.equal(historial.resumen.acciones, 1);
  assert.equal(historial.resumen.diasConNota, 2);
  assert.deepEqual(historial.resumen.rango, { desde: "2026-08-13", hasta: "2026-09-19" });
  assert.equal(historial.metricas.temperatura.minimo, 21.8);
  assert.equal(historial.metricas.temperatura.maximo, 24.6);
  assert.equal(historial.metricas.temperatura.promedio, 23.2);
  assert.equal(historial.metricas.ec.cantidad, 2);
  assert.deepEqual(
    seriePorParametro(historial, "ph").map((punto) => [punto.dia, punto.valor]),
    [
      [18, 5.5],
      [55, 6.3],
    ]
  );
});

test("falla con registros duplicados para una misma fecha y sin fecha de inicio", () => {
  const duplicado = {
    ...EXPORTADO,
    registros: [...EXPORTADO.registros, { ...EXPORTADO.registros[0], fotografias: [] }],
  };
  assert.throws(() => normalizarHistorial({ exportado: duplicado, resolverFoto: resolverFotoPrueba }), /más de un registro/);
  assert.throws(
    () => normalizarHistorial({ exportado: { ...EXPORTADO, cultivo: { ...EXPORTADO.cultivo, start_date: null } } }),
    /fecha de inicio/
  );
});

test("el dataset normalizado no filtra identificadores, correos, rutas ni referencias del origen", () => {
  const historial = normalizarPrueba();
  assert.deepEqual(problemasDatasetPublico(historial), []);
  const texto = JSON.stringify(historial);
  assert.doesNotMatch(texto, /user_id|storage_path|daily_entry_id|cover_image_url/);
  assert.doesNotMatch(texto, /7d4f2a90/);
  assert.doesNotMatch(texto, /user\/(a1|a2|b|cover)\.jpg/);
});

test("detecta datasets con datos sensibles o enlaces rotos", () => {
  const historial = normalizarPrueba();
  const conCorreo = { ...historial, cultivo: { ...historial.cultivo, descripcion: "escribime a alguien@correo.com" } };
  assert.match(problemasDatasetPublico(conCorreo).join(" "), /correo electrónico/);
  const conRuta = { ...historial, cultivo: { ...historial.cultivo, notasFinales: "C:\\Users\\alguien\\fotos" } };
  assert.match(problemasDatasetPublico(conRuta).join(" "), /ruta privada/);
  const fotoRota = { ...historial, dias: [{ ...historial.dias[0], fotos: ["foto-inexistente"] }, historial.dias[1]] };
  assert.match(problemasDatasetPublico(fotoRota).join(" "), /foto inexistente/);
  const fotoFuera = {
    ...historial,
    fotos: [{ ...historial.fotos[0], url: "/private/growndona/x.jpg" }, ...historial.fotos.slice(1)],
  };
  assert.match(problemasDatasetPublico(fotoFuera).join(" "), /carpeta pública/);
});

test("el dataset público versionado es coherente y no contiene datos privados", () => {
  const historial = HISTORIAL_RDWC1;
  assert.equal(historial.version, 1);
  assert.equal(historial.cultivo.id, "rdwc1");
  assert.equal(historial.cultivo.nombre, "RDWC #1");
  assert.equal(historial.cultivo.estado, "en_curso");
  assert.equal(historial.cultivo.etapaActual, "enflora");
  assert.ok(historial.cultivo.portada);
  assert.equal(historial.dias.length, historial.resumen.diasRegistrados);
  assert.ok(historial.dias.length >= 60);
  assert.equal(historial.fotos.length, historial.resumen.fotosDeRegistros);
  assert.equal(historial.resumen.fotos, historial.fotos.length + 1);
  assert.ok(historial.resumen.mediciones >= 300);
  assert.equal(historial.etapas.length, 2);
  assert.ok(historial.etapas.every((etapa) => esEtapa(etapa.etapa)));
  assert.ok(historial.dias.every((dia) => esEtapa(dia.etapa)));
  assert.ok(historial.dias.every((dia, indice) => indice === 0 || dia.fecha > historial.dias[indice - 1].fecha));
  assert.ok(historial.dias.every((dia) => Number.isInteger(dia.dia) && dia.dia >= 0));
  assert.deepEqual(problemasDatasetPublico(historial), []);
  for (const clave of ["temperatura", "humedad", "ph", "ec", "ppm"]) {
    assert.ok(historial.metricas[clave], `falta la métrica ${clave}`);
    assert.ok(seriePorParametro(historial, clave).length > 1);
  }
});

test("cada imagen referenciada por el dataset existe en public/ y es un WebP optimizado", () => {
  const historial = HISTORIAL_RDWC1;
  const urls = new Set();
  for (const foto of historial.fotos) {
    urls.add(foto.url);
    urls.add(foto.miniatura);
  }
  urls.add(historial.cultivo.portada.url);
  urls.add(historial.cultivo.portada.miniatura);
  for (const url of urls) {
    assert.match(url, /^\/demo\/historial\/rdwc1\/.+\.webp$/);
    const archivo = path.join(RAIZ, "public", ...url.split("/").filter(Boolean));
    assert.ok(existsSync(archivo), `falta ${url}`);
    assert.ok(statSync(archivo).size > 0, `vacío ${url}`);
  }
  const fotos = readdirSync(path.join(RAIZ, "public", "demo", "historial", "rdwc1", "fotos"));
  assert.equal(fotos.length, historial.fotos.length);
  assert.ok(fotos.every((nombre) => /^\d{4}-\d{2}-\d{2}-[0-9a-f]{12}\.webp$/.test(nombre)));
  const fotoGrande = historial.fotos.reduce((mayor, foto) => (foto.ancho > mayor.ancho ? foto : mayor), historial.fotos[0]);
  assert.ok(Math.max(fotoGrande.ancho, fotoGrande.alto) <= 1200);
  assert.ok(historial.fotos.every((foto) => Math.max(foto.anchoMiniatura, foto.altoMiniatura) <= 480));
});

test("los originales privados siguen fuera del repositorio y del dataset", () => {
  const gitignore = leer(".gitignore");
  assert.match(gitignore, /^private\/$/m);
  const dataset = leer("lib/demo/historial/rdwc1-dataset.js");
  assert.doesNotMatch(dataset, /private[\\/]/);
  assert.doesNotMatch(dataset, /growndona|supabase/i);
  assert.doesNotMatch(dataset, /\.csv/);
  assert.doesNotMatch(dataset, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const publico = path.join(RAIZ, "public", "demo", "historial");
  const entradas = readdirSync(publico, { recursive: true }).map(String);
  assert.ok(entradas.every((nombre) => !/\.(csv|json)$/i.test(nombre)));
});

test("los módulos del historial no dependen de Supabase, fetch ni del estado del visitante", () => {
  const archivos = [
    "lib/demo/historial/parsear-growndona.js",
    "lib/demo/historial/normalizar-historial.js",
    "lib/demo/historial/historial-demo.js",
    "componentes/demo/vista-historial.js",
    "componentes/demo/historial-cabecera.js",
    "componentes/demo/historial-crecimiento.js",
    "componentes/demo/historial-resumen.js",
    "componentes/demo/historial-etapas.js",
    "componentes/demo/historial-timeline.js",
    "componentes/demo/historial-dia.js",
    "componentes/demo/historial-galeria.js",
    "componentes/demo/historial-metricas.js",
  ];
  for (const archivo of archivos) {
    const fuente = leer(archivo);
    assert.doesNotMatch(fuente, /@supabase|lib\/supabase|lib\/push|createClient|SUPABASE_/, archivo);
    assert.doesNotMatch(fuente, /\bfetch\(/, archivo);
    assert.doesNotMatch(fuente, /"use server"/, archivo);
    assert.doesNotMatch(fuente, /estado\.(registros|espacios)|usarDemo|useDemo/, archivo);
    assert.doesNotMatch(fuente, /private\//, archivo);
  }
  const pagina = leer("app/demo/page.js");
  assert.match(pagina, /historial:\s*VistaHistorial/);
});

test("Historial se abre desde la navegación sin cultivo creado y sobrevive a la recarga", () => {
  const inicial = crearEstadoDemo();
  const enHistorial = reducirDemo(inicial, { type: "IR", fase: "historial" });
  assert.equal(enHistorial.fase, "historial");
  assert.equal(enHistorial.espacios.length, 0);
  assert.equal(enHistorial.registros.length, 0);
  const restaurado = normalizarEstadoDemo(JSON.parse(JSON.stringify(enHistorial)));
  assert.equal(restaurado.fase, "historial");
  assert.deepEqual(restaurado.espacios, []);
  assert.deepEqual(restaurado.registros, []);
  const aCultivos = reducirDemo(restaurado, { type: "IR", fase: "cultivos" });
  assert.notEqual(aCultivos.fase, "historial");
  assert.deepEqual(aCultivos.registros, []);
});

test("helpers de presentación del historial", () => {
  const historial = normalizarPrueba();
  assert.equal(textoDiaCultivo(18), "Día 18");
  assert.equal(textoDiaCultivo(null), "Sin día");
  assert.equal(fechaLarga("2026-08-13"), "13 de agosto de 2026");
  assert.equal(mesDeFecha("2026-09-19"), "Septiembre 2026");
  assert.deepEqual(textoMedicion({ parametro: "temperatura", valor: 21.8 }), {
    etiqueta: "Temperatura",
    corto: "TEMP.",
    valor: "21,8",
    unidad: "°C",
  });
  assert.equal(textoMedicionCompleto({ parametro: "ec", valor: 530 }), "EC 530 µS/cm");
  assert.equal(textoMedicionCompleto({ parametro: "ppm", valor: 265 }), "PPM 265");
  assert.deepEqual(
    agruparPorMes(historial.dias).map((grupo) => [grupo.titulo, grupo.dias.length]),
    [
      ["Agosto 2026", 1],
      ["Septiembre 2026", 1],
    ]
  );
  assert.equal(diasFiltrados(historial, "enflora").length, 1);
  assert.equal(diasFiltrados(historial, "").length, 2);
  assert.deepEqual(etapasConRegistros(historial).map((etapa) => etapa.etapa), ["vegetativo", "enflora"]);
  assert.deepEqual(historialParaCiclo(historial), [
    { etapa: "vegetativo", fecha_inicio: "2026-07-26", fecha_fin: "2026-09-19" },
    { etapa: "enflora", fecha_inicio: "2026-09-19", fecha_fin: null },
  ]);
  assert.deepEqual(
    tarjetasResumen(historial).map((tarjeta) => [tarjeta.clave, tarjeta.valor]),
    [
      ["dias", 2],
      ["fotos", 4],
      ["mediciones", 10],
      ["acciones", 1],
      ["etapas", 2],
      ["plantas", 2],
    ]
  );
});
