import { PARAMETROS_HISTORIAL } from "@/lib/demo/historial/normalizar-historial";
import { HISTORIAL_RDWC1 } from "@/lib/demo/historial/rdwc1-dataset";
import { esEtapa, etiquetaEtapa, formatearFecha } from "@/lib/etapas";

export const HISTORIAL_DEMO = HISTORIAL_RDWC1;

export const MESES = [
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

const ESTADOS = {
  en_curso: "En curso",
  finalizado: "Finalizado",
  pausado: "En pausa",
};

export function textoEstadoCultivo(estado) {
  return ESTADOS[estado] || "En curso";
}

export function formatearNumero(valor, decimales = null) {
  if (!Number.isFinite(valor)) return "—";
  const texto = decimales === null ? String(valor) : valor.toFixed(decimales).replace(/\.?0+$/, "");
  return texto.replace(".", ",");
}

export function parametroHistorial(clave) {
  return PARAMETROS_HISTORIAL.find((item) => item.clave === clave) || null;
}

export function textoMedicion(medicion) {
  const parametro = parametroHistorial(medicion.parametro);
  const valor = formatearNumero(medicion.valor);
  if (!parametro) return { etiqueta: medicion.parametro, corto: medicion.parametro, valor, unidad: "" };
  return { etiqueta: parametro.etiqueta, corto: parametro.corto, valor, unidad: parametro.unidad };
}

export function textoMedicionCompleto(medicion) {
  const { etiqueta, valor, unidad } = textoMedicion(medicion);
  return `${etiqueta} ${valor}${unidad ? ` ${unidad}` : ""}`;
}

function partesFecha(fecha) {
  const [anio, mes, dia] = String(fecha || "").split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  return { anio, mes, dia };
}

export function fechaLarga(fecha) {
  const partes = partesFecha(fecha);
  if (!partes) return formatearFecha(fecha);
  return `${partes.dia} de ${MESES[partes.mes - 1]} de ${partes.anio}`;
}

export function fechaCorta(fecha) {
  const partes = partesFecha(fecha);
  if (!partes) return formatearFecha(fecha);
  return `${partes.dia} de ${MESES[partes.mes - 1]}`;
}

export function mesDeFecha(fecha) {
  const partes = partesFecha(fecha);
  if (!partes) return "";
  const nombre = MESES[partes.mes - 1];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${partes.anio}`;
}

export function textoDiaCultivo(dia) {
  return dia === null || dia === undefined ? "Sin día" : `Día ${dia}`;
}

export function etiquetaEtapaHistorial(etapa) {
  return esEtapa(etapa) ? etiquetaEtapa(etapa) : "Sin etapa";
}

export function etapasConRegistros(historial) {
  const vistas = new Set(historial.dias.map((dia) => dia.etapa).filter(Boolean));
  return historial.etapas.filter((etapa) => vistas.has(etapa.etapa));
}

export function diasFiltrados(historial, etapa = "") {
  if (!etapa) return historial.dias;
  return historial.dias.filter((dia) => dia.etapa === etapa);
}

export function agruparPorMes(dias) {
  const grupos = [];
  for (const dia of dias) {
    const clave = dia.fecha.slice(0, 7);
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.clave === clave) ultimo.dias.push(dia);
    else grupos.push({ clave, titulo: mesDeFecha(dia.fecha), dias: [dia] });
  }
  return grupos;
}

export function mapaFotos(historial) {
  return new Map(historial.fotos.map((foto) => [foto.id, foto]));
}

export function fotosDeDia(historial, dia, mapa = mapaFotos(historial)) {
  return dia.fotos.map((id) => mapa.get(id)).filter(Boolean);
}

export function historialParaCiclo(historial) {
  return historial.etapas
    .filter((etapa) => esEtapa(etapa.etapa))
    .map((etapa) => ({ etapa: etapa.etapa, fecha_inicio: etapa.fechaInicio, fecha_fin: etapa.fechaFin }));
}

export function resumenDia(dia) {
  const partes = [];
  if (dia.resumen.fotos) partes.push(dia.resumen.fotos === 1 ? "1 foto" : `${dia.resumen.fotos} fotos`);
  if (dia.resumen.mediciones) {
    partes.push(dia.resumen.mediciones === 1 ? "1 medición" : `${dia.resumen.mediciones} mediciones`);
  }
  if (dia.resumen.acciones) partes.push(dia.resumen.acciones === 1 ? "1 acción" : `${dia.resumen.acciones} acciones`);
  if (dia.resumen.nota) partes.push("nota");
  return partes.join(" · ");
}

export function tarjetasResumen(historial) {
  const { resumen } = historial;
  return [
    { clave: "dias", valor: resumen.diasRegistrados, etiqueta: "Días registrados" },
    { clave: "fotos", valor: resumen.fotos, etiqueta: "Fotos" },
    { clave: "mediciones", valor: resumen.mediciones, etiqueta: "Mediciones" },
    { clave: "acciones", valor: resumen.acciones, etiqueta: "Acciones" },
    { clave: "etapas", valor: resumen.etapas, etiqueta: "Etapas" },
    { clave: "plantas", valor: resumen.plantas, etiqueta: "Plantas" },
  ];
}
