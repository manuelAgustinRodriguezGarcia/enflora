const COLUMNA_HISTORIAL = "historial_completo";

function leerCeldaEntrecomillada(texto, desde) {
  let valor = "";
  let posicion = desde + 1;
  while (posicion < texto.length) {
    const caracter = texto[posicion];
    if (caracter === '"') {
      if (texto[posicion + 1] === '"') {
        valor += '"';
        posicion += 2;
        continue;
      }
      return { valor, fin: posicion + 1 };
    }
    valor += caracter;
    posicion += 1;
  }
  throw new Error("El CSV tiene una celda entrecomillada sin cerrar.");
}

function leerCelda(texto, desde) {
  if (texto[desde] === '"') return leerCeldaEntrecomillada(texto, desde);
  let fin = desde;
  while (fin < texto.length && texto[fin] !== "," && texto[fin] !== "\n" && texto[fin] !== "\r") fin += 1;
  return { valor: texto.slice(desde, fin), fin };
}

export function leerFilasCsv(texto) {
  const limpio = String(texto ?? "").replace(/^\uFEFF/, "");
  const filas = [];
  let fila = [];
  let posicion = 0;
  while (posicion < limpio.length) {
    const { valor, fin } = leerCelda(limpio, posicion);
    fila.push(valor);
    posicion = fin;
    if (limpio[posicion] === ",") {
      posicion += 1;
      continue;
    }
    if (limpio[posicion] === "\r") posicion += 1;
    if (limpio[posicion] === "\n") posicion += 1;
    filas.push(fila);
    fila = [];
  }
  if (fila.length) filas.push(fila);
  return filas.filter((item) => item.some((celda) => celda !== ""));
}

function esObjeto(valor) {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

export function validarExportacion(exportado) {
  const faltantes = [];
  if (!esObjeto(exportado)) return ["La exportación no es un objeto."];
  if (!esObjeto(exportado.cultivo)) faltantes.push("cultivo");
  for (const clave of ["etapas", "plantas", "registros"]) {
    if (!Array.isArray(exportado[clave])) faltantes.push(clave);
  }
  if (faltantes.length) return [`Faltan secciones en la exportación: ${faltantes.join(", ")}.`];
  const problemas = [];
  exportado.registros.forEach((registro, indice) => {
    if (!esObjeto(registro?.entrada) || !registro.entrada.entry_date) {
      problemas.push(`El registro ${indice} no tiene entrada con fecha.`);
    }
  });
  return problemas;
}

export function parsearCsvHistorial(texto) {
  const filas = leerFilasCsv(texto);
  if (filas.length < 2) throw new Error("El CSV no tiene filas de datos.");
  const columna = filas[0].indexOf(COLUMNA_HISTORIAL);
  if (columna === -1) throw new Error(`El CSV no tiene la columna ${COLUMNA_HISTORIAL}.`);
  if (filas.length > 2) throw new Error("El CSV tiene más de una fila de historial.");
  const crudo = filas[1][columna];
  let exportado;
  try {
    exportado = JSON.parse(crudo);
  } catch {
    throw new Error("La columna de historial no contiene JSON válido.");
  }
  const problemas = validarExportacion(exportado);
  if (problemas.length) throw new Error(problemas.join(" "));
  return exportado;
}

export function parsearManifest(valor) {
  const lista = typeof valor === "string" ? JSON.parse(valor) : valor;
  if (!Array.isArray(lista)) throw new Error("El manifest no es una lista.");
  return lista
    .filter((item) => esObjeto(item) && item.estado === "ok" && item.storage_path && item.archivo_local)
    .map((item) => ({
      tipo: item.tipo === "cover" ? "portada" : item.tipo === "problem" ? "problema" : "registro",
      storagePath: item.storage_path,
      archivoLocal: item.archivo_local,
      fecha: item.fecha_registro || null,
      entradaId: item.daily_entry_id || null,
      sha256: item.sha256 || "",
      mime: item.mime || "",
    }));
}
