import {
  diaDelCultivo,
  PARAMETROS_HISTORIAL,
  VERSION_HISTORIAL,
} from "@/lib/demo/historial/normalizar-historial";
import { ETAPAS, diasEntre, esEtapa, fechaValida } from "@/lib/etapas";
import { compararEventos, diaArgentina, horaArgentina } from "@/lib/historial-registros";
import { agruparRegistrosPorDia } from "@/lib/historial-paginacion-dias";
import { normalizarGenetica } from "@/lib/registros";

const ACCION_TIPO = {
  riego: "riego",
  fertilizacion: "fertilizacion",
  defoliacion: "defoliacion",
  poda: "poda",
  entrenamiento: "entrenamiento",
  trasplante: "trasplante",
  cambio_solucion: "cambio_solucion",
};

function claveParametroNativo(fila) {
  const clave = String(fila?.clave_nativa || "").trim().toLowerCase();
  if (clave) return clave;
  if (fila?.tipo_valor !== "numero") return "";
  const nombre = String(fila?.nombre || "").trim().toLowerCase();
  if (!nombre) return "";
  return `custom:${nombre}`;
}

function medicionDesdeParametro(fila) {
  if (!fila || fila.tipo_valor !== "numero") return null;
  if (fila.valor_numero === null || fila.valor_numero === undefined || fila.valor_numero === "") return null;
  const parametro = claveParametroNativo(fila);
  if (!parametro) return null;
  const valor = Number(fila.valor_numero);
  if (!Number.isFinite(valor)) return null;
  const catalogo = PARAMETROS_HISTORIAL.find((item) => item.clave === parametro);
  const decimales = catalogo?.decimales ?? 2;
  const factor = 10 ** decimales;
  return { parametro, valor: Math.round(valor * factor) / factor, unidad: fila.unidad || catalogo?.unidad || "" };
}

function tipoAccionDesdeClave(clave) {
  const normalizada = String(clave || "").trim().toLowerCase();
  return ACCION_TIPO[normalizada] || "otra";
}

function accionDesdeRegistro(fila) {
  return {
    tipo: tipoAccionDesdeClave(fila?.clave_nativa),
    etiqueta: String(fila?.nombre || "Acción").trim() || "Acción",
    nota: null,
  };
}

function soloFecha(valor) {
  const texto = String(valor ?? "").slice(0, 10);
  return fechaValida(texto) ? texto : "";
}

export function normalizarEtapasPlanta(filas, fechaInicioCultivo, fechaCorte) {
  const validas = (Array.isArray(filas) ? filas : [])
    .filter((item) => item && soloFecha(item.fecha_inicio))
    .map((item, indice) => ({
      id: item.id || `etapa-${indice + 1}`,
      etapa: item.etapa,
      nombreOrigen: null,
      fechaInicio: soloFecha(item.fecha_inicio),
      fechaFin: soloFecha(item.fecha_fin) || null,
    }))
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

  return validas.map((item) => {
    const cierre = item.fechaFin || fechaCorte;
    return {
      ...item,
      actual: !item.fechaFin,
      diaInicio: diaDelCultivo(fechaInicioCultivo, item.fechaInicio),
      diaFin: item.fechaFin ? diaDelCultivo(fechaInicioCultivo, item.fechaFin) : null,
      duracion: Math.max(0, diasEntre(item.fechaInicio, cierre)),
    };
  });
}

function etapaEnFecha(etapas, fecha) {
  let activa = null;
  for (const etapa of etapas) {
    if (etapa.fechaInicio > fecha) continue;
    if (etapa.fechaFin && etapa.fechaFin <= fecha) continue;
    if (!activa || etapa.fechaInicio >= activa.fechaInicio) activa = etapa;
  }
  return activa;
}

function etapaSiUnanime(etapas) {
  if (!etapas.length || etapas.some((etapa) => !etapa)) return "";
  const primera = etapas[0];
  return etapas.every((etapa) => etapa === primera) ? primera : "";
}

