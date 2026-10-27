import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FUENTE_GUIA,
  LIMITES_FLORA,
  respuestaFlora,
} from "@/lib/flora-contrato";

const RAIZ_PROYECTO = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
export const CARPETA_GUIA_CULTIVO = path.join(RAIZ_PROYECTO, "contenido", "guia-cultivo");

let cacheDocumentos = null;
let cacheRuta = "";

function leerJsonSeguro(ruta) {
  try {
    const texto = fs.readFileSync(ruta, "utf8");
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

export function normalizarDocumentoGuia(entrada) {
  if (!entrada || typeof entrada !== "object") return null;
  const id = String(entrada.id || "").trim();
  if (!id) return null;

  const secciones = Array.isArray(entrada.secciones)
    ? entrada.secciones
        .map((seccion, indice) => {
          const sid = String(seccion?.id || `s${indice + 1}`).trim();
          const contenido = String(seccion?.contenido || "").trim();
          if (!contenido) return null;
          return {
            id: sid,
            titulo: String(seccion?.titulo || "").trim() || null,
            contenido,
            palabrasClave: Array.isArray(seccion?.palabrasClave)
              ? seccion.palabrasClave.map((p) => String(p).trim()).filter(Boolean)
              : [],
          };
        })
        .filter(Boolean)
    : [];

  const contenidoPlano = String(entrada.contenido || "").trim();
  if (!secciones.length && contenidoPlano) {
    secciones.push({ id: "principal", titulo: null, contenido: contenidoPlano, palabrasClave: [] });
  }
  if (!secciones.length) return null;

  return {
    id,
    titulo: String(entrada.titulo || id).trim(),
    tema: String(entrada.tema || "").trim() || null,
    subtema: String(entrada.subtema || "").trim() || null,
    palabrasClave: Array.isArray(entrada.palabrasClave)
      ? entrada.palabrasClave.map((p) => String(p).trim()).filter(Boolean)
      : [],
    referencias: Array.isArray(entrada.referencias) ? entrada.referencias : [],
    fuenteOriginal: entrada.fuenteOriginal || null,
    autor: entrada.autor || null,
    urlOriginal: entrada.urlOriginal || null,
    publicado: entrada.publicado || null,
    incorporado: entrada.incorporado || entrada.revisado || null,
    estado: entrada.estado || "borrador",
    version: entrada.version || null,
    secciones,
  };
}

export function listarRutasDocumentosGuia(carpeta = CARPETA_GUIA_CULTIVO) {
  if (!fs.existsSync(carpeta)) return [];
  const rutas = [];
  const recorrer = (dir) => {
    for (const nombre of fs.readdirSync(dir)) {
      if (nombre.startsWith(".")) continue;
      const ruta = path.join(dir, nombre);
      const stat = fs.statSync(ruta);
      if (stat.isDirectory()) {
        if (nombre === "_fixtures-test") continue;
        recorrer(ruta);
        continue;
      }
      if (nombre.endsWith(".json")) rutas.push(ruta);
    }
  };
  recorrer(carpeta);
  return rutas;
}

export function cargarDocumentosGuia({ carpeta = CARPETA_GUIA_CULTIVO, forzar = false } = {}) {
  if (!forzar && cacheDocumentos && cacheRuta === carpeta) return cacheDocumentos;

  const documentos = [];
  for (const ruta of listarRutasDocumentosGuia(carpeta)) {
    const crudo = leerJsonSeguro(ruta);
    const doc = normalizarDocumentoGuia(crudo);
    if (doc) documentos.push(doc);
  }

  cacheDocumentos = documentos;
  cacheRuta = carpeta;
  return documentos;
}

function puntuarTexto(texto, tokens) {
  const base = String(texto || "").toLowerCase();
  if (!base) return 0;
  let puntaje = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (base.includes(token)) puntaje += token.length > 3 ? 3 : 1;
  }
  return puntaje;
}

function tokensConsulta(consulta) {
  return String(consulta || "")
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function recortarFragmento(texto, limite = LIMITES_FLORA.maxCaracteresFragmento) {
  const limpio = String(texto || "").trim();
  if (limpio.length <= limite) return limpio;
  return `${limpio.slice(0, limite - 1)}…`;
}

export function buscarFragmentosEnDocumentos(documentos, { consulta = "", temas = [], limite = LIMITES_FLORA.maxFragmentosGuia } = {}) {
  const tokens = tokensConsulta(consulta);
  const temasNorm = (temas || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  const resultados = [];

  for (const doc of documentos || []) {
    if (temasNorm.length) {
      const temaDoc = `${doc.tema || ""} ${doc.subtema || ""}`.toLowerCase();
      const coincideTema = temasNorm.some((t) => temaDoc.includes(t) || doc.palabrasClave.some((k) => k.toLowerCase().includes(t)));
      if (!coincideTema) continue;
    }

    for (const seccion of doc.secciones) {
      const textoBusqueda = [
        doc.titulo,
        doc.tema,
        doc.subtema,
        ...doc.palabrasClave,
        seccion.titulo,
        ...seccion.palabrasClave,
        seccion.contenido,
      ].join(" ");

      const puntaje =
        puntuarTexto(textoBusqueda, tokens) +
        puntuarTexto(doc.titulo, tokens) * 2 +
        puntuarTexto((doc.palabrasClave || []).join(" "), tokens);

      if (tokens.length && puntaje <= 0) continue;

      resultados.push({
        documentoId: doc.id,
        seccionId: seccion.id,
        titulo: doc.titulo,
        tema: doc.tema,
        subtema: doc.subtema,
        seccionTitulo: seccion.titulo,
        fragmento: recortarFragmento(seccion.contenido),
        palabrasClave: [...new Set([...doc.palabrasClave, ...seccion.palabrasClave])],
        referencias: doc.referencias,
        bibliografia: {
          fuenteOriginal: doc.fuenteOriginal,
          autor: doc.autor,
          urlOriginal: doc.urlOriginal,
          publicado: doc.publicado,
          incorporado: doc.incorporado,
          estado: doc.estado,
          version: doc.version,
        },
        puntaje,
      });
    }
  }

  resultados.sort((a, b) => b.puntaje - a.puntaje);
  return resultados.slice(0, limite);
}

export function obtenerDocumentoGuiaPorId(documentoId, opciones = {}) {
  const id = String(documentoId || "").trim();
  const documentos = cargarDocumentosGuia(opciones);
  const doc = documentos.find((item) => item.id === id);
  if (!doc) return null;
  const { secciones, ...metadatos } = doc;
  return { metadatos, secciones };
}

export function buscarEnGuiaCultivo({ consulta = "", temas = [], limite, carpeta } = {}) {
  const documentos = cargarDocumentosGuia(carpeta ? { carpeta, forzar: true } : {});
  const fragmentos = buscarFragmentosEnDocumentos(documentos, { consulta, temas, limite });

  return respuestaFlora({
    fuente: FUENTE_GUIA,
    tipoConsulta: "buscar_guia",
    datos: fragmentos,
    metadatos: {
      completo: true,
      hayMas: false,
      cantidad: fragmentos.length,
      sinDatos: fragmentos.length === 0,
      documentosDisponibles: documentos.length,
      consulta: consulta || undefined,
      temas: temas?.length ? temas : undefined,
    },
    limitaciones:
      documentos.length === 0
        ? ["La guía interna aún no tiene documentos editoriales cargados."]
        : undefined,
  });
}

export function recuperarDocumentoGuia({ documentoId, carpeta } = {}) {
  const doc = obtenerDocumentoGuiaPorId(documentoId, carpeta ? { carpeta, forzar: true } : {});
  return respuestaFlora({
    fuente: FUENTE_GUIA,
    tipoConsulta: "documento_guia",
    datos: doc,
    metadatos: {
      sinDatos: !doc,
      cantidad: doc ? 1 : 0,
    },
    error: doc ? "" : "No se encontró el documento solicitado.",
  });
}

export function reiniciarCacheGuia() {
  cacheDocumentos = null;
  cacheRuta = "";
}
