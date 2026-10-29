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

function quitarMarcadoInline(fragmento) {
  let salida = String(fragmento ?? "");

  salida = salida.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  salida = salida.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  salida = salida.replace(/\*\*([^*]+)\*\*/g, "$1");
  salida = salida.replace(/__([^_]+)__/g, "$1");
  salida = salida.replace(/\*([^*]+)\*/g, "$1");
  salida = salida.replace(/_([^_]+)_/g, "$1");
  salida = salida.replace(/`([^`]+)`/g, "$1");

  return salida.trim();
}

/** Convierte la respuesta Markdown de Flora a texto plano legible para portapapeles. */
export function markdownFloraATextoPlano(texto) {
  const fuente = String(texto ?? "").replace(/\r\n/g, "\n");
  if (!fuente.trim()) return "";

  const lineas = fuente.split("\n");
  const salida = [];

  for (const linea of lineas) {
    const sinFin = linea.trimEnd();
    const vacia = !sinFin.trim();

    if (vacia) {
      if (salida.length && salida[salida.length - 1] !== "") salida.push("");
      continue;
    }

    if (/^#{1,6}\s+/.test(sinFin.trim())) {
      const titulo = quitarMarcadoInline(sinFin.trim().replace(/^#{1,6}\s+/, ""));
      if (salida.length && salida[salida.length - 1] !== "") salida.push("");
      salida.push(titulo);
      continue;
    }

    if (/^[-*+]\s+/.test(sinFin.trim())) {
      const cuerpo = quitarMarcadoInline(sinFin.trim().replace(/^[-*+]\s+/, ""));
      salida.push(`• ${cuerpo}`);
      continue;
    }

    const numerada = sinFin.trim().match(/^(\d+)\.\s+(.+)$/);
    if (numerada) {
      salida.push(`${numerada[1]}. ${quitarMarcadoInline(numerada[2])}`);
      continue;
    }

    if (/^(-{3,}|_{3,}|\*{3,})$/.test(sinFin.trim())) continue;

    salida.push(quitarMarcadoInline(sinFin));
  }

  return salida.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