/**
 * Etapa de un registro según el historial real.
 * Con una sola línea de etapas en el alcance, esa línea vale para el registro.
 * Con varias plantas, una medición de plantas solo entra en una etapa si todas
 * las plantas vinculadas coinciden ese día. Una medición de ambiente solo entra
 * si todas las plantas del alcance comparten la misma etapa; si no, queda sin etapa.
 */
export function resolverEtapaRegistro({ registro, fecha, etapas = [], etapasPorPlanta = null }) {
  if (!fecha || !registro) return "";
  const varias = Array.isArray(etapasPorPlanta) && etapasPorPlanta.length > 1;
  if (!varias && etapas.length) {
    return etapaEnFecha(etapas, fecha)?.etapa || "";
  }
  if (!etapasPorPlanta?.length) return "";

  if (registro.aplica_a === "ambiente") {
    const etapasDia = etapasPorPlanta.map(
      (grupo) => etapaEnFecha(grupo.etapas || [], fecha)?.etapa || ""
    );
    return etapaSiUnanime(etapasDia);
  }

  const ids = new Set(
    (registro.registro_plantas || []).map((fila) => fila.planta_id).filter(Boolean)
  );
  if (!ids.size) return "";
  const grupos = etapasPorPlanta.filter((grupo) => ids.has(grupo.plantaId));
  if (!grupos.length || grupos.length !== ids.size) return "";
  const etapasDia = grupos.map((grupo) => etapaEnFecha(grupo.etapas || [], fecha)?.etapa || "");
  return etapaSiUnanime(etapasDia);
}

export function fechaInicioAlcanceHistorial(plantas, plantaId) {
  return fechaInicioReferencia(plantas, plantaId);
}

export function puntosMedicionDesdeRegistros(registros, { etapas = [], etapasPorPlanta = null, fechaInicio = null } = {}) {
  const puntos = [];
  for (const registro of registros || []) {
    const fecha = diaArgentina(registro.fecha_evento);
    if (!fecha) continue;
    const etapa = resolverEtapaRegistro({ registro, fecha, etapas, etapasPorPlanta });
    const dia = fechaInicio ? diaDelCultivo(fechaInicio, fecha) : null;
    for (const fila of registro.registro_parametros || []) {
      const medicion = medicionDesdeParametro(fila);
      if (!medicion) continue;
      puntos.push({
        ...medicion,
        fecha,
        dia,
        etapa,
        ambiente: registro.aplica_a === "ambiente",
      });
    }
  }
  return puntos;
}

export function etapasParaFiltroHistorial(historial) {
  const vistas = new Set();
  for (const etapa of historial?.etapas || []) {
    if (etapa?.etapa) vistas.add(etapa.etapa);
  }
  for (const grupo of historial?.etapasPorPlanta || []) {
    for (const etapa of grupo.etapas || []) {
      if (etapa?.etapa) vistas.add(etapa.etapa);
    }
  }
  const indice = new Map(ETAPAS.map((etapa, posicion) => [etapa.valor, posicion]));
  return [...vistas].sort((a, b) => {
    const ia = indice.has(a) ? indice.get(a) : 99;
    const ib = indice.has(b) ? indice.get(b) : 99;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, "es");
  });
}

export function metricaDeSerie(serie, decimales = 2) {
  const valores = (serie || []).map((punto) => punto.valor).filter((valor) => Number.isFinite(valor));
  if (!valores.length) return null;
  const suma = valores.reduce((total, valor) => total + valor, 0);
  return {
    cantidad: valores.length,
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
    promedio: redondear(suma / valores.length, decimales),
  };
}

export function serieMedicionesHistorial(historial, clave, etapa = "") {
  const fuente = Array.isArray(historial?.puntosMedicion)
    ? historial.puntosMedicion
    : serieDesdeDias(historial);
  return fuente
    .filter((punto) => punto?.parametro === clave && (!etapa || punto.etapa === etapa))
    .slice()
    .sort((a, b) => {
      const da = a.dia ?? -1;
      const db = b.dia ?? -1;
      if (da !== db) return da - db;
      return String(a.fecha || "").localeCompare(String(b.fecha || ""));
    });
}

