import { fechaValida } from "@/lib/etapas";
import { esUuid } from "@/lib/historial-registros";

export const TIPOS_TAREA = Object.freeze([
  Object.freeze({ valor: "riego", etiqueta: "Riego" }),
  Object.freeze({ valor: "fertilizacion", etiqueta: "Fertilización" }),
  Object.freeze({ valor: "poda", etiqueta: "Poda" }),
  Object.freeze({ valor: "revision", etiqueta: "Revisión" }),
  Object.freeze({ valor: "personalizada", etiqueta: "Personalizada" }),
]);

export const ESTADOS_TAREA = Object.freeze(["pendiente", "completada", "cancelada"]);
export const LIMITE_DESCRIPCION_TAREA_CALENDARIO = 500;

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function etiquetaTipo(tipo) {
  const item = TIPOS_TAREA.find((entrada) => entrada.valor === tipo);
  return item ? item.etiqueta : "Tarea";
}

export function etiquetaEstado(estado) {
  if (estado === "pendiente") return "Pendiente";
  if (estado === "completada") return "Completada";
  if (estado === "cancelada") return "Cancelada";
  return "";
}

export function esTipoTarea(tipo) {
  return TIPOS_TAREA.some((item) => item.valor === tipo);
}

export function horaValida(valor) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(valor || "").trim());
}

export function mesValido(valor) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(valor || ""));
}

function relleno(numero) {
  return String(numero).padStart(2, "0");
}

function isoUtc(fecha) {
  return `${fecha.getUTCFullYear()}-${relleno(fecha.getUTCMonth() + 1)}-${relleno(fecha.getUTCDate())}`;
}

export function normalizarConsulta(params, hoy) {
  const base = params || {};
  const hoyTexto = fechaValida(hoy) ? hoy : "";
  const mes = mesValido(base.mes) ? base.mes : (hoyTexto ? hoyTexto.slice(0, 7) : "");
  const estados = ["pendiente", "completada", "cancelada", "todas"];
  return {
    mes,
    unidad: esUuid(base.unidad) ? String(base.unidad).trim() : "",
    estado: estados.includes(base.estado) ? base.estado : "pendiente",
    fecha: fechaValida(base.fecha) ? base.fecha : "",
    tarea: esUuid(base.tarea) ? String(base.tarea).trim() : "",
    editar: esUuid(base.editar) ? String(base.editar).trim() : "",
    confirmar: esUuid(base.confirmar) ? String(base.confirmar).trim() : "",
    nueva: base.nueva === "1" || base.nueva === true,
    hoy: hoyTexto,
  };
}

export function fechaMasDias(fecha, dias) {
  const [anio, mes, dia] = String(fecha).split("-").map(Number);
  const siguiente = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return isoUtc(siguiente);
}

export function rangoMes(mes) {
  const [anio, numero] = String(mes).split("-").map(Number);
  const ultimo = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  return {
    desde: `${anio}-${relleno(numero)}-01`,
    hasta: `${anio}-${relleno(numero)}-${relleno(ultimo)}`,
  };
}

export function desplazarMes(mes, delta) {
  const [anio, numero] = String(mes).split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, numero - 1 + delta, 1));
  return `${fecha.getUTCFullYear()}-${relleno(fecha.getUTCMonth() + 1)}`;
}

export function nombreMes(mes) {
  const numero = Number(String(mes).split("-")[1]);
  const nombre = MESES[numero - 1] || "";
  if (!nombre) return String(mes || "");
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;
}

