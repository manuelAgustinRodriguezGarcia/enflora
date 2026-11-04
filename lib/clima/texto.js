import { zonaHorariaValida } from "@/lib/clima/validar";

const NUMERO = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

function cantidad(valor, unidad) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "";
  return `${NUMERO.format(valor)} ${unidad}`;
}

export function textoTemperatura(valor) {
  return cantidad(valor, "°C");
}

export function textoPorcentaje(valor) {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "";
  return `${NUMERO.format(valor)} %`;
}

export function textoViento(valor) {
  return cantidad(valor, "km/h");
}

export function textoMilimetros(valor) {
  return cantidad(valor, "mm");
}

export function textoNieve(valor) {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) return "";
  return cantidad(valor, "cm");
}

export function textoFecha(iso) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!coincidencia) return "";
  const fecha = new Date(Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]), 12));
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(fecha);
}

function marcaIngenua(marca) {
  const texto = String(marca || "").trim();
  if (!texto || /[zZ]|[+-]\d{2}:?\d{2}$/.test(texto)) return null;
  const coincidencia = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(texto);
  if (!coincidencia) return null;
  return { fecha: coincidencia[1], hora: coincidencia[2] };
}

export function formatearInstante(marca, zonaHoraria) {
  const texto = String(marca || "").trim();
  if (!texto) return "";
  if (marcaIngenua(texto)) return "";
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return texto;
  const zona = zonaHorariaValida(zonaHoraria);
  const formato = new Intl.DateTimeFormat("es-AR", {
    timeZone: zona || "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(fecha);
  return zona ? `${formato} (${zona})` : `${formato} UTC`;
}

export function etiquetaActualizacion(marca, zonaHoraria) {
  const ingenua = marcaIngenua(marca);
  if (!ingenua) return formatearInstante(marca, zonaHoraria);
  const fecha = textoFecha(ingenua.fecha);
  if (!fecha) return "";
  const zona = zonaHorariaValida(zonaHoraria);
  const lugar = zona ? ` (hora local, ${zona})` : "";
  return `${fecha}, ${ingenua.hora}${lugar}`;
}

export function textoDiaCorto(iso) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!coincidencia) return "";
  const fecha = new Date(Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]), 12));
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(fecha);
}

export function etiquetaLocalidad(lugar) {
  return [lugar?.nombre, lugar?.region, lugar?.pais].map((parte) => String(parte || "").trim()).filter(Boolean).join(", ");
}

export function lugarPublico(lugar) {
  return {
    id: lugar.id,
    etiqueta: etiquetaLocalidad(lugar),
  };
}

export function textoPronostico(dias) {
  const cantidad = Number.isInteger(dias) && dias > 0 ? dias : 3;
  return `Valores previstos para los próximos ${cantidad} días. No son mediciones.`;
}

export function lineaResumen(clima) {
  if (!clima) return "";
  const partes = [];
  const temperatura = textoTemperatura(clima.actual?.temperaturaC);
  if (temperatura) partes.push(temperatura);
  if (clima.actual?.condicion) partes.push(clima.actual.condicion);
  const hoy = clima.dias?.[0];
  const maxima = textoTemperatura(hoy?.maximaC);
  const minima = textoTemperatura(hoy?.minimaC);
  if (maxima && minima) partes.push(`Máx. prevista ${maxima} / Mín. prevista ${minima}`);
  return partes.join(" · ");
}
