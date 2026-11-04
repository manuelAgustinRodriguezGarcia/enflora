import { aplicacionNutrientesDeRegistro, medicionesParametro } from "@/lib/flora-analisis";
import { diaArgentina, horaArgentina } from "@/lib/historial-registros";

export const TOPE_EVENTOS_CRUCE = 8;
export const TOPE_PUNTOS_CRUCE = 24;
export const TOPE_REGISTROS_CRUCE = 80;

const NOTA_CAUSA = "La coincidencia de fechas no demuestra que un producto haya causado el cambio.";
const NOTA_UNIDADES = "Hay unidades distintas. No se convierten ni se promedian juntas.";
const POLITICA_MEDICIONES = {
  correccion_automatica: "prohibida",
  valores_corregidos: "ausentes",
  revision: "manual",
};

function instante(fecha) {
  const valor = new Date(fecha).getTime();
  return Number.isFinite(valor) ? valor : null;
}

function redondear(valor) {
  const numero = Math.round(valor * 1000) / 1000;
  return Object.is(numero, -0) ? 0 : numero;
}

function tieneAccion(registro, clave) {
  return (registro?.registro_acciones || []).some(
    (fila) => fila?.origen === "nativa" && fila.clave_nativa === clave,
  );
}

function serie(registros, clave) {
  return medicionesParametro(registros, { claveNativa: clave })
    .filter((punto) => punto.valor_numero != null)
    .sort((a, b) => instante(a.fecha_evento) - instante(b.fecha_evento));
}

function puntoVisible(punto) {
  if (!punto) return null;
  const sospechoso = Boolean(punto.advertencia);
  return {
    fecha_evento: punto.fecha_evento,
    fecha_local: punto.dia,
    hora_local: punto.hora_local,
    valor_almacenado: punto.valor_numero,
    unidad: punto.unidad || "",
    estado: sospechoso ? "sospechoso" : "presente",
    usable_en_calculo: !sospechoso,
    correccion: "no_aplicada",
    ...(sospechoso
      ? {
          advertencia: punto.advertencia,
          revision: "manual",
          nota: "Valor almacenado. No hay un valor corregido.",
        }
      : {}),
  };
}

function mismaUnidad(a, b) {
  return String(a?.unidad || "") === String(b?.unidad || "");
}

function comparable(a, b) {
  if (!a || !b || a.advertencia || b.advertencia) return false;
  if (a.valor_numero == null || b.valor_numero == null) return false;
  return mismaUnidad(a, b);
}

function productosDe(registro) {
  const aplicacion = aplicacionNutrientesDeRegistro(registro);
  if (!aplicacion) return { productos: [], volumen_preparado: null };
  return {
    productos: (aplicacion.componentes || []).map((componente) => ({
      nombre_producto: componente.nombre_producto,
      fabricante: componente.fabricante,
      dosis_por_litro: componente.dosis_por_litro,
      cantidad_absoluta: componente.cantidad_absoluta,
    })),
    volumen_preparado: aplicacion.volumen_preparado,
  };
}

function clasificarAlrededor(puntos, anclaMs) {
  let anterior = null;
  let simultanea = null;
  let posterior = null;
  for (const punto of puntos) {
    const momento = instante(punto.fecha_evento);
    if (momento == null) continue;
    if (momento < anclaMs) anterior = punto;
    else if (momento === anclaMs) simultanea = simultanea || punto;
    else {
      posterior = punto;
      break;
    }
  }
  const base = simultanea || anterior;
  const sePuede = comparable(base, posterior);
  let evidencia = "temporal";
  if (!anterior && !posterior && !simultanea) evidencia = "insuficiente";
  else if (!posterior || !base) evidencia = "parcial";
  let motivo = null;
  if (!sePuede) {
    if ((base && base.advertencia) || (posterior && posterior.advertencia)) motivo = "medicion_sospechosa";
    else if (base && posterior && !mismaUnidad(base, posterior)) motivo = "unidades_incompatibles";
    else motivo = "medicion_ausente";
  }
  return {
    anterior: puntoVisible(anterior),
    simultanea: puntoVisible(simultanea),
    posterior: puntoVisible(posterior),
    delta: sePuede ? redondear(posterior.valor_numero - base.valor_numero) : null,
    comparable: sePuede,
    evidencia,
    relacion: "temporal",
    atribucion: "no_determinada",
    ...(motivo ? { motivo_sin_delta: motivo } : {}),
    ...(base && posterior && !mismaUnidad(base, posterior) ? { nota_unidades: NOTA_UNIDADES } : {}),
  };
}

