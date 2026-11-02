// Reglas puras de genéticas: normalización, validación y texto visible.
// No inventa promedios ni completa datos ausentes con cero.

import { extensionDeTipo, tipoPorFirma } from "@/lib/fotos";

export const URL_STRAINAPI = "https://www.strainapi.com/";
export const ATRIBUCION_STRAINAPI = "Datos proporcionados por StrainAPI";
export const BUCKET_IMAGENES_GENETICA = "geneticas-imagenes";
export const MAX_BYTES_IMAGEN_GENETICA = 2 * 1024 * 1024;
export const MAX_NOMBRE_CATALOGO = 80;
export const MAX_NOMBRE_LIBRE = 120;
export const MAX_NOTA = 400;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUTA_IMAGEN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png)$/i;

export function esUuid(valor) {
  return UUID.test(String(valor || ""));
}

const HOSTS_IMAGEN_STRAIN = new Set(["strainapi.com", "www.strainapi.com"]);

export function urlImagenStrain(dato) {
  const cruda = typeof dato === "string" ? dato : dato?.url || dato?.src || "";
  if (!cruda || cruda.length > 500) return "";
  let url;
  try {
    url = new URL(cruda);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || !HOSTS_IMAGEN_STRAIN.has(url.hostname)) return "";
  return url.toString();
}

function notaTexto(valor) {
  if (typeof valor !== "string") return "";
  return valor.trim().replace(/\s+/g, " ");
}

export function solicitudDeLaApp(cabeceras) {
  const sitio = cabeceras.get("sec-fetch-site");
  if (sitio) return sitio === "same-origin" || sitio === "none";
  const origen = cabeceras.get("origin");
  const host = cabeceras.get("host");
  if (!origen || !host) return false;
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

export function leerPorcentaje(valor) {
  if (valor == null) return { ok: true, numero: null };
  const texto = String(valor).trim().replace(",", ".");
  if (!texto) return { ok: true, numero: null };
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(texto)) return { ok: false };
  const numero = Number(texto);
  if (numero > 100) return { ok: false };
  return { ok: true, numero };
}

function limpiarNota(valor) {
  const texto = notaTexto(valor);
  if (!texto) return { ok: true, texto: null };
  if (texto.length > MAX_NOTA) return { ok: false };
  return { ok: true, texto };
}

export function validarGeneticaPersonalizada({ nombre, thc, cbd, sabor, aroma }) {
  const limpio = notaTexto(nombre);
  if (!limpio) return { ok: false, error: "El nombre de la genética es obligatorio.", campo: "nombre" };
  if (limpio.length > MAX_NOMBRE_CATALOGO) {
    return { ok: false, error: "El nombre es demasiado largo.", campo: "nombre" };
  }

  const thcLeido = leerPorcentaje(thc);
  if (!thcLeido.ok) return { ok: false, error: "El THC tiene que ser un número entre 0 y 100.", campo: "thc" };
  const cbdLeido = leerPorcentaje(cbd);
  if (!cbdLeido.ok) return { ok: false, error: "El CBD tiene que ser un número entre 0 y 100.", campo: "cbd" };

  const saborLeido = limpiarNota(sabor);
  if (!saborLeido.ok) return { ok: false, error: "El sabor es demasiado largo.", campo: "sabor" };
  const aromaLeido = limpiarNota(aroma);
  if (!aromaLeido.ok) return { ok: false, error: "El aroma es demasiado largo.", campo: "aroma" };

  return {
    ok: true,
    datos: {
      nombre: limpio,
      thc: thcLeido.numero,
      cbd: cbdLeido.numero,
      sabor: saborLeido.texto,
      aroma: aromaLeido.texto,
    },
  };
}

export function validarBytesImagenGenetica(bytes) {
  const largo = bytes?.length || bytes?.byteLength || 0;
  if (!bytes || largo < 12) return { error: "El archivo no es una imagen JPG, PNG o WEBP válida." };
  if (largo > MAX_BYTES_IMAGEN_GENETICA) return { error: "La imagen supera el máximo de 2 MB." };
  const vista = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const tipo = tipoPorFirma(vista);
  if (!tipo) return { error: "El archivo no es una imagen JPG, PNG o WEBP válida." };
  return { error: "", tipo, extension: extensionDeTipo(tipo) };
}

