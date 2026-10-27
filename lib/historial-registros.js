import { fechaValida } from "@/lib/etapas";
import { ALCANCES_REGISTRO, normalizarGenetica } from "@/lib/registros";

export const TAMANO_PAGINA_HISTORIAL = 15;
export const ZONA_HISTORIAL = "America/Argentina/Buenos_Aires";

export const CONTENIDOS_HISTORIAL = ["acciones", "parametros", "observaciones"];

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor) {
  return UUID.test(String(valor || "").trim());
}

function textoParametro(valor) {
  if (Array.isArray(valor)) return valor.map((item) => String(item)).join(",");
  if (valor == null) return "";
  return String(valor);
}

function tokensContenido(valor) {
  return textoParametro(valor)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function filtrosDesdeConsulta(parametros = {}) {
  return normalizarFiltrosHistorial({
    unidad: textoParametro(parametros.unidad),
    planta: textoParametro(parametros.planta),
    genetica: textoParametro(parametros.genetica),
    desde: textoParametro(parametros.desde),
    hasta: textoParametro(parametros.hasta),
    contenido: textoParametro(parametros.contenido),
    cursorFecha: textoParametro(parametros.cursorFecha),
    cursorId: textoParametro(parametros.cursorId),
  });
}

export function normalizarFiltrosHistorial(entrada = {}) {
  const unidad = String(entrada.unidad || "").trim();
  const planta = String(entrada.planta || "").trim();
  const geneticaCruda = String(entrada.genetica || "").trim();
  const desde = String(entrada.desde || "").trim();
  const hasta = String(entrada.hasta || "").trim();
  const cursorFecha = String(entrada.cursorFecha || "").trim();
  const cursorId = String(entrada.cursorId || "").trim();

  if (unidad && !esUuid(unidad)) {
    return { error: "El filtro de unidad no es válido.", filtros: null };
  }
  if (planta && !esUuid(planta)) {
    return { error: "El filtro de planta no es válido.", filtros: null };
  }
  if (desde && !fechaValida(desde)) {
    return { error: "La fecha de inicio no es válida.", filtros: null };
  }
  if (hasta && !fechaValida(hasta)) {
    return { error: "La fecha de fin no es válida.", filtros: null };
  }
  if (desde && hasta && desde > hasta) {
    return { error: "El período no es válido.", filtros: null };
  }

  const tokens = tokensContenido(entrada.contenido);
  let contenidos = [...CONTENIDOS_HISTORIAL];
  let sinContenido = false;

  if (tokens.length === 1 && tokens[0] === "ninguno") {
    contenidos = [];
    sinContenido = true;
  } else if (tokens.length > 0) {
    const unicos = [];
    for (const token of tokens) {
      if (!CONTENIDOS_HISTORIAL.includes(token)) {
        return { error: "El tipo de contenido no es válido.", filtros: null };
      }
      if (!unicos.includes(token)) unicos.push(token);
    }
    contenidos = unicos;
  }

  let cursor = null;
  if (cursorFecha || cursorId) {
    const instante = new Date(cursorFecha);
    if (!cursorFecha || Number.isNaN(instante.getTime()) || !esUuid(cursorId)) {
      return { error: "No se pudo continuar el historial.", filtros: null };
    }
    cursor = { fecha: cursorFecha, id: cursorId };
  }

  const genetica = geneticaCruda ? normalizarGenetica(geneticaCruda) : "";
  if (geneticaCruda && !genetica) {
    return { error: "La genética no es válida.", filtros: null };
  }

  return {
    error: "",
    filtros: {
      unidadId: unidad || null,
      plantaId: planta || null,
      genetica: genetica || null,
      desde: desde || null,
      hasta: hasta || null,
      contenidos,
      sinContenido,
      cursor,
    },
  };
}

export function hrefHistorial(filtros = {}) {
  const params = new URLSearchParams();
  if (filtros.unidadId) params.set("unidad", filtros.unidadId);
  if (filtros.plantaId) params.set("planta", filtros.plantaId);
  if (filtros.genetica) params.set("genetica", filtros.genetica);
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.sinContenido) {
    params.set("contenido", "ninguno");
  } else if (filtros.contenidos && filtros.contenidos.length < CONTENIDOS_HISTORIAL.length) {
    params.set("contenido", filtros.contenidos.join(","));
  }
  const consulta = params.toString();
  return consulta ? `/registros/historial?${consulta}` : "/registros/historial";
}

export function ramasDeContenido(contenidos) {
  if (!contenidos || contenidos.length === 0 || contenidos.length === CONTENIDOS_HISTORIAL.length) {
    return ["todos"];
  }
  return CONTENIDOS_HISTORIAL.filter((item) => contenidos.includes(item));
}

export function ramasDeGenetica(genetica) {
  return genetica ? ["clave", "snapshot"] : ["todas"];
}