function momentoLocalDe(fecha) {
  const hora = /(\d{2}):(\d{2})/.exec(horaArgentina(fecha) || "");
  return {
    fecha_local: diaArgentina(fecha) || null,
    hora_local: hora ? `${hora[1]}:${hora[2]}` : null,
  };
}

function eventosAccion(registros, clave, cantidad) {
  const ordenados = (registros || [])
    .filter((registro) => tieneAccion(registro, clave) && instante(registro.fecha_evento) != null)
    .sort((a, b) => instante(a.fecha_evento) - instante(b.fecha_evento));
  const tope = Math.min(Math.max(cantidad || 3, 1), TOPE_EVENTOS_CRUCE);
  return {
    elegidos: ordenados.slice(-tope),
    anteriores_no_incluidos: Math.max(0, ordenados.length - tope),
  };
}

function relacionarDespuesDeAccion(registros, opciones) {
  const puntos = serie(registros, opciones.claveParametro);
  const { elegidos, anteriores_no_incluidos } = eventosAccion(registros, opciones.claveAccion, opciones.cantidad);
  const eventos = elegidos.map((registro) => {
    const local = momentoLocalDe(registro.fecha_evento);
    const nutrientes = productosDe(registro);
    return {
      fecha_evento: registro.fecha_evento,
      fecha_local: local.fecha_local,
      hora_local: local.hora_local,
      accion: opciones.claveAccion,
      productos: nutrientes.productos,
      volumen_preparado: nutrientes.volumen_preparado,
      ...clasificarAlrededor(puntos, instante(registro.fecha_evento)),
    };
  });
  return {
    modo: "despues_de_accion",
    parametro: opciones.claveParametro,
    eventos,
    anteriores_no_incluidos,
    sin_datos: eventos.length === 0,
    nota: NOTA_CAUSA,
    cobertura: coberturaDeAccion(eventos, anteriores_no_incluidos, opciones),
  };
}

function coberturaDeAccion(eventos, anterioresEnVentana, opciones) {
  const solicitados = Math.min(Math.max(opciones.cantidad || 3, 1), TOPE_EVENTOS_CRUCE);
  const encontrados = eventos.length;
  const ventana = opciones.ventana === "parcial" ? "parcial" : "completa";
  const conocidas = new Set(eventos.map((evento) => evento.fecha_evento));
  const fuera = (opciones.sonda?.fechas || []).filter((fecha) => !conocidas.has(fecha));
  let existencia;
  if (encontrados >= solicitados) {
    existencia = anterioresEnVentana > 0 ? "hay_anteriores_en_la_ventana" : "cubierta";
  } else if (ventana === "completa") {
    existencia = "no_hay_mas_en_el_periodo";
  } else if (opciones.sonda?.fechas && fuera.length > 0) {
    existencia = "hay_eventos_fuera_de_la_ventana";
  } else if (opciones.sonda?.fechas && opciones.sonda.completa) {
    existencia = "no_hay_mas_en_el_periodo";
  } else {
    existencia = "indeterminada";
  }
  const variaciones = !encontrados
    ? "sin_eventos"
    : eventos.some((evento) => evento.comparable)
      ? "calculadas"
      : "insuficientes";
  const sePuedeAfirmarAusencia =
    existencia === "cubierta" ||
    existencia === "hay_anteriores_en_la_ventana" ||
    existencia === "no_hay_mas_en_el_periodo";
  return {
    solicitados,
    encontrados,
    anteriores_en_ventana: anterioresEnVentana,
    ventana,
    existencia,
    variaciones,
    se_puede_afirmar_ausencia: sePuedeAfirmarAusencia,
    ...(existencia === "hay_eventos_fuera_de_la_ventana"
      ? {
          fuera_de_ventana: fuera.slice(0, solicitados),
          nota: "Hay eventos de esta acción fuera de la ventana de registros. No se cruzaron y no se puede decir que no existan.",
        }
      : {}),
    ...(existencia === "indeterminada"
      ? { nota: "La ventana de registros está incompleta. No se puede afirmar que no haya eventos anteriores." }
      : {}),
  };
}