function serieDesdeDias(historial) {
  const serie = [];
  for (const dia of historial?.dias || []) {
    for (const medicion of dia.mediciones || []) {
      if (!medicion?.parametro) continue;
      serie.push({
        parametro: medicion.parametro,
        valor: medicion.valor,
        unidad: medicion.unidad || "",
        dia: dia.dia,
        fecha: dia.fecha,
        etapa: medicion.etapa || dia.etapa || "",
      });
    }
  }
  return serie;
}

function fechaInicioReferencia(plantas, plantaId) {
  if (plantaId) {
    const planta = plantas.find((item) => item.id === plantaId);
    const inicio = soloFecha(planta?.fecha_inicio);
    return inicio || null;
  }
  const inicios = plantas.map((planta) => soloFecha(planta.fecha_inicio)).filter(Boolean).sort();
  return inicios[0] || null;
}

function geneticasTexto(plantas) {
  const etiquetas = [
    ...new Set(
      plantas
        .map((planta) => String(planta.genetica || "").trim())
        .filter(Boolean)
    ),
  ];
  if (!etiquetas.length) return "";
  if (etiquetas.length <= 2) return etiquetas.join(" · ");
  return `${etiquetas.slice(0, 2).join(" · ")} +${etiquetas.length - 2}`;
}

function metodoTexto(plantas) {
  const metodos = [
    ...new Set(
      plantas
        .map((planta) => String(planta.metodo || "").trim())
        .filter(Boolean)
    ),
  ];
  return metodos.length === 1 ? metodos[0] : metodos.length > 1 ? "Varios métodos" : "";
}

function estadoUnidad(plantas) {
  if (!plantas.length) return "en_curso";
  const activas = plantas.filter((planta) => planta.estado !== "finalizada" && planta.estado !== "archivada");
  if (!activas.length) return "finalizado";
  return "en_curso";
}

function etapasActuales(plantas) {
  const etapas = [...new Set(plantas.map((planta) => planta.etapa).filter((etapa) => esEtapa(etapa)))];
  return etapas;
}

function fotoPresentacion(foto, registro, diaCalendario, diaCultivo, idsVistos) {
  if (!foto?.id || idsVistos.has(foto.id)) return null;
  idsVistos.add(foto.id);
  const miniatura = foto.url_miniatura || "";
  const url = miniatura;
  return {
    id: foto.id,
    tipo: "registro",
    fecha: diaCalendario,
    dia: diaCultivo,
    diaId: `dia-${diaCalendario}`,
    url,
    miniatura,
    ancho: foto.ancho || 1200,
    alto: foto.alto || 900,
    anchoMiniatura: 480,
    altoMiniatura: Math.round((480 * (foto.alto || 900)) / (foto.ancho || 1200)) || 360,
    descripcion: foto.descripcion || null,
    registroId: registro.id,
  };
}

function eventoDesdeRegistro(registro, diaCultivo, etapaDia) {
  const acciones = (registro.registro_acciones || []).map(accionDesdeRegistro);
  const mediciones = (registro.registro_parametros || [])
    .map(medicionDesdeParametro)
    .filter(Boolean);
  const nota = String(registro.observacion || "").trim() || null;
  const ambiente = registro.aplica_a === "ambiente";
  return {
    id: registro.id,
    hora: horaArgentina(registro.fecha_evento),
    ambiente,
    alcance: registro.alcance,
    acciones,
    mediciones,
    nota,
    registro,
    etapa: etapaDia?.etapa || "",
    dia: diaCultivo,
    fotosIds: (registro.registro_fotos || []).map((foto) => foto.id).filter(Boolean),
  };
}

