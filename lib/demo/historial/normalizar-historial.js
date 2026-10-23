import { diasEntre, esEtapa, fechaValida } from "@/lib/etapas";

export const VERSION_HISTORIAL = 1;

export const ETAPA_POR_TIPO_ORIGEN = {
  germination: "germinacion",
  seedling: "plantula",
  vegetative: "vegetativo",
  flowering: "enflora",
  drying: "secado",
  curing: "secado",
  harvested: "finalizado",
  finished: "finalizado",
};

const ETAPA_POR_NOMBRE = [
  [/germin/i, "germinacion"],
  [/pl[aá]ntula|semill/i, "plantula"],
  [/veget|crecim/i, "vegetativo"],
  [/flor/i, "enflora"],
  [/seca|cura/i, "secado"],
  [/final|cosech/i, "finalizado"],
];

export const ACCIONES_HISTORIAL = {
  solution_change: { tipo: "cambio_solucion", etiqueta: "Cambio de solución" },
  defoliation: { tipo: "defoliacion", etiqueta: "Defoliación" },
  training: { tipo: "entrenamiento", etiqueta: "Entrenamiento" },
  pruning: { tipo: "poda", etiqueta: "Poda" },
  watering: { tipo: "riego", etiqueta: "Riego" },
  feeding: { tipo: "fertilizacion", etiqueta: "Fertilización" },
  transplant: { tipo: "trasplante", etiqueta: "Trasplante" },
  other: { tipo: "otra", etiqueta: "Otra acción" },
};

export const PARAMETROS_HISTORIAL = [
  { clave: "temperatura", origen: "temperature", etiqueta: "Temperatura", corto: "TEMP.", unidad: "°C", decimales: 1 },
  { clave: "humedad", origen: "humidity", etiqueta: "Humedad", corto: "HUM.", unidad: "%", decimales: 0 },
  { clave: "ph", origen: "ph", etiqueta: "pH", corto: "pH", unidad: "", decimales: 2 },
  { clave: "ec", origen: "ec", etiqueta: "EC", corto: "EC", unidad: "µS/cm", decimales: 0 },
  { clave: "ppm", origen: "ppm", etiqueta: "PPM", corto: "PPM", unidad: "", decimales: 0 },
];

const ESTADOS_CULTIVO = {
  active: "en_curso",
  finished: "finalizado",
  completed: "finalizado",
  archived: "finalizado",
  paused: "pausado",
};