function conPolitica(datos) {
  return { ...datos, politica_mediciones: POLITICA_MEDICIONES };
}

function relacionarAntesDeVariacion(registros, opciones) {
  const puntos = serie(registros, opciones.claveParametro);
  let aumento = null;
  const incompatibles = [];
  for (let indice = 1; indice < puntos.length; indice += 1) {
    const desde = puntos[indice - 1];
    const hasta = puntos[indice];
    if (desde.advertencia || hasta.advertencia) continue;
    if (!mismaUnidad(desde, hasta)) {
      incompatibles.push({ desde: puntoVisible(desde), hasta: puntoVisible(hasta) });
      continue;
    }
    if (hasta.valor_numero > desde.valor_numero) {
      aumento = { desde, hasta, delta: redondear(hasta.valor_numero - desde.valor_numero) };
    }
  }
  if (!aumento) {
    return {
      modo: "antes_de_variacion",
      parametro: opciones.claveParametro,
      variacion: null,
      productos_entre_mediciones: [],
      unidades_incompatibles: incompatibles.slice(0, 3),
      sin_datos: true,
      nota: incompatibles.length ? NOTA_UNIDADES : "No hay un aumento entre mediciones comparables.",
    };
  }
  const inicio = instante(aumento.desde.fecha_evento);
  const fin = instante(aumento.hasta.fecha_evento);
  const productos = [];
  for (const registro of registros || []) {
    const momento = instante(registro.fecha_evento);
    if (momento == null || momento <= inicio || momento >= fin) continue;
    const nutrientes = productosDe(registro);
    if (!nutrientes.productos.length) continue;
    const local = momentoLocalDe(registro.fecha_evento);
    productos.push({
      fecha_evento: registro.fecha_evento,
      fecha_local: local.fecha_local,
      hora_local: local.hora_local,
      productos: nutrientes.productos,
      volumen_preparado: nutrientes.volumen_preparado,
    });
  }
  productos.sort((a, b) => instante(a.fecha_evento) - instante(b.fecha_evento));
  return {
    modo: "antes_de_variacion",
    parametro: opciones.claveParametro,
    variacion: {
      desde: puntoVisible(aumento.desde),
      hasta: puntoVisible(aumento.hasta),
      delta: aumento.delta,
      comparable: true,
      relacion: "temporal",
      atribucion: "no_determinada",
    },
    productos_entre_mediciones: productos.slice(0, TOPE_EVENTOS_CRUCE),
    unidades_incompatibles: incompatibles.slice(0, 3),
    sin_datos: false,
    parcial: productos.length > TOPE_EVENTOS_CRUCE,
    nota: NOTA_CAUSA,
  };
}

function etapaPorClave(etapas, clave) {
  const buscada = String(clave || "").trim().toLowerCase();
  return (etapas || []).find(
    (etapa) =>
      String(etapa.etapa || "").toLowerCase() === buscada ||
      String(etapa.etapa_nombre || "").toLowerCase() === buscada,
  );
}

function diaEnEtapa(dia, etapa, etapas) {
  if (!dia || !etapa?.fechaInicio || dia < etapa.fechaInicio) return false;
  if (etapa.fechaFin && dia > etapa.fechaFin) return false;
  if (etapa.fechaFin && dia === etapa.fechaFin) {
    const empiezaOtra = (etapas || []).some(
      (otra) => otra !== etapa && otra.fechaInicio === dia,
    );
    if (empiezaOtra) return false;
  }
  return true;
}

function registrosEnEtapa(registros, etapa, etapas) {
  return (registros || []).filter((registro) => diaEnEtapa(diaArgentina(registro.fecha_evento), etapa, etapas));
}

