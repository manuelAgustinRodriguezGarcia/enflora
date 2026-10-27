import { diasEntre, fechaHoy, fechaValida } from "@/lib/etapas";
import { limitesFechaHistorial, ZONA_HISTORIAL } from "@/lib/historial-registros";

export { ZONA_HISTORIAL };

function diaCalendarioArgentina(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HISTORIAL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function restarDiasCalendario(diaTexto, cantidad) {
  const [anio, mes, dia] = diaTexto.split("-").map(Number);
  const marca = new Date(Date.UTC(anio, mes - 1, dia));
  marca.setUTCDate(marca.getUTCDate() - cantidad);
  const y = marca.getUTCFullYear();
  const m = String(marca.getUTCMonth() + 1).padStart(2, "0");
  const d = String(marca.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inicioSemanaArgentina(diaTexto) {
  const [anio, mes, dia] = diaTexto.split("-").map(Number);
  const marca = new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));
  const diaSemana = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HISTORIAL,
    weekday: "short",
  }).format(marca);
  const mapa = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const indice = mapa[diaSemana] ?? marca.getUTCDay();
  return restarDiasCalendario(diaTexto, indice);
}

export function periodoDesdePreset(preset, { hoy = fechaHoy(), dias = 7 } = {}) {
  const referencia = fechaValida(hoy) ? hoy : fechaHoy();

  switch (preset) {
    case "hoy":
      return { desde: referencia, hasta: referencia, preset: "hoy" };
    case "ayer": {
      const ayer = restarDiasCalendario(referencia, 1);
      return { desde: ayer, hasta: ayer, preset: "ayer" };
    }
    case "ultimos_7":
      return {
        desde: restarDiasCalendario(referencia, 6),
        hasta: referencia,
        preset: "ultimos_7",
      };
    case "ultimos_14":
      return {
        desde: restarDiasCalendario(referencia, 13),
        hasta: referencia,
        preset: "ultimos_14",
      };
    case "semana_actual": {
      const inicio = inicioSemanaArgentina(referencia);
      return { desde: inicio, hasta: referencia, preset: "semana_actual" };
    }
    case "semana_anterior": {
      const inicioActual = inicioSemanaArgentina(referencia);
      const finAnterior = restarDiasCalendario(inicioActual, 1);
      const inicioAnterior = restarDiasCalendario(inicioActual, 7);
      return { desde: inicioAnterior, hasta: finAnterior, preset: "semana_anterior" };
    }
    case "rango":
      return null;
    default:
      if (Number.isFinite(dias) && dias > 0) {
        return {
          desde: restarDiasCalendario(referencia, dias - 1),
          hasta: referencia,
          preset: `ultimos_${dias}`,
        };
      }
      return periodoDesdePreset("ultimos_7", { hoy: referencia });
  }
}

export function normalizarPeriodo(entrada = {}) {
  if (entrada.preset) {
    const calculado = periodoDesdePreset(entrada.preset, { hoy: entrada.hoy, dias: entrada.dias });
    if (!calculado) return { error: "El preset de período no es válido.", periodo: null };
    return { error: "", periodo: calculado };
  }

  const desde = String(entrada.desde || "").trim();
  const hasta = String(entrada.hasta || "").trim();
  if (!desde && !hasta) {
    const dias = entrada.diasRecientes === 14 ? 14 : 7;
    return { error: "", periodo: periodoDesdePreset(dias === 14 ? "ultimos_14" : "ultimos_7") };
  }
  if (!fechaValida(desde) || !fechaValida(hasta)) {
    return { error: "El período indicado no es válido.", periodo: null };
  }
  if (desde > hasta) return { error: "El período no es válido.", periodo: null };
  return { error: "", periodo: { desde, hasta, preset: "rango" } };
}

export function limitesIsoPeriodo(periodo) {
  if (!periodo?.desde || !periodo?.hasta) return null;
  return limitesFechaHistorial(periodo.desde, periodo.hasta);
}

export function duracionDiasPeriodo(periodo) {
  if (!periodo?.desde || !periodo?.hasta) return 0;
  return diasEntre(periodo.desde, periodo.hasta) + 1;
}

export function diaReferenciaArgentina() {
  return diaCalendarioArgentina();
}