const PATRON_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const PATRONES_SENSIBLES = [
  [PATRON_UUID, "identificador interno"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, "correo electrónico"],
  [/user_id|cultivation_id|daily_entry_id|storage_path|cover_image_url/, "campo del origen"],
  [/private[\\/]|[A-Za-z]:\\|\/Users\//, "ruta privada"],
  [/supabase|growndona/i, "referencia al origen"],
];

function esObjeto(valor) {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function textoLimpio(valor) {
  if (typeof valor !== "string") return "";
  return valor.replace(/\r\n?/g, "\n").trim();
}

function soloFecha(valor) {
  const texto = String(valor ?? "").slice(0, 10);
  return fechaValida(texto) ? texto : "";
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
}

function redondear(valor, decimales) {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function ordenarPorFecha(lista, clave) {
  return [...lista].sort((a, b) => String(a[clave]).localeCompare(String(b[clave])));
}

export function etapaEnflora(tipo, nombre) {
  const porTipo = ETAPA_POR_TIPO_ORIGEN[String(tipo || "").toLowerCase()];
  if (porTipo) return porTipo;
  const texto = String(nombre || "");
  const coincidencia = ETAPA_POR_NOMBRE.find(([patron]) => patron.test(texto));
  return coincidencia ? coincidencia[1] : "";
}

export function accionEnflora(accion) {
  const base = ACCIONES_HISTORIAL[String(accion?.type || "").toLowerCase()] || ACCIONES_HISTORIAL.other;
  const titulo = textoLimpio(accion?.title);
  return { tipo: base.tipo, etiqueta: titulo || base.etiqueta, nota: textoLimpio(accion?.notes) || null };
}

export function medicionesEnflora(filas) {
  const resultado = [];
  for (const fila of Array.isArray(filas) ? filas : []) {
    if (!esObjeto(fila)) continue;
    for (const parametro of PARAMETROS_HISTORIAL) {
      const valor = numero(fila[parametro.origen]);
      if (valor === null) continue;
      resultado.push({ parametro: parametro.clave, valor: redondear(valor, parametro.decimales) });
    }
  }
  return resultado;
}

export function etapaEnFecha(etapas, fecha) {
  let activa = null;
  for (const etapa of etapas) {
    if (etapa.fechaInicio > fecha) continue;
    if (etapa.fechaFin && etapa.fechaFin <= fecha) continue;
    if (!activa || etapa.fechaInicio >= activa.fechaInicio) activa = etapa;
  }
  return activa;
}

export function diaDelCultivo(fechaInicio, fecha) {
  if (!fechaInicio || !fecha) return null;
  const dias = diasEntre(fechaInicio, fecha);
  return Number.isFinite(dias) ? dias : null;
}

function normalizarEtapas(etapasOrigen, fechaInicioCultivo, fechaCorte) {
  const validas = (Array.isArray(etapasOrigen) ? etapasOrigen : [])
    .filter((item) => esObjeto(item) && soloFecha(item.start_date))
    .map((item) => ({
      etapa: etapaEnflora(item.type, item.name),
      nombreOrigen: textoLimpio(item.name) || null,
      fechaInicio: soloFecha(item.start_date),
      fechaFin: soloFecha(item.end_date) || null,
    }));
  const ordenadas = ordenarPorFecha(validas, "fechaInicio");
  return ordenadas.map((item, indice) => {
    const cierre = item.fechaFin || fechaCorte;
    return {
      id: `etapa-${indice + 1}`,
      etapa: item.etapa,
      nombreOrigen: item.nombreOrigen,
      fechaInicio: item.fechaInicio,
      fechaFin: item.fechaFin,
      actual: !item.fechaFin,
      diaInicio: diaDelCultivo(fechaInicioCultivo, item.fechaInicio),
      diaFin: item.fechaFin ? diaDelCultivo(fechaInicioCultivo, item.fechaFin) : null,
      duracion: Math.max(0, diasEntre(item.fechaInicio, cierre)),
    };
  });
}

function normalizarPlantas(plantasOrigen, cultivo) {
  const ordenadas = [...(Array.isArray(plantasOrigen) ? plantasOrigen : [])]
    .filter(esObjeto)
    .sort((a, b) => (numero(a.number) ?? 0) - (numero(b.number) ?? 0));
  return ordenadas.map((item, indice) => {
    const numeroPlanta = numero(item.number) ?? indice + 1;
    return {
      id: `planta-${numeroPlanta}`,
      nombre: `Planta ${numeroPlanta}`,
      numero: numeroPlanta,
      genetica: textoLimpio(item.genetics) || textoLimpio(cultivo.genetics) || null,
      metodo: textoLimpio(item.method) || textoLimpio(cultivo.method) || null,
      medio: textoLimpio(item.medium) || textoLimpio(cultivo.medium) || null,
      estado: cultivo.estadoEnflora === "finalizado" ? "finalizada" : "activa",
    };
  });
}

function idFoto(info) {
  return `foto-${info.clave}`;
}

export function normalizarHistorial({ exportado, resolverFoto = () => null, fechaCorte = "" }) {
  if (!esObjeto(exportado) || !esObjeto(exportado.cultivo)) {
    throw new Error("La exportación no tiene un cultivo.");
  }
  const origenCultivo = exportado.cultivo;
  const registrosOrigen = (Array.isArray(exportado.registros) ? exportado.registros : [])
    .filter((item) => esObjeto(item) && esObjeto(item.entrada) && soloFecha(item.entrada.entry_date))
    .sort((a, b) => String(a.entrada.entry_date).localeCompare(String(b.entrada.entry_date)));

  const fechaInicio = soloFecha(origenCultivo.start_date);
  if (!fechaInicio) throw new Error("El cultivo no tiene fecha de inicio válida.");
  const ultimaFecha = registrosOrigen.length ? soloFecha(registrosOrigen.at(-1).entrada.entry_date) : fechaInicio;
  const corte = soloFecha(fechaCorte) || soloFecha(origenCultivo.end_date) || ultimaFecha;
  const estadoEnflora = ESTADOS_CULTIVO[String(origenCultivo.status || "").toLowerCase()] || "en_curso";

  const etapas = normalizarEtapas(exportado.etapas, fechaInicio, corte);
  const plantas = normalizarPlantas(exportado.plantas, { ...origenCultivo, estadoEnflora });

  const fotos = [];
  const dias = [];
  const vistosDias = new Set();
  const clavesFoto = new Set();

  for (const registro of registrosOrigen) {
    const fecha = soloFecha(registro.entrada.entry_date);
    if (vistosDias.has(fecha)) {
      throw new Error(`Hay más de un registro para la fecha ${fecha}.`);
    }
    vistosDias.add(fecha);
    const etapaActiva = etapaEnFecha(etapas, fecha);
    const dia = diaDelCultivo(fechaInicio, fecha);
    const idDia = `dia-${fecha}`;
    const acciones = (Array.isArray(registro.acciones) ? registro.acciones : []).filter(esObjeto).map(accionEnflora);
    const mediciones = medicionesEnflora(registro.mediciones);
    const fotosDia = [...(Array.isArray(registro.fotografias) ? registro.fotografias : [])]
      .filter((item) => esObjeto(item) && item.storage_path)
      .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    const idsFotos = [];
    for (const foto of fotosDia) {
      const info = resolverFoto(foto.storage_path);
      if (!info || !info.clave || clavesFoto.has(info.clave)) continue;
      clavesFoto.add(info.clave);
      const id = idFoto(info);
      idsFotos.push(id);
      fotos.push({
        id,
        tipo: "registro",
        fecha,
        dia,
        diaId: idDia,
        url: info.url,
        miniatura: info.miniatura,
        ancho: info.ancho,
        alto: info.alto,
        anchoMiniatura: info.anchoMiniatura,
        altoMiniatura: info.altoMiniatura,
        descripcion: textoLimpio(foto.caption) || null,
      });
    }
    const nota = textoLimpio(registro.entrada.notes) || null;
    dias.push({
      id: idDia,
      dia,
      fecha,
      etapa: etapaActiva?.etapa || "",
      etapaId: etapaActiva?.id || null,
      nota,
      acciones,
      mediciones,
      fotos: idsFotos,
      resumen: {
        nota: Boolean(nota),
        acciones: acciones.length,
        mediciones: mediciones.length,
        fotos: idsFotos.length,
      },
    });
  }

  const portadaInfo = origenCultivo.cover_image_url ? resolverFoto(origenCultivo.cover_image_url) : null;
  const portada = portadaInfo
    ? {
        id: idFoto(portadaInfo),
        tipo: "portada",
        url: portadaInfo.url,
        miniatura: portadaInfo.miniatura,
        ancho: portadaInfo.ancho,
        alto: portadaInfo.alto,
        anchoMiniatura: portadaInfo.anchoMiniatura,
        altoMiniatura: portadaInfo.altoMiniatura,
      }
    : null;

  const etapaActual = etapas.find((item) => item.actual) || etapas.at(-1) || null;
  const metricas = calcularMetricas(dias);
  const totalMediciones = dias.reduce((suma, item) => suma + item.mediciones.length, 0);
  const totalAcciones = dias.reduce((suma, item) => suma + item.acciones.length, 0);

  return {
    version: VERSION_HISTORIAL,
    fechaCorte: corte,
    cultivo: {
      id: "rdwc1",
      nombre: textoLimpio(origenCultivo.name) || "Cultivo",
      metodo: textoLimpio(origenCultivo.method) || null,
      medio: textoLimpio(origenCultivo.medium) || null,
      genetica: textoLimpio(origenCultivo.genetics) || null,
      descripcion: textoLimpio(origenCultivo.description) || null,
      notasFinales: textoLimpio(origenCultivo.final_notes) || null,
      estado: estadoEnflora,
      fechaInicio,
      fechaFin: soloFecha(origenCultivo.end_date) || null,
      diaActual: diaDelCultivo(fechaInicio, corte),
      etapaActual: etapaActual?.etapa || "",
      cantidadPlantas: numero(origenCultivo.plant_count) ?? plantas.length,
      portada,
    },
    plantas,
    etapas,
    dias,
    fotos,
    resumen: {
      diasRegistrados: dias.length,
      diasConFotos: dias.filter((item) => item.fotos.length).length,
      diasConNota: dias.filter((item) => item.nota).length,
      fotos: fotos.length + (portada ? 1 : 0),
      fotosDeRegistros: fotos.length,
      mediciones: totalMediciones,
      diasConMediciones: dias.filter((item) => item.mediciones.length).length,
      acciones: totalAcciones,
      etapas: etapas.length,
      plantas: plantas.length,
      rango: {
        desde: dias[0]?.fecha || fechaInicio,
        hasta: dias.at(-1)?.fecha || corte,
      },
      diasTotales: diaDelCultivo(fechaInicio, corte),
    },
    metricas,
  };
}

export function calcularMetricas(dias) {
  const resultado = {};
  for (const parametro of PARAMETROS_HISTORIAL) {
    const valores = [];
    for (const dia of dias) {
      for (const medicion of dia.mediciones) {
        if (medicion.parametro === parametro.clave) valores.push(medicion.valor);
      }
    }
    if (!valores.length) continue;
    const suma = valores.reduce((total, valor) => total + valor, 0);
    resultado[parametro.clave] = {
      etiqueta: parametro.etiqueta,
      unidad: parametro.unidad,
      cantidad: valores.length,
      minimo: Math.min(...valores),
      maximo: Math.max(...valores),
      promedio: redondear(suma / valores.length, parametro.decimales === 0 ? 0 : parametro.decimales),
      primero: valores[0],
      ultimo: valores.at(-1),
    };
  }
  return resultado;
}

export function seriePorParametro(historial, clave) {
  const serie = [];
  for (const dia of historial.dias) {
    const medicion = dia.mediciones.find((item) => item.parametro === clave);
    if (medicion) serie.push({ dia: dia.dia, fecha: dia.fecha, valor: medicion.valor, etapa: dia.etapa });
  }
  return serie;
}

export function problemasDatasetPublico(historial) {
  const problemas = [];
  const texto = JSON.stringify(historial);
  for (const [patron, descripcion] of PATRONES_SENSIBLES) {
    const coincidencia = texto.match(patron);
    if (coincidencia) problemas.push(`El dataset contiene ${descripcion}: ${coincidencia[0]}`);
  }
  const idsFotos = new Set(historial.fotos.map((foto) => foto.id));
  if (idsFotos.size !== historial.fotos.length) problemas.push("Hay fotos con id repetido.");
  const idsDias = new Set(historial.dias.map((dia) => dia.id));
  for (const foto of historial.fotos) {
    if (!idsDias.has(foto.diaId)) problemas.push(`La foto ${foto.id} no pertenece a ningún día.`);
    if (!/^\/demo\/historial\//.test(foto.url) || !/^\/demo\/historial\//.test(foto.miniatura)) {
      problemas.push(`La foto ${foto.id} no apunta a la carpeta pública de la demo.`);
    }
  }
  for (const dia of historial.dias) {
    for (const id of dia.fotos) {
      if (!idsFotos.has(id)) problemas.push(`El día ${dia.id} referencia una foto inexistente: ${id}`);
    }
    if (dia.etapa && !esEtapa(dia.etapa)) problemas.push(`El día ${dia.id} tiene una etapa desconocida: ${dia.etapa}`);
  }
  return problemas;
}