function resumenVentana(registros, etapa, etapas, clave) {
  const dentro = registrosEnEtapa(registros, etapa, etapas);
  const puntos = serie(dentro, clave);
  const mostrados = puntos.slice(0, TOPE_PUNTOS_CRUCE).map(puntoVisible);
  const utiles = puntos.filter((punto) => !punto.advertencia);
  const unidades = [...new Set(utiles.map((punto) => String(punto.unidad || "")))];
  const comparableSerie = utiles.length > 0 && unidades.length === 1;
  const valores = utiles.map((punto) => punto.valor_numero);
  const productos = [];
  const vistos = new Map();
  for (const registro of dentro) {
    for (const producto of productosDe(registro).productos) {
      const id = `${producto.nombre_producto}||${producto.fabricante || ""}`;
      const previo = vistos.get(id);
      if (previo) previo.aplicaciones += 1;
      else {
        const copia = { ...producto, aplicaciones: 1 };
        vistos.set(id, copia);
        productos.push(copia);
      }
    }
  }
  return {
    etapa: etapa.etapa,
    etapa_nombre: etapa.etapa_nombre || etapa.etapa,
    desde: etapa.fechaInicio,
    hasta: etapa.fechaFin,
    mediciones: mostrados,
    sospechosos: puntos.filter((punto) => punto.advertencia).length,
    estadisticas: comparableSerie
      ? {
          minimo: Math.min(...valores),
          maximo: Math.max(...valores),
          promedio: redondear(valores.reduce((suma, valor) => suma + valor, 0) / valores.length),
          cantidad: utiles.length,
          unidad: unidades[0],
        }
      : null,
    comparable: comparableSerie,
    productos: productos.slice(0, TOPE_EVENTOS_CRUCE),
    sin_datos: puntos.length === 0,
    parcial: puntos.length > TOPE_PUNTOS_CRUCE,
    ...(unidades.length > 1 ? { nota_unidades: NOTA_UNIDADES } : {}),
  };
}

function relacionarDuranteEtapa(registros, opciones) {
  const etapa = etapaPorClave(opciones.etapas, opciones.etapa);
  if (!etapa) {
    return {
      modo: "durante_etapa",
      parametro: opciones.claveParametro,
      etapa: null,
      sin_datos: true,
      nota: "No hay una etapa con ese nombre en la planta.",
    };
  }
  const ventana = resumenVentana(registros, etapa, opciones.etapas, opciones.claveParametro);
  return {
    modo: "durante_etapa",
    parametro: opciones.claveParametro,
    ...ventana,
    relacion: "temporal",
    atribucion: "no_determinada",
    nota: ventana.sin_datos ? "No hay mediciones de ese parámetro durante la etapa." : NOTA_CAUSA,
  };
}

function relacionarEntreEtapas(registros, opciones) {
  const etapaA = etapaPorClave(opciones.etapas, opciones.etapa);
  const etapaB = etapaPorClave(opciones.etapas, opciones.etapaB);
  if (!etapaA || !etapaB) {
    return {
      modo: "entre_etapas",
      parametro: opciones.claveParametro,
      sin_datos: true,
      nota: "Falta una de las dos etapas en el historial de la planta.",
    };
  }
  const a = resumenVentana(registros, etapaA, opciones.etapas, opciones.claveParametro);
  const b = resumenVentana(registros, etapaB, opciones.etapas, opciones.claveParametro);
  const misma =
    a.comparable &&
    b.comparable &&
    a.estadisticas.unidad === b.estadisticas.unidad;
  return {
    modo: "entre_etapas",
    parametro: opciones.claveParametro,
    etapa_a: a,
    etapa_b: b,
    diferencia_promedio: misma ? redondear(b.estadisticas.promedio - a.estadisticas.promedio) : null,
    comparable: misma,
    relacion: "temporal",
    atribucion: "no_determinada",
    sin_datos: a.sin_datos && b.sin_datos,
    parcial: a.parcial || b.parcial,
    nota: misma ? NOTA_CAUSA : a.sin_datos || b.sin_datos ? "Una etapa no tiene mediciones suficientes." : NOTA_UNIDADES,
  };
}

export function relacionarEvolucion(registros, opciones = {}) {
  if (opciones.modo === "despues_de_accion") return conPolitica(relacionarDespuesDeAccion(registros, opciones));
  if (opciones.modo === "antes_de_variacion") return conPolitica(relacionarAntesDeVariacion(registros, opciones));
  if (opciones.modo === "durante_etapa") return conPolitica(relacionarDuranteEtapa(registros, opciones));
  if (opciones.modo === "entre_etapas") return conPolitica(relacionarEntreEtapas(registros, opciones));
  return conPolitica({ sin_datos: true, nota: "Modo de análisis inválido." });
}