export function rutaImagenGenetica(usuarioId, geneticaId, extension) {
  return `${usuarioId}/${geneticaId}.${extension}`;
}

export function rutaImagenGeneticaValida(ruta, usuarioId) {
  const texto = String(ruta || "");
  if (!RUTA_IMAGEN.test(texto) || texto.includes("..")) return false;
  if (!usuarioId) return true;
  return texto.startsWith(`${usuarioId}/`);
}

export function nombreGeneticaLibre(valor) {
  const texto = notaTexto(valor);
  if (!texto) return null;
  return texto.slice(0, MAX_NOMBRE_LIBRE);
}

export function camposGenetica(valor) {
  if (valor && typeof valor === "object") {
    const nombre = String(valor.nombre || "");
    const id = String(valor.id || "").trim();
    return {
      genetica: nombre,
      geneticaId: esUuid(id) ? id : "",
      geneticaDetalle: valor.detalle || null,
    };
  }
  return { genetica: String(valor || ""), geneticaId: "", geneticaDetalle: null };
}

export function clonarGeneticaCompartida(plantas, general = {}) {
  const lista = plantas || [];
  const primera = String(lista[0]?.genetica || "");
  const encontrada = lista.find((planta) => String(planta.genetica || "").trim());
  const nombre = (primera.trim() ? primera : encontrada?.genetica || "") || general.genetica || "";
  if (!String(nombre).trim()) return camposGenetica("");
  const fuente =
    lista.find((planta) => String(planta.genetica || "") === String(nombre) && (planta.geneticaId || planta.geneticaDetalle)) ||
    general;
  return {
    genetica: nombre,
    geneticaId: esUuid(fuente.geneticaId) ? fuente.geneticaId : "",
    geneticaDetalle: fuente.geneticaDetalle || null,
  };
}

export function numeroFila(valor) {
  if (valor == null || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function detalleDesdeFila(fila, imagenUrl = "") {
  if (!fila) return null;
  return {
    id: fila.id,
    origen: fila.origen,
    nombre: fila.nombre,
    slug: fila.slug || null,
    idExterno: fila.id_externo || null,
    thc: {
      valor: numeroFila(fila.thc_valor),
      min: numeroFila(fila.thc_min),
      max: numeroFila(fila.thc_max),
    },
    cbd: {
      valor: numeroFila(fila.cbd_valor),
      min: numeroFila(fila.cbd_min),
      max: numeroFila(fila.cbd_max),
    },
    sabor: fila.sabor || null,
    aroma: fila.aroma || null,
    imagenUrl: imagenUrl || urlImagenStrain(fila.imagen_url) || "",
  };
}

function formatearNumero(numero) {
  return String(Math.round(Number(numero) * 100) / 100).replace(".", ",");
}

export function textoPorcentaje(campo) {
  if (!campo) return "No disponible";
  const { valor, min, max } = campo;
  const rango =
    min != null && max != null
      ? `${formatearNumero(min)}–${formatearNumero(max)}%`
      : min != null
        ? `desde ${formatearNumero(min)}%`
        : max != null
          ? `hasta ${formatearNumero(max)}%`
          : "";
  const simple = valor != null ? `${formatearNumero(valor)}%` : "";
  if (!rango && !simple) return "No disponible";
  if (rango && simple) return `${simple} · ${rango}`;
  return simple || rango;
}

export function textoDato(valor) {
  const texto = notaTexto(valor);
  return texto || "No disponible";
}

export function esEsquemaAusente(error) {
  const texto = `${error?.message || ""} ${error?.code || ""} ${error?.details || ""}`;
  return /schema cache|PGRST205|42P01|does not exist|no existe/i.test(texto);
}

export function esColumnaGeneticaAusente(error) {
  const texto = `${error?.message || ""} ${error?.code || ""}`;
  return /genetica_id/i.test(texto) && /schema cache|PGRST204|42703|column/i.test(texto);
}

export function sinColumnaGenetica(fila) {
  const { genetica_id, ...resto } = fila || {};
  return resto;
}
