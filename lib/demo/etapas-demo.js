import { esEtapa, estadoPorEtapa, fechaValida, validarEtapaInicial } from "@/lib/etapas";

function filaValida(fila) {
  return (
    Boolean(fila) &&
    typeof fila === "object" &&
    esEtapa(fila.etapa) &&
    fechaValida(fila.fecha_inicio) &&
    (fila.fecha_fin === null || fechaValida(fila.fecha_fin))
  );
}

export function historialCoherente(planta) {
  const historial = Array.isArray(planta?.historial) ? planta.historial : [];
  if (!historial.length || !historial.every(filaValida)) return false;
  const abiertas = historial.filter((fila) => fila.fecha_fin === null);
  if (abiertas.length !== 1 || historial.at(-1).fecha_fin !== null) return false;
  if (historial.at(-1).etapa !== planta.etapa) return false;
  return historial.every((fila, indice) => {
    if (fila.fecha_fin !== null && fila.fecha_fin < fila.fecha_inicio) return false;
    if (indice === 0) return true;
    const anterior = historial[indice - 1];
    return anterior.fecha_fin === fila.fecha_inicio && anterior.etapa !== fila.etapa;
  });
}

export function historialInicial(planta) {
  return [{ etapa: planta.etapa, fecha_inicio: planta.fecha_inicio, fecha_fin: null }];
}

export function etapaAbierta(planta) {
  const historial = Array.isArray(planta?.historial) ? planta.historial : [];
  return historial.find((fila) => fila.fecha_fin === null) || null;
}

export function validarCambioEtapa(planta, etapa, fecha, hoy) {
  if (!planta) return "No se encontró la planta.";
  const error = validarEtapaInicial(etapa, fecha);
  if (error) return error;
  if (etapa === planta.etapa) return "La planta ya está en esa etapa.";
  if (fechaValida(hoy) && fecha > hoy) return "La fecha no puede ser posterior a hoy.";
  const abierta = etapaAbierta(planta);
  if (abierta && abierta.fecha_inicio > fecha) {
    return "La fecha no puede ser anterior al inicio de la etapa actual.";
  }
  return "";
}

export function aplicarCambioEtapa(planta, etapa, fecha) {
  const historial = (planta.historial || []).map((fila) =>
    fila.fecha_fin === null ? { ...fila, fecha_fin: fecha } : fila
  );
  return {
    ...planta,
    etapa,
    estado: estadoPorEtapa(etapa),
    historial: [...historial, { etapa, fecha_inicio: fecha, fecha_fin: null }],
  };
}

export function plantaCambioEtapa(planta) {
  return Array.isArray(planta?.historial) && planta.historial.length > 1;
}