export function rangoDiaArgentina(fechaTexto) {
  const inicio = new Date(`${fechaTexto}T00:00:00.000-03:00`);
  const fin = new Date(`${fechaTexto}T23:59:59.999-03:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
  return { desde: inicio.toISOString(), hasta: fin.toISOString() };
}

export function limitesFechaHistorial(desde, hasta) {
  const inicio = desde ? rangoDiaArgentina(desde) : null;
  const fin = hasta ? rangoDiaArgentina(hasta) : null;
  if (desde && !inicio) return null;
  if (hasta && !fin) return null;
  return {
    desde: inicio?.desde || null,
    hasta: fin?.hasta || null,
  };
}

export function diaArgentina(fechaIso) {
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HISTORIAL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

export function horaArgentina(fechaIso) {
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HISTORIAL,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(fecha);
}

export function etiquetaDiaArgentina(fechaIsoODia) {
  const dia = String(fechaIsoODia || "");
  const calendario = /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : diaArgentina(dia);
  if (!calendario) return "";
  const [anio, mes, numero] = calendario.split("-").map(Number);
  const marca = new Date(Date.UTC(anio, mes - 1, numero, 15, 0, 0));
  const texto = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(marca);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function compararEventos(a, b) {
  const fa = new Date(a.fecha_evento).getTime();
  const fb = new Date(b.fecha_evento).getTime();
  if (fa !== fb) return fb - fa;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function fusionarPaginaHistorial(ramas, limite) {
  const mapa = new Map();
  for (const rama of ramas) {
    const filas = rama.filas || [];
    for (const fila of filas.slice(0, limite)) {
      if (!mapa.has(fila.id)) mapa.set(fila.id, fila);
    }
  }
  const ordenadas = [...mapa.values()].sort(compararEventos);
  const sobra = ramas.some((rama) => rama.hayMas || (rama.filas || []).length > limite);
  return {
    registros: ordenadas.slice(0, limite),
    hayMas: sobra || ordenadas.length > limite,
  };
}

export function coincideContenido(registro, contenidos) {
  if (!contenidos || contenidos.length === 0 || contenidos.length === CONTENIDOS_HISTORIAL.length) {
    return true;
  }
  return contenidos.some((tipo) => {
    switch (tipo) {
      case "acciones":
        return (registro.registro_acciones || []).length > 0;
      case "parametros":
        return (registro.registro_parametros || []).length > 0;
      case "observaciones":
        return Boolean(String(registro.observacion || "").trim());
      default:
        return false;
    }
  });
}

export function textoValorParametro(fila) {
  if (!fila) return "—";
  if (fila.tipo_valor === "texto") {
    return String(fila.valor_texto || "").trim() || "—";
  }
  if (fila.valor_numero === null || fila.valor_numero === undefined || fila.valor_numero === "") {
    return "—";
  }
  const unidad = String(fila.unidad || "").trim();
  return unidad ? `${fila.valor_numero} ${unidad}` : String(fila.valor_numero);
}

export function etiquetaAlcanceHistorico(registro) {
  const base =
    ALCANCES_REGISTRO.find((item) => item.valor === registro?.alcance)?.etiqueta ||
    registro?.alcance ||
    "—";
  if (registro?.alcance === "genetica" && registro.genetica_etiqueta) {
    return `${base}: ${registro.genetica_etiqueta}`;
  }
  return base;
}

export function etiquetaOrigen(origen) {
  if (origen === "personalizada") return "Personalizada";
  if (origen === "nativa") return "Nativa";
  return "";
}

export function nombreUnidadOriginal(registro, unidades = []) {
  const nombres = [
    ...new Set(
      (registro?.registro_plantas || [])
        .map((fila) => String(fila.nombre_unidad || "").trim())
        .filter(Boolean)
    ),
  ];
  if (nombres.length) return nombres.join(", ");
  const actual = (unidades || []).find((item) => item.id === registro?.unidad_cultivo_id);
  return actual?.nombre || "Sin unidad";
}

export function etapasVisibles(etapas, registros, hayMas) {
  const lista = etapas || [];
  if (!hayMas) return lista;
  if (!registros?.length) return [];
  const dias = registros.map((registro) => diaArgentina(registro.fecha_evento)).filter(Boolean).sort();
  const masAntiguo = dias[0];
  if (!masAntiguo) return [];
  return lista.filter((etapa) => String(etapa.fecha_inicio || "") >= masAntiguo);
}

export function agruparHistorial(registros, etapas = []) {
  const eventos = [
    ...(registros || []).map((registro) => ({
      tipo: "registro",
      id: registro.id,
      dia: diaArgentina(registro.fecha_evento),
      orden: new Date(registro.fecha_evento).getTime(),
      registro,
    })),
    ...(etapas || []).map((etapa) => ({
      tipo: "etapa",
      id: `etapa-${etapa.id}`,
      dia: String(etapa.fecha_inicio || ""),
      orden: 0,
      etapa,
    })),
  ].filter((evento) => evento.dia);

  eventos.sort((a, b) => {
    if (a.dia !== b.dia) return a.dia < b.dia ? 1 : -1;
    if (a.orden !== b.orden) return b.orden - a.orden;
    if (a.id === b.id) return 0;
    return a.id < b.id ? 1 : -1;
  });

  const grupos = [];
  for (const evento of eventos) {
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || ultimo.dia !== evento.dia) {
      grupos.push({
        dia: evento.dia,
        etiqueta: etiquetaDiaArgentina(evento.dia),
        eventos: [evento],
      });
    } else {
      ultimo.eventos.push(evento);
    }
  }
  return grupos;
}

export function citaFiltro(valor) {
  return `"${String(valor).replace(/"/g, '""')}"`;
}

export function patronExacto(valor) {
  return String(valor).replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}