function redondear(valor, decimales) {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function calcularMetricasDesdeDias(dias) {
  const porClave = new Map();
  for (const dia of dias) {
    for (const medicion of dia.mediciones) {
      if (!medicion.parametro) continue;
      const lista = porClave.get(medicion.parametro) || [];
      lista.push(medicion.valor);
      porClave.set(medicion.parametro, lista);
    }
  }

  const resultado = {};
  for (const [clave, valores] of porClave.entries()) {
    if (!valores.length) continue;
    const catalogo = PARAMETROS_HISTORIAL.find((item) => item.clave === clave);
    const decimales = catalogo?.decimales ?? 2;
    const suma = valores.reduce((total, valor) => total + valor, 0);
    resultado[clave] = {
      etiqueta: catalogo?.etiqueta || (clave.startsWith("custom:") ? clave.slice(7) : clave),
      unidad: catalogo?.unidad || "",
      cantidad: valores.length,
      minimo: Math.min(...valores),
      maximo: Math.max(...valores),
      promedio: redondear(suma / valores.length, decimales),
      primero: valores[0],
      ultimo: valores.at(-1),
    };
  }
  return resultado;
}

function metricasDesdePuntos(puntos) {
  const porClave = new Map();
  for (const punto of puntos || []) {
    if (!punto?.parametro || !Number.isFinite(punto.valor)) continue;
    const lista = porClave.get(punto.parametro) || [];
    lista.push(punto);
    porClave.set(punto.parametro, lista);
  }

  const resultado = {};
  for (const [clave, lista] of porClave.entries()) {
    const catalogo = PARAMETROS_HISTORIAL.find((item) => item.clave === clave);
    const decimales = catalogo?.decimales ?? 2;
    const valores = lista.map((punto) => punto.valor);
    const suma = valores.reduce((total, valor) => total + valor, 0);
    resultado[clave] = {
      etiqueta: catalogo?.etiqueta || (clave.startsWith("custom:") ? clave.slice(7) : clave),
      unidad: catalogo?.unidad || lista.find((punto) => punto.unidad)?.unidad || "",
      cantidad: valores.length,
      minimo: Math.min(...valores),
      maximo: Math.max(...valores),
      promedio: redondear(suma / valores.length, decimales),
      primero: valores[0],
      ultimo: valores.at(-1),
    };
  }
  return resultado;
}

function construirDias(registros, etapas, etapasPorPlanta, fechaInicio) {
  const fotos = [];
  const idsFotos = new Set();
  const dias = [];

  for (const grupo of agruparRegistrosPorDia(registros)) {
    const fecha = grupo.fecha;
    const etapaDia = etapas.length ? etapaEnFecha(etapas, fecha) : null;
    const diaCultivo = fechaInicio ? diaDelCultivo(fechaInicio, fecha) : null;
    const idDia = `dia-${fecha}`;
    const eventos = grupo.registros
      .sort((a, b) => new Date(a.fecha_evento).getTime() - new Date(b.fecha_evento).getTime())
      .map((registro) => {
        const etapaRegistro = resolverEtapaRegistro({
          registro,
          fecha,
          etapas,
          etapasPorPlanta,
        });
        const evento = eventoDesdeRegistro(
          registro,
          diaCultivo,
          etapaRegistro ? { etapa: etapaRegistro } : etapaDia
        );
        return evento;
      });

    const acciones = [];
    const mediciones = [];
    const notas = [];
    const idsFotosDia = [];

    for (const evento of eventos) {
      acciones.push(...evento.acciones);
      mediciones.push(...evento.mediciones.map((medicion) => ({ ...medicion, etapa: evento.etapa || "" })));
      if (evento.nota) notas.push(evento.nota);
      for (const foto of evento.registro.registro_fotos || []) {
        const normalizada = fotoPresentacion(foto, evento.registro, fecha, diaCultivo, idsFotos);
        if (!normalizada) continue;
        fotos.push(normalizada);
        idsFotosDia.push(normalizada.id);
        evento.fotosIds = [...new Set([...(evento.fotosIds || []), normalizada.id])];
      }
    }

    dias.push({
      id: idDia,
      dia: diaCultivo,
      fecha,
      etapa: etapaDia?.etapa || "",
      etapaId: etapaDia?.id || null,
      nota: notas.length === 1 ? notas[0] : null,
      notas,
      acciones,
      mediciones,
      fotos: idsFotosDia,
      eventos,
      resumen: {
        nota: notas.length,
        acciones: acciones.length,
        mediciones: mediciones.length,
        fotos: idsFotosDia.length,
        eventos: eventos.length,
      },
    });
  }

  return { dias, fotos };
}

export function construirHistorialVista({
  unidad,
  espacioNombre = "",
  tipoEspacio = "",
  plantas = [],
  plantaId = null,
  etapas = [],
  etapasPorPlanta = null,
  registros = [],
  resumen = null,
  portada = null,
  fechaCorte = "",
  diaReferenciaUnidad = false,
  puntosMedicion = undefined,
}) {
  const plantasAlcance = plantaId ? plantas.filter((planta) => planta.id === plantaId) : plantas;
  const fechaInicio = fechaInicioReferencia(plantasAlcance, plantaId);
  const corte = soloFecha(fechaCorte) || soloFecha(new Date().toISOString());
  const etapasVista = etapas.length ? etapas : [];
  const { dias, fotos } = construirDias(registros, etapasVista, etapasPorPlanta, fechaInicio);
  const ultimoRegistro = [...registros].sort(compararEventos)[0];
  const fechaUltimoRegistro = ultimoRegistro ? diaArgentina(ultimoRegistro.fecha_evento) : corte;

  const etapasPresentes = etapasActuales(plantasAlcance);
  const etapaActual = etapasPresentes.length === 1 ? etapasPresentes[0] : "";

  const metricas = Array.isArray(puntosMedicion)
    ? metricasDesdePuntos(puntosMedicion)
    : calcularMetricasDesdeDias(dias);

  const resumenFinal = resumen || {
    diasRegistrados: new Set(registros.map((r) => diaArgentina(r.fecha_evento)).filter(Boolean)).size,
    fotos: fotos.length + (portada ? 1 : 0),
    fotosDeRegistros: fotos.length,
    mediciones: dias.reduce((suma, dia) => suma + dia.mediciones.length, 0),
    acciones: dias.reduce((suma, dia) => suma + dia.acciones.length, 0),
    etapas: etapasVista.length,
    plantas: plantasAlcance.length,
    rango: {
      desde: dias.at(-1)?.fecha || fechaInicio || corte,
      hasta: dias[0]?.fecha || fechaUltimoRegistro,
    },
  };

  return {
    version: VERSION_HISTORIAL,
    fechaCorte: fechaUltimoRegistro || corte,
    modoApp: true,
    cultivo: {
      id: unidad.id,
      nombre: unidad.nombre,
      espacioNombre,
      tipoEspacio: tipoEspacio === "interior" || tipoEspacio === "exterior" ? tipoEspacio : "",
      metodo: metodoTexto(plantasAlcance),
      genetica: geneticasTexto(plantasAlcance),
      estado: estadoUnidad(plantasAlcance),
      fechaInicio,
      diaActual: fechaInicio ? diaDelCultivo(fechaInicio, corte) : null,
      diaReferenciaUnidad: Boolean(!plantaId && plantasAlcance.length > 1 && fechaInicio),
      etapaActual,
      etapasActuales: etapasPresentes,
      cantidadPlantas: plantasAlcance.length,
      portada,
    },
    plantas: plantasAlcance.map((planta) => ({
      id: planta.id,
      nombre: planta.nombre,
      numero: planta.numero,
      genetica: planta.genetica,
      metodo: planta.metodo,
      estado: planta.estado,
    })),
    etapas: etapasVista,
    etapasPorPlanta,
    dias,
    fotos,
    resumen: resumenFinal,
    metricas,
    puntosMedicion: Array.isArray(puntosMedicion) ? puntosMedicion : null,
    parametrosExtra: Object.keys(metricas).filter((clave) => !PARAMETROS_HISTORIAL.some((p) => p.clave === clave)),
  };
}

export function filtrarPlantasPorGenetica(plantas, genetica) {
  if (!genetica) return plantas;
  const clave = normalizarGenetica(genetica);
  return plantas.filter((planta) => normalizarGenetica(planta.genetica) === clave);
}