export function tituloMes(mes) {
  const [anio, numero] = String(mes).split("-").map(Number);
  const nombre = MESES[numero - 1] || "";
  if (!nombre) return mes;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

export function grillaMes(mes) {
  const [anio, numero] = String(mes).split("-").map(Number);
  const primero = new Date(Date.UTC(anio, numero - 1, 1));
  const desplazamiento = (primero.getUTCDay() + 6) % 7;
  const celdas = [];
  for (let indice = 0; indice < desplazamiento; indice += 1) {
    const fecha = new Date(Date.UTC(anio, numero - 1, 1 - (desplazamiento - indice)));
    celdas.push({ fecha: isoUtc(fecha), enMes: false });
  }
  const { hasta } = rangoMes(mes);
  const ultimo = Number(hasta.slice(-2));
  for (let dia = 1; dia <= ultimo; dia += 1) {
    celdas.push({
      fecha: `${anio}-${relleno(numero)}-${relleno(dia)}`,
      enMes: true,
    });
  }
  while (celdas.length < 42) {
    const previa = celdas[celdas.length - 1].fecha;
    const [y, m, d] = previa.split("-").map(Number);
    const siguiente = new Date(Date.UTC(y, m - 1, d + 1));
    celdas.push({ fecha: isoUtc(siguiente), enMes: false });
  }
  return celdas;
}

export function hrefCalendario(consulta = {}) {
  const q = new URLSearchParams();
  if (consulta.mes && mesValido(consulta.mes)) q.set("mes", consulta.mes);
  if (esUuid(consulta.unidad)) q.set("unidad", consulta.unidad);
  if (consulta.estado && consulta.estado !== "pendiente") q.set("estado", consulta.estado);
  if (fechaValida(consulta.fecha)) q.set("fecha", consulta.fecha);
  if (esUuid(consulta.tarea)) q.set("tarea", consulta.tarea);
  if (esUuid(consulta.editar)) q.set("editar", consulta.editar);
  if (esUuid(consulta.confirmar)) q.set("confirmar", consulta.confirmar);
  if (consulta.nueva) q.set("nueva", "1");
  const texto = q.toString();
  return texto ? `/calendario?${texto}` : "/calendario";
}

export function hrefDia(consulta, fecha) {
  const mismo = consulta?.fecha === fecha;
  return hrefCalendario({
    mes: String(fecha).slice(0, 7),
    unidad: consulta?.unidad || "",
    estado: consulta?.estado || "pendiente",
    fecha: mismo ? "" : fecha,
  });
}

export function accionDeTarea(tipo) {
  if (tipo === "riego" || tipo === "poda" || tipo === "fertilizacion") return tipo;
  return "";
}

export function claveAccionPrecargada(accion) {
  const tipo = accionDeTarea(accion);
  return tipo ? `nativa:${tipo}` : "";
}

export function itemPrecargaVisible(accion) {
  const tipo = accionDeTarea(accion);
  if (!tipo) return null;
  return { clave: tipo, etiqueta: etiquetaTipo(tipo) };
}

export function plantasDesdeConsulta(valor) {
  return String(valor || "")
    .split(",")
    .map((item) => item.trim())
    .filter((id) => esUuid(id))
    .slice(0, 80);
}

export function hrefRegistroDesdeTarea(tarea) {
  const params = new URLSearchParams();
  if (esUuid(tarea?.unidadId)) params.set("unidad", tarea.unidadId);
  const accion = accionDeTarea(tarea?.tipo);
  if (accion) params.set("accion", accion);
  const plantas = (tarea?.plantaIds || []).filter((id) => esUuid(id));
  if (plantas.length) params.set("plantas", plantas.join(","));
  if (esUuid(tarea?.id)) params.set("tarea", tarea.id);
  const texto = params.toString();
  return texto ? `/registros?${texto}` : "/registros";
}

export function notasVisibles(tarea) {
  if (!tarea) return "";
  if (tarea.tipo !== "personalizada" && tarea.descripcion === etiquetaTipo(tarea.tipo)) return "";
  return String(tarea.descripcion || "");
}

export function horaCorta(hora) {
  const coincidencia = /^(\d{2}):(\d{2})/.exec(String(hora || ""));
  return coincidencia ? `${coincidencia[1]}:${coincidencia[2]}` : "09:00";
}

export function aplicarPlantasIniciales(base, plantaIds, plantasUnidad) {
  if (!base?.unidadId) return base || { unidadId: "", modo: "unidad", ids: new Set() };
  const validas = new Set((plantasUnidad || []).map((planta) => planta.id));
  const elegidas = (plantaIds || []).filter((id) => validas.has(id));
  if (!elegidas.length) return base;
  const todas = (plantasUnidad || []).map((planta) => planta.id);
  if (elegidas.length >= todas.length) {
    return { unidadId: base.unidadId, modo: "unidad", ids: new Set(todas) };
  }
  return { unidadId: base.unidadId, modo: "manual", ids: new Set(elegidas) };
}

export function normalizarTarea(entrada, contexto) {
  const tipo = String(entrada?.tipo || "").trim();
  if (!esTipoTarea(tipo)) return { error: "Elegí un tipo de tarea." };

  const espacioId = String(entrada?.espacioId || "").trim();
  const unidadId = String(entrada?.unidadId || "").trim();
  if (!esUuid(espacioId)) return { error: "Seleccioná un espacio." };
  if (!esUuid(unidadId)) return { error: "Seleccioná una unidad." };

  const espacio = (contexto?.espacios || []).find((item) => item.id === espacioId);
  if (!espacio) return { error: "No se encontró el espacio." };
  const unidad = (espacio.unidades || []).find((item) => item.id === unidadId);
  if (!unidad) return { error: "La unidad no pertenece al espacio." };

  const fecha = String(entrada?.fecha || "").trim();
  if (!fechaValida(fecha)) return { error: "La fecha no es válida." };
  const anio = Number(fecha.slice(0, 4));
  if (anio < 2020 || anio > 2100) return { error: "La fecha no es válida." };

  const hora = String(entrada?.hora || "").trim();
  if (!horaValida(hora)) return { error: "La hora no es válida." };

  const notas = String(entrada?.descripcion || "").trim();
  if (tipo === "personalizada" && !notas) return { error: "Escribí la tarea." };
  if (notas.length > LIMITE_DESCRIPCION_TAREA_CALENDARIO) {
    return { error: `La tarea admite hasta ${LIMITE_DESCRIPCION_TAREA_CALENDARIO} caracteres.` };
  }

  const permitidas = new Set((unidad.plantas || []).map((planta) => planta.id));
  const plantaIds = [];
  for (const id of entrada?.plantaIds || []) {
    const limpio = String(id || "").trim();
    if (!limpio) continue;
    if (!esUuid(limpio) || !permitidas.has(limpio)) {
      return { error: "Una planta no pertenece a la unidad." };
    }
    if (!plantaIds.includes(limpio)) plantaIds.push(limpio);
  }

  const id = String(entrada?.id || "").trim();
  if (id && !esUuid(id)) return { error: "No se encontró la tarea." };

  return {
    id: id || null,
    espacioId,
    unidadId,
    tipo,
    descripcion: notas || etiquetaTipo(tipo),
    fecha,
    hora,
    plantaIds,
    avisoPush: entrada?.avisoPush !== false,
  };
}

export function conteoPorDia(tareas) {
  const mapa = new Map();
  for (const tarea of tareas || []) {
    const fecha = String(tarea.fecha || "").slice(0, 10);
    if (!fechaValida(fecha)) continue;
    mapa.set(fecha, (mapa.get(fecha) || 0) + 1);
  }
  return mapa;
}

export function arbolCultivo(espacios, unidades, plantas) {
  const plantasPorUnidad = new Map();
  for (const planta of plantas || []) {
    if (!planta?.id || planta.estado === "finalizada") continue;
    const lista = plantasPorUnidad.get(planta.unidad_cultivo_id) || [];
    lista.push({ id: planta.id, nombre: planta.nombre || "Planta" });
    plantasPorUnidad.set(planta.unidad_cultivo_id, lista);
  }

  return (espacios || [])
    .filter((espacio) => espacio?.id)
    .map((espacio) => ({
      id: espacio.id,
      nombre: espacio.nombre || "Espacio",
      unidades: (unidades || [])
        .filter((unidad) => unidad?.id && unidad.espacio_id === espacio.id)
        .map((unidad) => ({
          id: unidad.id,
          nombre: unidad.nombre || "Unidad",
          plantas: plantasPorUnidad.get(unidad.id) || [],
        })),
    }));
}
