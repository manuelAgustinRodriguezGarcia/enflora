/** Utilidades para revelar Markdown por palabras sin dejar marcadores abiertos. */

const ENLACE_INCOMPLETO = /\[[^\]]*(?:\](?!\())?|\][^(]*(?:\([^)]*)?$/;

export function contarPalabrasMarkdown(texto) {
  const limpio = String(texto ?? "").trim();
  if (!limpio) return 0;
  return limpio.match(/\S+/g)?.length ?? 0;
}

function cerrarMarcadoresMarkdown(fragmento) {
  let salida = String(fragmento ?? "");

  if (ENLACE_INCOMPLETO.test(salida)) {
    salida = salida.replace(ENLACE_INCOMPLETO, "");
  }

  const comillasDobles = (salida.match(/\*\*/g) || []).length;
  if (comillasDobles % 2 !== 0) {
    salida += "**";
  }

  const sinPares = salida.replace(/\*\*/g, "");
  const asteriscosSueltos = (sinPares.match(/\*/g) || []).length;
  if (asteriscosSueltos % 2 !== 0) {
    salida += "*";
  }

  const backticks = (salida.match(/`/g) || []).length;
  if (backticks % 2 !== 0) {
    salida += "`";
  }

  return salida.trimEnd();
}

/**
 * Devuelve un fragmento de Markdown con hasta `cantidadPalabras` palabras visibles,
 * cerrando negritas/cursivas/código inline incompletos al final.
 */
export function recortarMarkdownPorPalabras(texto, cantidadPalabras) {
  const fuente = String(texto ?? "");
  if (!fuente.trim() || cantidadPalabras <= 0) return "";

  const total = contarPalabrasMarkdown(fuente);
  if (cantidadPalabras >= total) return fuente;

  const re = /\S+/g;
  let visto = 0;
  let fin = 0;
  let coincidencia = re.exec(fuente);
  while (coincidencia) {
    visto += 1;
    fin = coincidencia.index + coincidencia[0].length;
    if (visto >= cantidadPalabras) break;
    coincidencia = re.exec(fuente);
  }

  return cerrarMarcadoresMarkdown(fuente.slice(0, fin));
}

export function duracionAnimacionPalabras(cantidadPalabras, { reducido = false } = {}) {
  if (reducido || cantidadPalabras <= 0) return 0;
  const msPorPalabra = 28;
  const maxMs = 6500;
  return Math.min(maxMs, Math.max(400, cantidadPalabras * msPorPalabra));
}
