import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parsearCsvHistorial, parsearManifest } from "@/lib/demo/historial/parsear-growndona";
import { normalizarHistorial, problemasDatasetPublico } from "@/lib/demo/historial/normalizar-historial";

const RAIZ = process.cwd();
const CLAVE_CULTIVO = "rdwc1";
const PRIVADO = path.join(RAIZ, "private/growndona", CLAVE_CULTIVO);
const CSV = path.join(PRIVADO, `growndona-${CLAVE_CULTIVO}-export.csv`);
const EXTRAIDO = path.join(PRIVADO, "extraido");
const MANIFEST = path.join(EXTRAIDO, "manifest.json");
const REPORTE = path.join(EXTRAIDO, "reporte.json");
const PUBLICO_RELATIVO = `/demo/historial/${CLAVE_CULTIVO}`;
const PUBLICO = path.join(RAIZ, "public", PUBLICO_RELATIVO);
const DATASET = path.join(RAIZ, "lib/demo/historial", `${CLAVE_CULTIVO}-dataset.js`);

const LADO_MAXIMO = 1200;
const LADO_MINIATURA = 480;
const CALIDAD = 70;
const CALIDAD_MINIATURA = 70;
const CONCURRENCIA = 4;

const forzar = process.argv.includes("--forzar");

for (const requerido of [CSV, MANIFEST]) {
  if (!fs.existsSync(requerido)) {
    throw new Error(`Falta el archivo privado ${path.relative(RAIZ, requerido)}.`);
  }
}

const exportado = parsearCsvHistorial(fs.readFileSync(CSV, "utf8"));
const manifest = parsearManifest(fs.readFileSync(MANIFEST, "utf8"));
const reporte = fs.existsSync(REPORTE) ? JSON.parse(fs.readFileSync(REPORTE, "utf8")) : null;

function rutaLocal(archivoLocal) {
  const partes = archivoLocal.split("/").slice(1);
  return path.join(EXTRAIDO, ...partes);
}

function sha256(ruta) {
  return createHash("sha256").update(fs.readFileSync(ruta)).digest("hex");
}

function nombrePublico(item, hash) {
  const prefijo = item.tipo === "portada" ? "portada" : item.fecha || "foto";
  return `${prefijo}-${hash.slice(0, 12)}.webp`;
}

async function medidas(ruta) {
  const meta = await sharp(ruta).metadata();
  return { ancho: meta.width, alto: meta.height };
}

async function convertir(origen, destino, lado, calidad) {
  if (!forzar && fs.existsSync(destino)) return false;
  await sharp(origen)
    .rotate()
    .resize(lado, lado, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: calidad })
    .toFile(destino);
  return true;
}

async function procesarItem(item, avisos) {
  const origen = rutaLocal(item.archivoLocal);
  if (!fs.existsSync(origen)) {
    avisos.push(`No existe la imagen local ${item.archivoLocal}.`);
    return null;
  }
  const hash = sha256(origen);
  if (item.sha256 && item.sha256 !== hash) {
    avisos.push(`El sha256 de ${item.archivoLocal} no coincide con el manifest.`);
  }
  const carpetaCompleta = item.tipo === "portada" ? "portada" : "fotos";
  const carpetaMiniatura = item.tipo === "portada" ? "portada" : "thumbs";
  const nombre = nombrePublico(item, hash);
  const nombreMiniatura = item.tipo === "portada" ? `miniatura-${hash.slice(0, 12)}.webp` : nombre;
  const destinoCompleta = path.join(PUBLICO, carpetaCompleta, nombre);
  const destinoMiniatura = path.join(PUBLICO, carpetaMiniatura, nombreMiniatura);
  const generadas = [
    await convertir(origen, destinoCompleta, LADO_MAXIMO, CALIDAD),
    await convertir(origen, destinoMiniatura, LADO_MINIATURA, CALIDAD_MINIATURA),
  ].filter(Boolean).length;
  const completa = await medidas(destinoCompleta);
  const miniatura = await medidas(destinoMiniatura);
  return {
    storagePath: item.storagePath,
    info: {
      clave: hash.slice(0, 12),
      url: `${PUBLICO_RELATIVO}/${carpetaCompleta}/${nombre}`,
      miniatura: `${PUBLICO_RELATIVO}/${carpetaMiniatura}/${nombreMiniatura}`,
      ancho: completa.ancho,
      alto: completa.alto,
      anchoMiniatura: miniatura.ancho,
      altoMiniatura: miniatura.alto,
    },
    generadas,
    bytes: fs.statSync(destinoCompleta).size + fs.statSync(destinoMiniatura).size,
  };
}

async function procesarTodo(items) {
  const avisos = [];
  const resultados = [];
  let indice = 0;
  async function trabajador() {
    while (indice < items.length) {
      const actual = items[indice];
      indice += 1;
      const resultado = await procesarItem(actual, avisos);
      if (resultado) resultados.push(resultado);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
  return { avisos, resultados };
}

for (const carpeta of ["portada", "fotos", "thumbs"]) {
  fs.mkdirSync(path.join(PUBLICO, carpeta), { recursive: true });
}

const { avisos, resultados } = await procesarTodo(manifest);
const porStorage = new Map(resultados.map((item) => [item.storagePath, item.info]));

const fechaReporte = typeof reporte?.generado === "string" ? reporte.generado.slice(0, 10) : "";
const historial = normalizarHistorial({
  exportado,
  resolverFoto: (storagePath) => porStorage.get(storagePath) || null,
  fechaCorte: fechaReporte,
});

const referenciadas = new Set();
for (const foto of historial.fotos) {
  referenciadas.add(foto.url);
  referenciadas.add(foto.miniatura);
}
if (historial.cultivo.portada) {
  referenciadas.add(historial.cultivo.portada.url);
  referenciadas.add(historial.cultivo.portada.miniatura);
}
const huerfanas = [];
for (const carpeta of ["portada", "fotos", "thumbs"]) {
  for (const archivo of fs.readdirSync(path.join(PUBLICO, carpeta))) {
    const url = `${PUBLICO_RELATIVO}/${carpeta}/${archivo}`;
    if (!referenciadas.has(url)) huerfanas.push(url);
  }
}

const fotosSinProcesar = exportado.registros
  .flatMap((registro) => registro.fotografias || [])
  .filter((foto) => foto?.storage_path && !porStorage.has(foto.storage_path)).length;
if (fotosSinProcesar) avisos.push(`${fotosSinProcesar} fotos del export no tienen imagen local.`);

const problemas = problemasDatasetPublico(historial);
if (problemas.length) {
  throw new Error(`El dataset público no pasó la validación:\n${problemas.join("\n")}`);
}

fs.mkdirSync(path.dirname(DATASET), { recursive: true });
fs.writeFileSync(DATASET, `export const HISTORIAL_RDWC1 = ${JSON.stringify(historial, null, 2)};\n`);

console.log(
  JSON.stringify(
    {
      cultivo: historial.cultivo.nombre,
      fechaCorte: historial.fechaCorte,
      dias: historial.resumen.diasRegistrados,
      fotos: historial.resumen.fotos,
      mediciones: historial.resumen.mediciones,
      acciones: historial.resumen.acciones,
      etapas: historial.etapas.map((etapa) => `${etapa.nombreOrigen} → ${etapa.etapa}`),
      imagenesProcesadas: resultados.length,
      archivosGenerados: resultados.reduce((suma, item) => suma + item.generadas, 0),
      pesoPublicoMB: Math.round((resultados.reduce((suma, item) => suma + item.bytes, 0) / 1048576) * 10) / 10,
      dataset: path.relative(RAIZ, DATASET),
      huerfanas,
      avisos,
    },
    null,
    2
  )
);
